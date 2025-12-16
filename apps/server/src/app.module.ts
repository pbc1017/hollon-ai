import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
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
import { RealtimeModule } from './modules/realtime/realtime.module';
import { ChannelModule } from './modules/channel/channel.module';
import { MeetingModule } from './modules/meeting/meeting.module';
import { CollaborationModule } from './modules/collaboration/collaboration.module';
import { ApprovalModule } from './modules/approval/approval.module';
import { CrossTeamCollaborationModule } from './modules/cross-team-collaboration/cross-team-collaboration.module';
import { IncidentModule } from './modules/incident/incident.module';
import { ConflictResolutionModule } from './modules/conflict-resolution/conflict-resolution.module';
import { GoalModule } from './modules/goal/goal.module';
import { DddProvidersModule } from './modules/ddd-providers/ddd-providers.module';
import { KnowledgeModule } from './modules/knowledge/knowledge.module';
import { UserModule } from './modules/user/user.module';

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
    ...(process.env.DISABLE_SCHEDULER !== 'true'
      ? [ScheduleModule.forRoot()]
      : []),
    PostgresListenerModule,

    // Feature modules
    HealthModule,
    OrganizationModule,
    RoleModule,
    UserModule,
    TeamModule,
    HollonModule,
    ProjectModule,
    TaskModule,
    BrainProviderModule,
    OrchestrationModule,
    MessageModule,
    RealtimeModule,
    ChannelModule,
    MeetingModule,
    CollaborationModule,
    ApprovalModule,
    CrossTeamCollaborationModule,
    IncidentModule,
    ConflictResolutionModule,
    GoalModule,
    KnowledgeModule,

    // ✅ DDD: Global Port Providers Module
    DddProvidersModule,
  ],
})
export class AppModule {}
