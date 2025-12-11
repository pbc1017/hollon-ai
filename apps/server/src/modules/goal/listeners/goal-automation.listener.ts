import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Goal, GoalStatus } from '../entities/goal.entity';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import { GoalDecompositionService } from '../services/goal-decomposition.service';
import { TaskExecutionService } from '../../orchestration/services/task-execution.service';
import { HollonOrchestratorService } from '../../orchestration/services/hollon-orchestrator.service';
import { DecompositionStrategy } from '../dto/decomposition-options.dto';

/**
 * GoalAutomationListener: Goal-to-PR 워크플로우 자동화
 *
 * Phase 3.12 완전 자동화:
 * 1. 새로 생성된 Goal 감지 → 자동 Decomposition (매 1분)
 * 2. 할당된 PENDING Task 감지 → 자동 Execution (매 2분)
 * 3. IN_REVIEW Task 감지 → 자동 Review 및 Complete (매 3분)
 *
 * 차등 간격 설계:
 * - Goal 분해: 1분 (빠른 피드백)
 * - Task 실행: 2분 (적절한 간격)
 * - Task 리뷰: 3분 (충분한 처리 시간)
 * - 총 소요 시간: 최대 6분 (1분 + 2분 + 3분)
 *
 * 프로덕션 환경에서 Goal API만 호출하면 전체 워크플로우가 자동으로 처리됨
 */
@Injectable()
export class GoalAutomationListener {
  private readonly logger = new Logger(GoalAutomationListener.name);

  constructor(
    @InjectRepository(Goal)
    private readonly goalRepo: Repository<Goal>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly goalDecompositionService: GoalDecompositionService,
    private readonly taskExecutionService: TaskExecutionService,
    private readonly hollonOrchestratorService: HollonOrchestratorService,
  ) {}

