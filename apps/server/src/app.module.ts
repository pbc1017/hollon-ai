import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import configuration from './config/configuration';
import { databaseConfig } from './config/database.config';
import { HealthModule } from './modules/health/health.module';
import { OrganizationModule } from './modules/organization/organization.module';
import { RoleModule } from './modules/role/role.module';
import { TeamModule } from './modules/team/team.module';
import { HollonModule } from './modules/hollon/hollon.module';
import { ProjectModule } from './modules/project/project.module';
import { TaskModule } from './modules/task/task.module';
import { BrainProviderModule } from './modules/brain-provider/brain-provider.module';
import { OrchestrationModule } from './modules/orchestration/orchestration.module';
import { PostgresListenerModule } from './modules/postgres-listener/postgres-listener.module';
import { MessageModule } from './modules/message/message.module';

@Module({
  imports: [
    // Configuration
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      envFilePath: ['../../.env.local', '../../.env'],
    }),

    // Database
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) =>
        databaseConfig(configService),
      inject: [ConfigService],
    }),

    // Infrastructure modules (Global)
    PostgresListenerModule,

    // Feature modules
    HealthModule,
    OrganizationModule,
    RoleModule,
    TeamModule,
    HollonModule,
    ProjectModule,
    TaskModule,
    BrainProviderModule,
    OrchestrationModule,
    MessageModule,
  ],
})
export class AppModule {}
