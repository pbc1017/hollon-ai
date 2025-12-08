import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Goal } from './entities/goal.entity';
import { GoalProgressRecord } from './entities/goal-progress-record.entity';
import { GoalService } from './goal.service';

@Module({
  imports: [TypeOrmModule.forFeature([Goal, GoalProgressRecord])],
  providers: [GoalService],
  exports: [GoalService],
})
export class GoalModule {}
