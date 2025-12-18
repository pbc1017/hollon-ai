import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { setupSwagger } from './config/swagger.config';
import { helmetConfig } from './config/security.config';
import { compressionConfig } from './config/compression.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('server.port', 3001);
  const host = configService.get<string>('server.host', '0.0.0.0');

  // Security middleware (Helmet)
  app.use(helmetConfig);

  // Compression middleware
  app.use(compressionConfig);

  // Global pipes
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Global filters
  app.useGlobalFilters(new AllExceptionsFilter());

  // Global interceptors
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalInterceptors(new TransformInterceptor());

  // CORS
  app.enableCors({
    origin: configService.get<string>('cors.origin', '*'),
    credentials: true,
  });

  // API prefix
  app.setGlobalPrefix('api');

  // Setup Swagger documentation (disabled in production)
  setupSwagger(app, configService);

  await app.listen(port, host);
  logger.log(`🚀 Hollon-AI Server running on http://${host}:${port}`);
  logger.log(`📊 Health check: http://${host}:${port}/api/health`);

  const nodeEnv = configService.get<string>('nodeEnv', 'development');
  if (nodeEnv !== 'production') {
    logger.log(`📚 API Documentation: http://${host}:${port}/api/docs`);
  }
}

bootstrap();
