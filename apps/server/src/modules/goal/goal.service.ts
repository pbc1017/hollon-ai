import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal, GoalStatus, GoalType } from './entities/goal.entity';
import { GoalProgressRecord } from './entities/goal-progress-record.entity';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { RecordProgressDto } from './dto/record-progress.dto';

@Injectable()
export class GoalService {
  constructor(
    @InjectRepository(Goal)
    private readonly goalRepo: Repository<Goal>,
    @InjectRepository(GoalProgressRecord)
    private readonly progressRepo: Repository<GoalProgressRecord>,
  ) {}

  async create(dto: CreateGoalDto): Promise<Goal> {
    const goal = this.goalRepo.create(dto);
    return this.goalRepo.save(goal);
  }

  async findAll(filters?: {
    organizationId?: string;
    teamId?: string;
    status?: GoalStatus;
    goalType?: GoalType;
    parentGoalId?: string | null;
  }): Promise<Goal[]> {
    const query = this.goalRepo.createQueryBuilder('goal');

    if (filters?.organizationId) {
      query.andWhere('goal.organization_id = :orgId', {
        orgId: filters.organizationId,
      });
    }

    if (filters?.teamId) {
      query.andWhere('goal.team_id = :teamId', { teamId: filters.teamId });
    }

    if (filters?.status) {
      query.andWhere('goal.status = :status', { status: filters.status });
    }

    if (filters?.goalType) {
      query.andWhere('goal.goal_type = :goalType', {
        goalType: filters.goalType,
      });
    }

    if (filters?.parentGoalId !== undefined) {
      if (filters.parentGoalId === null) {
        // Top-level goals only
        query.andWhere('goal.parent_goal_id IS NULL');
      } else {
        query.andWhere('goal.parent_goal_id = :parentGoalId', {
          parentGoalId: filters.parentGoalId,
        });
      }
    }

    return query.orderBy('goal.createdAt', 'DESC').getMany();
  }

  async findOne(id: string): Promise<Goal> {
    const goal = await this.goalRepo.findOne({
      where: { id },
      relations: [
        'organization',
        'team',
        'parentGoal',
        'childGoals',
        'ownerHollon',
        'projects',
      ],
    });
    if (!goal) {
      throw new NotFoundException(`Goal #${id} not found`);
    }
    return goal;
  }

  async update(id: string, dto: UpdateGoalDto): Promise<Goal> {
    const goal = await this.findOne(id);
    Object.assign(goal, dto);
    return this.goalRepo.save(goal);
  }

  async remove(id: string): Promise<void> {
    const goal = await this.findOne(id);
    await this.goalRepo.remove(goal);
  }

  // Progress tracking
  async recordProgress(
    goalId: string,
    dto: RecordProgressDto,
  ): Promise<GoalProgressRecord> {
    const goal = await this.findOne(goalId);

    // Create progress record
    const progressRecord = this.progressRepo.create({
      goalId,
      progressPercent: dto.progressPercent,
      currentValue: dto.currentValue,
      note: dto.note,
      recordedBy: dto.recordedBy,
    });

    await this.progressRepo.save(progressRecord);

    // Update goal's current progress
    goal.progressPercent = dto.progressPercent;
    if (dto.currentValue !== undefined) {
      goal.currentValue = dto.currentValue;
    }

    // Auto-complete if progress reaches 100%
    if (dto.progressPercent >= 100 && goal.status === GoalStatus.ACTIVE) {
      goal.status = GoalStatus.COMPLETED;
      goal.completedAt = new Date();
    }

    await this.goalRepo.save(goal);

    return progressRecord;
  }

  async getProgressHistory(goalId: string): Promise<GoalProgressRecord[]> {
    return this.progressRepo.find({
      where: { goalId },
      order: { recordedAt: 'DESC' },
      relations: ['recordedByHollon'],
    });
  }

  async getChildGoals(parentGoalId: string): Promise<Goal[]> {
    return this.goalRepo.find({
      where: { parentGoalId },
      order: { createdAt: 'ASC' },
    });
  }

  async calculateAggregatedProgress(goalId: string): Promise<number> {
    const childGoals = await this.getChildGoals(goalId);

    if (childGoals.length === 0) {
      const goal = await this.findOne(goalId);
      return goal.progressPercent;
    }

    // Calculate weighted average based on child goals
    const totalProgress = childGoals.reduce(
      (sum, child) => sum + child.progressPercent,
      0,
    );
    return totalProgress / childGoals.length;
  }
}
