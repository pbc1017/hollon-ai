import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hollon } from '../hollon/entities/hollon.entity';
import { Task } from '../task/entities/task.entity';
import { Document } from '../document/entities/document.entity';
import { Organization } from '../organization/entities/organization.entity';
import { Project } from '../project/entities/project.entity';
import { BrainProviderModule } from '../brain-provider/brain-provider.module';
import { CollaborationModule } from '../collaboration/collaboration.module';
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
import { CostRecord } from '../cost-tracking/entities/cost-record.entity';
import { GoalDecompositionService } from '../goal/services/goal-decomposition.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hollon,
      Task,
      Document,
      Organization,
      Project,
      CostRecord,
    ]),
    BrainProviderModule,
    CollaborationModule,
    GoalModule,
  ],
  providers: [
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
    {
      provide: 'GoalDecompositionService',
      useExisting: GoalDecompositionService,
    },
  ],
  exports: [
    PromptComposerService,
    TaskPoolService,
    TaskExecutionService,
    HollonOrchestratorService,
  ],
})
export class OrchestrationModule {}
