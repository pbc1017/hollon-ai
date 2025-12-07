import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborationSession } from './entities/collaboration-session.entity';
import { TaskPullRequest } from './entities/task-pull-request.entity';
import { Hollon } from '../hollon/entities/hollon.entity';
import { Task } from '../task/entities/task.entity';
import { CollaborationService } from './services/collaboration.service';
import { CodeReviewService } from './services/code-review.service';
import { CollaborationController } from './collaboration.controller';
import { MessageModule } from '../message/message.module';
import { HollonModule } from '../hollon/hollon.module';

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
  ],
  controllers: [CollaborationController],
  providers: [CollaborationService, CodeReviewService],
  exports: [CollaborationService, CodeReviewService],
})
export class CollaborationModule {}
