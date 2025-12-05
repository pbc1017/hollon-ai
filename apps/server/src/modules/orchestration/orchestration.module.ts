import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Hollon } from '../hollon/entities/hollon.entity';
import { Task } from '../task/entities/task.entity';
import { Document } from '../document/entities/document.entity';
import { BrainProviderModule } from '../brain-provider/brain-provider.module';
import { PromptComposerService } from './services/prompt-composer.service';
import { TaskPoolService } from './services/task-pool.service';
import { HollonOrchestratorService } from './services/hollon-orchestrator.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Hollon,
      Task,
      Document,
    ]),
    BrainProviderModule,
  ],
  providers: [
    PromptComposerService,
    TaskPoolService,
    HollonOrchestratorService,
  ],
  exports: [
    PromptComposerService,
    TaskPoolService,
    HollonOrchestratorService,
  ],
})
export class OrchestrationModule {}
