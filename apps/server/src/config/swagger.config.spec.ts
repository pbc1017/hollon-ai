import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { setupSwagger } from './swagger.config';

// Mock SwaggerModule to avoid actual Swagger setup in tests
jest.mock('@nestjs/swagger', () => ({
  DocumentBuilder: jest.fn().mockImplementation(() => ({
    setTitle: jest.fn().mockReturnThis(),
    setDescription: jest.fn().mockReturnThis(),
    setVersion: jest.fn().mockReturnThis(),
    addTag: jest.fn().mockReturnThis(),
    addBearerAuth: jest.fn().mockReturnThis(),
    build: jest.fn().mockReturnValue({}),
  })),
  SwaggerModule: {
    createDocument: jest.fn().mockReturnValue({}),
    setup: jest.fn(),
  },
}));

describe('Swagger Configuration', () => {
  let mockApp: INestApplication;
  let mockConfigService: ConfigService;

  beforeEach(() => {
    mockApp = {} as INestApplication;
    mockConfigService = {
      get: jest.fn(),
    } as unknown as ConfigService;
  });

  it('should not setup Swagger in production environment', () => {
    (mockConfigService.get as jest.Mock).mockReturnValue('production');

    setupSwagger(mockApp, mockConfigService);

    expect(mockConfigService.get).toHaveBeenCalledWith(
      'nodeEnv',
      'development',
    );
  });

  it('should setup Swagger in development environment', () => {
    const { SwaggerModule } = require('@nestjs/swagger');
    (mockConfigService.get as jest.Mock).mockReturnValue('development');

    setupSwagger(mockApp, mockConfigService);

    expect(SwaggerModule.setup).toHaveBeenCalledWith(
      'api/docs',
      mockApp,
      {},
      expect.any(Object),
    );
  });

  it('should setup Swagger in test environment', () => {
    const { SwaggerModule } = require('@nestjs/swagger');
    (mockConfigService.get as jest.Mock).mockReturnValue('test');

    setupSwagger(mockApp, mockConfigService);

    expect(SwaggerModule.setup).toHaveBeenCalled();
  });
});
