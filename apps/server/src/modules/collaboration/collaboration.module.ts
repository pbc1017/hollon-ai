import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollaborationSession } from './entities/collaboration-session.entity';
import { TaskPullRequest } from './entities/task-pull-request.entity';
import { Hollon } from '../hollon/entities/hollon.entity';
import { Task } from '../task/entities/task.entity';
import { Role } from '../role/entities/role.entity';
import { CollaborationService } from './services/collaboration.service';
import { CodeReviewService } from './services/code-review.service';
import { ReviewerHollonService } from './services/reviewer-hollon.service';
import { PRDiffCacheService } from './services/pr-diff-cache.service';
import { ReviewQualityService } from './services/review-quality.service';
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
      Role,
    ]),
    forwardRef(() => MessageModule),
    forwardRef(() => HollonModule),
    BrainProviderModule,
  ],
  controllers: [CollaborationController],
  providers: [
    CollaborationService,
    CodeReviewService,
    ReviewerHollonService,
    PRDiffCacheService,
    ReviewQualityService,
  ],
  exports: [
    CollaborationService,
    CodeReviewService,
    ReviewerHollonService,
    PRDiffCacheService,
    ReviewQualityService,
  ],
})
export class CollaborationModule {}
