import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

export function setupSwagger(
  app: INestApplication,
  configService: ConfigService,
): void {
  const nodeEnv = configService.get<string>('nodeEnv', 'development');

  // Only enable Swagger in non-production environments
  if (nodeEnv === 'production') {
    return;
  }

  const config = new DocumentBuilder()
    .setTitle('Hollon-AI API')
    .setDescription(
      'Recursive Multi-Agent System - AI agents collaborating like a startup organization',
    )
    .setVersion('0.1.0')
    .addTag('health', 'Health check endpoints')
    .addTag('organizations', 'Organization management')
    .addTag('teams', 'Team management')
    .addTag('hollons', 'Hollon (AI agent) management')
    .addTag('projects', 'Project management')
    .addTag('tasks', 'Task management')
    .addTag('messages', 'Message management')
    .addTag('channels', 'Channel management')
    .addTag('meetings', 'Meeting management')
    .addTag('goals', 'Goal management')
    .addTag('approvals', 'Approval workflow')
    .addTag('incidents', 'Incident management')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Enter JWT token',
      },
      'JWT',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Hollon-AI API Documentation',
  });
}
