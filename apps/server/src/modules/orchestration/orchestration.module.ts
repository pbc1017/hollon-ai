import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hollon } from '../hollon/entities/hollon.entity';
import { Task } from '../task/entities/task.entity';
import { Document } from '../document/entities/document.entity';
import { Organization } from '../organization/entities/organization.entity';
import { BrainProviderModule } from '../brain-provider/brain-provider.module';
import { PromptComposerService } from './services/prompt-composer.service';
import { TaskPoolService } from './services/task-pool.service';
import { HollonOrchestratorService } from './services/hollon-orchestrator.service';
import { QualityGateService } from './services/quality-gate.service';
import { EscalationService } from './services/escalation.service';
import { SubtaskCreationService } from './services/subtask-creation.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hollon,
      Task,
      Document,
      Organization,
    ]),
    BrainProviderModule,
  ],
  providers: [
    PromptComposerService,
    TaskPoolService,
    QualityGateService,
    EscalationService,
    SubtaskCreationService,
    HollonOrchestratorService,
  ],
  exports: [
    PromptComposerService,
    TaskPoolService,
    HollonOrchestratorService,
  ],
})
export class OrchestrationModule {}
