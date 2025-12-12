import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { User, AuthProvider } from './entities/user.entity';
import { Session } from './entities/session.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import {
  AuthResponseDto,
  TwoFactorChallengeDto,
} from './dto/auth-response.dto';

interface JwtPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh' | 'temp';
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly jwtSecret: string;
  private readonly jwtExpiration: number;
  private readonly refreshExpiration: number;
  private readonly maxLoginAttempts = 5;
  private readonly lockoutDuration = 15 * 60 * 1000; // 15 minutes

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Session)
    private readonly sessionRepository: Repository<Session>,
    private readonly configService: ConfigService,
  ) {
    this.jwtSecret =
      this.configService.get<string>('JWT_SECRET') || 'your-secret-key';
    this.jwtExpiration =
      this.configService.get<number>('JWT_EXPIRATION') || 3600; // 1 hour
    this.refreshExpiration =
      this.configService.get<number>('REFRESH_EXPIRATION') || 604800; // 7 days
  }

  /**
   * Register a new user with email and password
   */
  async register(registerDto: RegisterDto): Promise<AuthResponseDto> {
    const { email, password, firstName, lastName } = registerDto;

    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email },
    });
    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await this.hashPassword(password);

    // Create user
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      firstName: firstName || null,
      lastName: lastName || null,
      provider: AuthProvider.LOCAL,
      emailVerified: false,
    });

    await this.userRepository.save(user);

    this.logger.log(`New user registered: ${email}`);

    // Generate tokens
    return this.generateAuthResponse(user);
  }

  /**
   * Login with email and password
   */
  async login(
    loginDto: LoginDto,
    ipAddress?: string,
  ): Promise<AuthResponseDto | TwoFactorChallengeDto> {
    const { email, password, twoFactorCode } = loginDto;

    // Find user
    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException(
        'Account is temporarily locked. Please try again later.',
      );
    }

    // Verify password
    if (!user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      await this.handleFailedLogin(user);
      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed attempts on successful password verification
    if (user.failedLoginAttempts > 0) {
      user.failedLoginAttempts = 0;
      user.lockedUntil = null;
      await this.userRepository.save(user);
    }

    // Check 2FA
    if (user.twoFactorEnabled) {
      if (!twoFactorCode) {
        // Return temp token for 2FA challenge
        const tempToken = this.generateToken(user, 'temp', 300); // 5 minutes
        return {
          requiresTwoFactor: true,
          tempToken,
        };
      }

      // Verify 2FA code
      const is2FAValid = await this.verify2FACode(user, twoFactorCode);
      if (!is2FAValid) {
        throw new UnauthorizedException('Invalid 2FA code');
      }
    }

    // Update last login
    user.lastLoginAt = new Date();
    user.lastLoginIp = ipAddress || null;
    await this.userRepository.save(user);

    this.logger.log(`User logged in: ${email}`);

    // Generate tokens and create session
    return this.generateAuthResponse(user, ipAddress);
  }

  /**
   * OAuth login/registration
   */
  async oauthLogin(
    provider: AuthProvider,
    providerId: string,
    email: string,
    firstName?: string,
    lastName?: string,
  ): Promise<AuthResponseDto> {
    let user = await this.userRepository.findOne({
      where: { provider, providerId },
    });

    if (!user) {
      // Check if email exists with different provider
      user = await this.userRepository.findOne({ where: { email } });

      if (user) {
        // Link OAuth account to existing user
        user.provider = provider;
        user.providerId = providerId;
        user.emailVerified = true;
      } else {
        // Create new user
        user = this.userRepository.create({
          email,
          provider,
          providerId,
          firstName: firstName || null,
          lastName: lastName || null,
          emailVerified: true,
          password: null,
        });
      }

      await this.userRepository.save(user);
      this.logger.log(`OAuth user created/linked: ${email} (${provider})`);
    }

    user.lastLoginAt = new Date();
    await this.userRepository.save(user);

    return this.generateAuthResponse(user);
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string): Promise<AuthResponseDto> {
    // Find session with refresh token
    const session = await this.sessionRepository.findOne({
      where: { refreshToken, isRevoked: false },
      relations: ['user'],
    });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Check if session expired
    if (session.expiresAt < new Date()) {
      await this.revokeSession(session.id);
      throw new UnauthorizedException('Refresh token expired');
    }

    // Update last activity
    session.lastActivityAt = new Date();
    await this.sessionRepository.save(session);

    // Generate new tokens
    return this.generateAuthResponse(session.user);
  }

  /**
   * Logout and revoke session
   */
  async logout(userId: string, sessionId?: string): Promise<void> {
    if (sessionId) {
      await this.revokeSession(sessionId);
    } else {
      // Revoke all sessions for user
      await this.sessionRepository.update(
        { userId, isRevoked: false },
        { isRevoked: true, revokedAt: new Date() },
      );
    }

    this.logger.log(`User logged out: ${userId}`);
  }

  /**
   * Enable 2FA for user
   */
  async enable2FA(userId: string): Promise<{ secret: string; qrCode: string }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (user.twoFactorEnabled) {
      throw new BadRequestException('2FA is already enabled');
    }

    // Generate secret (in production, use speakeasy or similar library)
    const secret = this.generateSecret();

    // Generate backup codes
    const backupCodes = this.generateBackupCodes(10);

    user.twoFactorSecret = secret;
    user.twoFactorBackupCodes = await Promise.all(
      backupCodes.map((code) => this.hashPassword(code)),
    );

    await this.userRepository.save(user);

    // Generate QR code URL (in production, use qrcode library)
    const qrCode = `otpauth://totp/HollonAI:${user.email}?secret=${secret}&issuer=HollonAI`;

    return { secret, qrCode };
  }

  /**
   * Verify and activate 2FA
   */
  async verify2FASetup(
    userId: string,
    code: string,
  ): Promise<{ backupCodes: string[] }> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }

    const isValid = await this.verify2FACode(user, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    user.twoFactorEnabled = true;
    await this.userRepository.save(user);

    this.logger.log(`2FA enabled for user: ${user.email}`);

    // Return backup codes (unhashed versions were not stored, regenerate for display)
    const backupCodes = this.generateBackupCodes(10);
    return { backupCodes };
  }

  /**
   * Disable 2FA
   */
  async disable2FA(userId: string, code: string): Promise<void> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    if (!user.twoFactorEnabled) {
      throw new BadRequestException('2FA is not enabled');
    }

    const isValid = await this.verify2FACode(user, code);
    if (!isValid) {
      throw new UnauthorizedException('Invalid 2FA code');
    }

    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorBackupCodes = null;
    await this.userRepository.save(user);

    this.logger.log(`2FA disabled for user: ${user.email}`);
  }

  /**
   * Get active sessions for user
   */
  async getActiveSessions(userId: string): Promise<Session[]> {
    return this.sessionRepository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(new Date()),
      },
      order: { lastActivityAt: 'DESC' },
    });
  }

  /**
   * Revoke a specific session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionRepository.update(
      { id: sessionId },
      { isRevoked: true, revokedAt: new Date() },
    );
  }

  /**
   * Validate user by ID (for JWT strategy)
   */
  async validateUser(userId: string): Promise<User | null> {
    return this.userRepository.findOne({
      where: { id: userId, isActive: true },
    });
  }

  // ===== Private Helper Methods =====

  private async generateAuthResponse(
    user: User,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<AuthResponseDto> {
    const accessToken = this.generateToken(user, 'access', this.jwtExpiration);
    const refreshToken = this.generateToken(
      user,
      'refresh',
      this.refreshExpiration,
    );

    // Create session
    const expiresAt = new Date(Date.now() + this.refreshExpiration * 1000);
    const session = this.sessionRepository.create({
      userId: user.id,
      accessToken,
      refreshToken,
      expiresAt,
      ipAddress: ipAddress || null,
      userAgent: userAgent || null,
      lastActivityAt: new Date(),
    });

    await this.sessionRepository.save(session);

    return {
      accessToken,
      refreshToken,
      expiresIn: this.jwtExpiration,
      tokenType: 'Bearer',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        twoFactorEnabled: user.twoFactorEnabled,
      },
    };
  }

  private generateToken(
    user: User,
    type: 'access' | 'refresh' | 'temp',
    expiresIn: number,
  ): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      type,
    };

    // In production, use @nestjs/jwt JwtService
    // This is a simplified version using basic encoding
    const header = Buffer.from(
      JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
    ).toString('base64url');
    const payloadData = Buffer.from(
      JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1000) + expiresIn,
      }),
    ).toString('base64url');
    const signature = crypto
      .createHmac('sha256', this.jwtSecret)
      .update(`${header}.${payloadData}`)
      .digest('base64url');

    return `${header}.${payloadData}.${signature}`;
  }

  private async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  private async handleFailedLogin(user: User): Promise<void> {
    user.failedLoginAttempts += 1;

    if (user.failedLoginAttempts >= this.maxLoginAttempts) {
      user.lockedUntil = new Date(Date.now() + this.lockoutDuration);
      this.logger.warn(
        `Account locked due to failed login attempts: ${user.email}`,
      );
    }

    await this.userRepository.save(user);
  }

  private async verify2FACode(user: User, code: string): Promise<boolean> {
    if (!user.twoFactorSecret) {
      return false;
    }

    // In production, use speakeasy or similar library to verify TOTP
    // This is a simplified check
    const isValidTOTP = this.verifyTOTP(user.twoFactorSecret, code);

    if (isValidTOTP) {
      return true;
    }

    // Check backup codes
    if (user.twoFactorBackupCodes && user.twoFactorBackupCodes.length > 0) {
      for (let i = 0; i < user.twoFactorBackupCodes.length; i++) {
        const isMatch = await bcrypt.compare(
          code,
          user.twoFactorBackupCodes[i],
        );
        if (isMatch) {
          // Remove used backup code
          user.twoFactorBackupCodes.splice(i, 1);
          await this.userRepository.save(user);
          return true;
        }
      }
    }

    return false;
  }

  private verifyTOTP(secret: string, token: string): boolean {
    // Simplified TOTP verification
    // In production, use speakeasy.totp.verify()
    const window = 1; // Allow 1 step before/after
    const step = 30; // 30 seconds
    const currentTime = Math.floor(Date.now() / 1000 / step);

    for (let i = -window; i <= window; i++) {
      const time = currentTime + i;
      const expectedToken = this.generateTOTP(secret, time);
      if (expectedToken === token) {
        return true;
      }
    }

    return false;
  }

  private generateTOTP(secret: string, time: number): string {
    // Simplified TOTP generation
    // In production, use speakeasy.totp.generate()
    const hmac = crypto.createHmac('sha1', secret);
    const timeBuffer = Buffer.allocUnsafe(8);
    timeBuffer.writeBigInt64BE(BigInt(time));
    hmac.update(timeBuffer);
    const hash = hmac.digest();

    const offset = hash[hash.length - 1] & 0xf;
    const binary =
      ((hash[offset] & 0x7f) << 24) |
      ((hash[offset + 1] & 0xff) << 16) |
      ((hash[offset + 2] & 0xff) << 8) |
      (hash[offset + 3] & 0xff);

    const otp = binary % 1000000;
    return otp.toString().padStart(6, '0');
  }

  private generateSecret(): string {
    return crypto.randomBytes(20).toString('hex');
  }

  private generateBackupCodes(count: number): string[] {
    const codes: string[] = [];
    for (let i = 0; i < count; i++) {
      const code = crypto.randomBytes(4).toString('hex').toUpperCase();
      codes.push(`${code.slice(0, 4)}-${code.slice(4, 8)}`);
    }
    return codes;
  }
}
