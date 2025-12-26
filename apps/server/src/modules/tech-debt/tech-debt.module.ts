import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TechDebt } from './entities/tech-debt.entity';
import { Task } from '../task/entities/task.entity';
import { Project } from '../project/entities/project.entity';
import { TechDebtReviewService } from './services/tech-debt-review.service';

@Module({
  imports: [TypeOrmModule.forFeature([TechDebt, Task, Project])],
  providers: [TechDebtReviewService],
  exports: [TechDebtReviewService],
})
export class TechDebtModule {}
