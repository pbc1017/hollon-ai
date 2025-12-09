import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborationSession } from './entities/collaboration-session.entity';
import { TaskPullRequest } from './entities/task-pull-request.entity';
import { Hollon } from '../hollon/entities/hollon.entity';
import { Task } from '../task/entities/task.entity';
import { CollaborationService } from './services/collaboration.service';
import { CodeReviewService } from './services/code-review.service';
import { ReviewerHollonService } from './services/reviewer-hollon.service';
import { CollaborationController } from './collaboration.controller';
import { MessageModule } from '../message/message.module';
import { HollonModule } from '../hollon/hollon.module';
import { BrainProviderModule } from '../brain-provider/brain-provider.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CollaborationSession,
      TaskPullRequest,
      Hollon,
      Task,
    ]),
    MessageModule,
    HollonModule,
    BrainProviderModule,
  ],
  controllers: [CollaborationController],
  providers: [CollaborationService, CodeReviewService, ReviewerHollonService],
  exports: [CollaborationService, CodeReviewService, ReviewerHollonService],
})
export class CollaborationModule {}
