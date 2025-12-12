import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { User, AuthProvider } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { DeviceFingerprintService } from './services/device-fingerprint.service';

describe('AuthService', () => {
  let service: AuthService;
  let _userRepository: Repository<User>;
  let _sessionRepository: Repository<Session>;
  let _jwtService: JwtService;
  let _deviceFingerprintService: DeviceFingerprintService;

  const mockUser: Partial<User> = {
    id: '123',
    email: 'test@example.com',
    password: 'hashedPassword',
    firstName: 'John',
    lastName: 'Doe',
    provider: AuthProvider.LOCAL,
    emailVerified: false,
    twoFactorEnabled: false,
    twoFactorSecret: null,
    twoFactorBackupCodes: null,
    failedLoginAttempts: 0,
    lockedUntil: null,
    isActive: true,
    lastLoginAt: null,
    lastLoginIp: null,
  };

  const mockUserRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
  };

  const mockSessionRepository = {
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config = {
        JWT_SECRET: 'test-secret',
        JWT_EXPIRATION: 3600,
        REFRESH_EXPIRATION: 604800,
      };
      return config[key];
    }),
  };

  const mockDeviceFingerprintService = {
    generateFingerprint: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: getRepositoryToken(User),
          useValue: mockUserRepository,
        },
        {
          provide: getRepositoryToken(Session),
          useValue: mockSessionRepository,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: DeviceFingerprintService,
          useValue: mockDeviceFingerprintService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    _userRepository = module.get<Repository<User>>(getRepositoryToken(User));
    _sessionRepository = module.get<Repository<Session>>(
      getRepositoryToken(Session),
    );
    _jwtService = module.get<JwtService>(JwtService);
    _deviceFingerprintService = module.get<DeviceFingerprintService>(
      DeviceFingerprintService,
    );

    // Clear all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('register', () => {
    it('should successfully register a new user', async () => {
      const registerDto = {
        email: 'newuser@example.com',
        password: 'SecurePass123!',
        firstName: 'Jane',
        lastName: 'Smith',
      };

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue({
        ...mockUser,
        ...registerDto,
      });
      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        ...registerDto,
      });
      mockJwtService.sign.mockReturnValue('mock-token');
      mockSessionRepository.create.mockReturnValue({});
      mockSessionRepository.save.mockResolvedValue({});

      const result = await service.register(registerDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result.user.email).toBe(registerDto.email);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: registerDto.email },
      });
    });

    it('should throw ConflictException if user already exists', async () => {
      const registerDto = {
        email: 'existing@example.com',
        password: 'SecurePass123!',
      };

      mockUserRepository.findOne.mockResolvedValue(mockUser);

      await expect(service.register(registerDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('login', () => {
    it('should successfully login with valid credentials', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const hashedPassword = await bcrypt.hash('password123', 12);
      const userWithHashedPassword = { ...mockUser, password: hashedPassword };

      mockUserRepository.findOne.mockResolvedValue(userWithHashedPassword);
      mockUserRepository.save.mockResolvedValue(userWithHashedPassword);
      mockJwtService.sign.mockReturnValue('mock-token');
      mockSessionRepository.create.mockReturnValue({});
      mockSessionRepository.save.mockResolvedValue({});

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { email: loginDto.email },
      });
    });

    it('should throw UnauthorizedException with invalid password', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const hashedPassword = await bcrypt.hash('correctpassword', 12);
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        password: hashedPassword,
      });
      mockUserRepository.save.mockResolvedValue(mockUser);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for non-existent user', async () => {
      const loginDto = {
        email: 'nonexistent@example.com',
        password: 'password123',
      };

      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should return 2FA challenge if 2FA is enabled', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'password123',
      };

      const hashedPassword = await bcrypt.hash('password123', 12);
      const userWith2FA = {
        ...mockUser,
        password: hashedPassword,
        twoFactorEnabled: true,
        twoFactorSecret: 'secret',
      };

      mockUserRepository.findOne.mockResolvedValue(userWith2FA);
      mockUserRepository.save.mockResolvedValue(userWith2FA);
      mockJwtService.sign.mockReturnValue('temp-token');

      const result = await service.login(loginDto);

      expect(result).toHaveProperty('requiresTwoFactor', true);
      expect(result).toHaveProperty('tempToken');
    });

    it('should lock account after max failed attempts', async () => {
      const loginDto = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const userWithFailedAttempts = {
        ...mockUser,
        password: await bcrypt.hash('correctpassword', 12),
        failedLoginAttempts: 4,
      };

      mockUserRepository.findOne.mockResolvedValue(userWithFailedAttempts);
      mockUserRepository.save.mockImplementation(async (user) => {
        expect(user.failedLoginAttempts).toBe(5);
        expect(user.lockedUntil).toBeDefined();
        return user;
      });

      await expect(service.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('oauthLogin', () => {
    it('should create new user for OAuth login', async () => {
      const provider = AuthProvider.GOOGLE;
      const providerId = '123456';
      const email = 'oauth@example.com';

      mockUserRepository.findOne.mockResolvedValue(null);
      mockUserRepository.create.mockReturnValue(mockUser);
      mockUserRepository.save.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('mock-token');
      mockSessionRepository.create.mockReturnValue({});
      mockSessionRepository.save.mockResolvedValue({});

      const result = await service.oauthLogin(provider, providerId, email);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(mockUserRepository.create).toHaveBeenCalled();
    });

    it('should link OAuth account to existing email', async () => {
      const provider = AuthProvider.GOOGLE;
      const providerId = '123456';
      const email = 'existing@example.com';

      mockUserRepository.findOne
        .mockResolvedValueOnce(null) // First call: check provider
        .mockResolvedValueOnce(mockUser); // Second call: check email

      mockUserRepository.save.mockResolvedValue({
        ...mockUser,
        provider,
        providerId,
      });
      mockJwtService.sign.mockReturnValue('mock-token');
      mockSessionRepository.create.mockReturnValue({});
      mockSessionRepository.save.mockResolvedValue({});

      const result = await service.oauthLogin(provider, providerId, email);

      expect(result).toHaveProperty('accessToken');
      expect(mockUserRepository.save).toHaveBeenCalled();
    });
  });

  describe('refreshToken', () => {
    it('should successfully refresh access token', async () => {
      const refreshToken = 'valid-refresh-token';
      const mockSession = {
        id: 'session-1',
        userId: mockUser.id,
        refreshToken,
        expiresAt: new Date(Date.now() + 100000),
        isRevoked: false,
        user: mockUser,
      };

      mockSessionRepository.findOne.mockResolvedValue(mockSession);
      mockSessionRepository.save.mockResolvedValue(mockSession);
      mockJwtService.sign.mockReturnValue('new-token');
      mockSessionRepository.create.mockReturnValue({});

      const result = await service.refreshToken(refreshToken);

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
    });

    it('should throw UnauthorizedException for invalid refresh token', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.refreshToken('invalid-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired refresh token', async () => {
      const mockSession = {
        id: 'session-1',
        refreshToken: 'expired-token',
        expiresAt: new Date(Date.now() - 100000),
        isRevoked: false,
      };

      mockSessionRepository.findOne.mockResolvedValue(mockSession);
      mockSessionRepository.update.mockResolvedValue({});

      await expect(service.refreshToken('expired-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('enable2FA', () => {
    it('should enable 2FA for user', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        twoFactorEnabled: false,
      });
      mockUserRepository.save.mockResolvedValue(mockUser);

      const result = await service.enable2FA(mockUser.id as string);

      expect(result).toHaveProperty('secret');
      expect(result).toHaveProperty('qrCode');
      expect(result.qrCode).toContain('data:image');
    });

    it('should throw BadRequestException if 2FA already enabled', async () => {
      mockUserRepository.findOne.mockResolvedValue({
        ...mockUser,
        twoFactorEnabled: true,
      });

      await expect(service.enable2FA(mockUser.id as string)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('validateUser', () => {
    it('should return user if valid and active', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const result = await service.validateUser(mockUser.id as string);

      expect(result).toEqual(mockUser);
      expect(mockUserRepository.findOne).toHaveBeenCalledWith({
        where: { id: mockUser.id, isActive: true },
      });
    });

    it('should return null if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      const result = await service.validateUser('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('logout', () => {
    it('should revoke specific session', async () => {
      const sessionId = 'session-123';

      mockSessionRepository.update.mockResolvedValue({ affected: 1 });

      await service.logout(mockUser.id as string, sessionId);

      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        { id: sessionId },
        expect.objectContaining({ isRevoked: true }),
      );
    });

    it('should revoke all user sessions if no sessionId provided', async () => {
      mockSessionRepository.update.mockResolvedValue({ affected: 3 });

      await service.logout(mockUser.id as string);

      expect(mockSessionRepository.update).toHaveBeenCalledWith(
        { userId: mockUser.id, isRevoked: false },
        expect.objectContaining({ isRevoked: true }),
      );
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for user', async () => {
      const mockSessions = [
        { id: 'session-1', userId: mockUser.id, isRevoked: false },
        { id: 'session-2', userId: mockUser.id, isRevoked: false },
      ];

      mockSessionRepository.find.mockResolvedValue(mockSessions);

      const result = await service.getActiveSessions(mockUser.id as string);

      expect(result).toHaveLength(2);
      expect(mockSessionRepository.find).toHaveBeenCalled();
    });
  });
});
