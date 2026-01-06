import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hollon } from '../hollon/entities/hollon.entity';
import { Task } from '../task/entities/task.entity';
import { Document } from '../document/entities/document.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Project } from '../project/entities/project.entity';
import { Team } from '../team/entities/team.entity';
import { BrainProviderModule } from '../brain-provider/brain-provider.module';
import { GoalModule } from '../goal/goal.module';
import { PromptComposerService } from './services/prompt-composer.service';
import { TaskPoolService } from './services/task-pool.service';
import { HollonOrchestratorService } from './services/hollon-orchestrator.service';
import { QualityGateService } from './services/quality-gate.service';
import { EscalationService } from './services/escalation.service';
import { SubtaskCreationService } from './services/subtask-creation.service';
import { TaskAnalyzerService } from './services/task-analyzer.service';
import { DecisionLogService } from './services/decision-log.service';
import { CostTrackingService } from './services/cost-tracking.service';
import { TaskExecutionService } from './services/task-execution.service';
import { HollonExecutionService } from './services/hollon-execution.service';
import { TeamTaskDistributionService } from './services/team-task-distribution.service';
import { ManagerService } from './services/manager.service';
import { CostRecord } from '../cost-tracking/entities/cost-record.entity';
import { GoalDecompositionService } from '../goal/services/goal-decomposition.service';
import { ApprovalRequest } from '../approval/entities/approval-request.entity';
import { Role } from '../role/entities/role.entity';
import { TaskPullRequest } from '../collaboration/entities/task-pull-request.entity';
// DDD: Port Adapters
import { HollonManagementAdapter } from './infrastructure/adapters/hollon-management.adapter';
import { CodeReviewAdapter } from './infrastructure/adapters/code-review.adapter';
import { MessagingAdapter } from './infrastructure/adapters/messaging.adapter';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hollon,
      Task,
      Document,
      Organization,
      Project,
      Team,
      CostRecord,
      ApprovalRequest,
      Role,
      TaskPullRequest,
    ]),
    BrainProviderModule,
    // ✅ DDD: CollaborationModule, HollonModule import 제거 (Port 사용)
    forwardRef(() => GoalModule),
  ],
  providers: [
    // Application Services
    PromptComposerService,
    TaskPoolService,
    QualityGateService,
    EscalationService,
    SubtaskCreationService,
    TaskAnalyzerService,
    DecisionLogService,
    CostTrackingService,
    TaskExecutionService,
    HollonOrchestratorService,
    HollonExecutionService,
    TeamTaskDistributionService,
    ManagerService,
    {
      provide: 'GoalDecompositionService',
      useExisting: GoalDecompositionService,
    },

    // ✅ DDD: Port Adapters (OrchestrationModule 내에서만 사용)
    {
      provide: 'IHollonManagementPort',
      useClass: HollonManagementAdapter,
    },
    {
      provide: 'ICodeReviewPort',
      useClass: CodeReviewAdapter,
    },
    {
      provide: 'IMessagingPort',
      useClass: MessagingAdapter,
    },
  ],
  exports: [
    PromptComposerService,
    TaskPoolService,
    TaskExecutionService,
    HollonOrchestratorService,
    HollonExecutionService,
    TeamTaskDistributionService,
    ManagerService,
  ],
})
export class OrchestrationModule {}