  /**
   * Step 1: 자동 Goal Decomposition
   * 매 1분마다 아직 분해되지 않은 Goal을 찾아서 자동으로 Task 생성
   *
   * 빠른 피드백: Goal 생성 직후 신속하게 분해 시작
   */
  @Cron('*/1 * * * *') // 1분마다
  async autoDecomposeGoals(): Promise<void> {
    try {
      this.logger.debug('Checking for goals that need decomposition...');

      // autoDecomposed가 false인 active 상태의 Goal 찾기
      const pendingGoals = await this.goalRepo.find({
        where: {
          autoDecomposed: false,
          status: GoalStatus.ACTIVE,
        },
        take: 10, // 한 번에 최대 10개까지만 처리
      });

      if (pendingGoals.length === 0) {
        this.logger.debug('No goals need decomposition');
        return;
      }

      this.logger.log(
        `Found ${pendingGoals.length} goals to decompose automatically`,
      );

      for (const goal of pendingGoals) {
        try {
          this.logger.log(`Auto-decomposing goal: ${goal.title} (${goal.id})`);

          const result = await this.goalDecompositionService.decomposeGoal(
            goal.id,
            {
              autoAssign: true, // 자동으로 Hollon에게 할당
              useTeamDistribution: false,
              strategy: DecompositionStrategy.TASK_BASED,
            },
          );

          this.logger.log(
            `✅ Goal decomposed: ${result.projectsCreated} projects, ${result.tasksCreated} tasks`,
          );
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to decompose goal ${goal.id}: ${err.message}`,
            err.stack,
          );
          // 에러가 발생해도 다음 Goal은 계속 처리
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Goal decomposition automation failed: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Step 2: 자동 Task Execution
   * 매 2분마다 할당되었지만 아직 실행되지 않은 Task를 찾아서 자동으로 실행
   *
   * 조건:
   * - status가 PENDING
   * - assignedHollonId가 설정됨
   * - type이 'team_epic'이 아님 (실제 작업 Task만)
   *
   * 적절한 간격: Task 생성 후 신속한 PR 생성
   */
  @Cron('*/2 * * * *') // 2분마다
  async autoExecuteTasks(): Promise<void> {
    try {
      this.logger.debug('Checking for tasks ready for execution...');

      // PENDING 상태이고 Hollon에게 할당된 Task 찾기
      const readyTasks = await this.taskRepo
        .createQueryBuilder('task')
        .where('task.status = :status', { status: TaskStatus.PENDING })
        .andWhere('task.assignedHollonId IS NOT NULL')
        .andWhere('task.type != :teamEpic', { teamEpic: 'team_epic' })
        .leftJoinAndSelect('task.project', 'project')
        .leftJoinAndSelect('task.assignedHollon', 'hollon')
        .take(5) // 한 번에 최대 5개 Task까지만 실행 (병렬 실행 방지)
        .getMany();

      if (readyTasks.length === 0) {
        this.logger.debug('No tasks ready for execution');
        return;
      }

      this.logger.log(
        `Found ${readyTasks.length} tasks ready for auto-execution`,
      );

      for (const task of readyTasks) {
        try {
          // Project에 workingDirectory가 없으면 스킵
          if (!task.project?.workingDirectory) {
            this.logger.warn(
              `Task ${task.id} skipped: project has no workingDirectory`,
            );
            continue;
          }

          this.logger.log(
            `Auto-executing task: ${task.title} (${task.id}) by ${task.assignedHollon?.name}`,
          );

          const result = await this.taskExecutionService.executeTask(
            task.id,
            task.assignedHollonId!,
          );

          this.logger.log(`✅ Task executed: PR created at ${result.prUrl}`);
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to execute task ${task.id}: ${err.message}`,
            err.stack,
          );
          // 에러가 발생해도 다음 Task는 계속 처리
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Task execution automation failed: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Step 2.5: 자동 Manager Review Cycle (Phase 3.16)
   * 매 2분마다 READY_FOR_REVIEW 상태의 서브태스크를 찾아서
   * Manager Hollon이 Temporary Review Hollon을 생성하여 리뷰 시작
   *
   * 조건:
   * - status가 READY_FOR_REVIEW
   * - reviewerHollonId가 설정됨 (Manager hollon)
   *
   * Phase 3.16 Hierarchical Review:
   * - Manager가 임시 리뷰 홀론 생성
   * - 리뷰 홀론이 코드 리뷰 수행
   * - Manager가 결과 받아서 merge/rework/add_tasks 결정
   */
  @Cron('*/2 * * * *') // 2분마다 (Task Execution과 동일한 간격)
  async autoManagerReview(): Promise<void> {
    try {
      this.logger.debug('Checking for tasks ready for manager review...');

      // READY_FOR_REVIEW 상태이고 reviewerHollonId가 설정된 Task 찾기
      const tasksForReview = await this.taskRepo
        .createQueryBuilder('task')
        .where('task.status = :status', { status: TaskStatus.READY_FOR_REVIEW })
        .andWhere('task.reviewerHollonId IS NOT NULL')
        .leftJoinAndSelect('task.reviewerHollon', 'reviewerHollon')
        .leftJoinAndSelect('reviewerHollon.role', 'role')
        .take(5) // 한 번에 최대 5개 Task까지만 처리
        .getMany();

      if (tasksForReview.length === 0) {
        this.logger.debug('No tasks ready for manager review');
        return;
      }

      this.logger.log(
        `Found ${tasksForReview.length} tasks ready for manager review`,
      );

      // Group tasks by manager hollon
      const tasksByManager = new Map<string, Task[]>();
      for (const task of tasksForReview) {
        if (task.reviewerHollonId) {
          if (!tasksByManager.has(task.reviewerHollonId)) {
            tasksByManager.set(task.reviewerHollonId, []);
          }
          tasksByManager.get(task.reviewerHollonId)!.push(task);
        }
      }

      // Process each manager's tasks
      for (const [managerHollonId, tasks] of tasksByManager.entries()) {
        try {
          const managerHollon = tasks[0].reviewerHollon;
          if (!managerHollon) {
            this.logger.warn(
              `Manager hollon ${managerHollonId} not found, skipping`,
            );
            continue;
          }

          this.logger.log(
            `Manager ${managerHollon.name} processing ${tasks.length} task(s) for review`,
          );

          // Call handleManagerReviewCycle
          await this.hollonOrchestratorService.handleManagerReviewCycle(
            managerHollon,
          );

          this.logger.log(
            `✅ Manager ${managerHollon.name} initiated reviews for ${tasks.length} task(s)`,
          );
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to process manager review for ${managerHollonId}: ${err.message}`,
            err.stack,
          );
          // 에러가 발생해도 다음 Manager는 계속 처리
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Manager review automation failed: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Step 3: 자동 Task Review
   * 매 3분마다 IN_REVIEW 상태의 Task를 찾아서 자동으로 리뷰 및 완료 처리
   *
   * 조건:
   * - status가 IN_REVIEW
   * - assignedHollonId가 설정됨
   *
   * Phase 3.10 Review Mode:
   * - LLM이 서브태스크 완료 여부 분석
   * - 4가지 액션 중 하나 실행: complete, rework, add_tasks, redirect
   *
   * 충분한 간격: PR 생성 후 리뷰 및 완료 처리
   */
  @Cron('*/3 * * * *') // 3분마다
  async autoReviewTasks(): Promise<void> {
    try {
      this.logger.debug('Checking for tasks in review...');

      // IN_REVIEW 상태이고 Hollon에게 할당된 Task 찾기
      const reviewTasks = await this.taskRepo
        .createQueryBuilder('task')
        .where('task.status = :status', { status: TaskStatus.IN_REVIEW })
        .andWhere('task.assignedHollonId IS NOT NULL')
        .leftJoinAndSelect('task.assignedHollon', 'hollon')
        .take(5) // 한 번에 최대 5개 Task까지만 리뷰 (병렬 실행 방지)
        .getMany();

      if (reviewTasks.length === 0) {
        this.logger.debug('No tasks in review');
        return;
      }

      this.logger.log(
        `Found ${reviewTasks.length} tasks ready for auto-review`,
      );

      for (const task of reviewTasks) {
        try {
          this.logger.log(
            `Auto-reviewing task: ${task.title} (${task.id}) by ${task.assignedHollon?.name}`,
          );

          // Hollon의 runCycle 실행 → handleReviewMode 진입
          const result = await this.hollonOrchestratorService.runCycle(
            task.assignedHollonId!,
          );

          if (result.success) {
            this.logger.log(`✅ Task review completed: ${result.output}`);
          } else {
            this.logger.warn(`⚠️ Task review failed: ${result.error}`);
          }
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to review task ${task.id}: ${err.message}`,
            err.stack,
          );
          // 에러가 발생해도 다음 Task는 계속 처리
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Task review automation failed: ${err.message}`,
        err.stack,
      );
    }
  }
}
