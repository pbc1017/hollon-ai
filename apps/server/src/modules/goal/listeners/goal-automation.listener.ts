import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promisify } from 'util';
import { exec } from 'child_process';
import { Goal, GoalStatus } from '../entities/goal.entity';
import { Task, TaskStatus, TaskType } from '../../task/entities/task.entity';
import { TaskPullRequest } from '../../collaboration/entities/task-pull-request.entity';
import { GoalDecompositionService } from '../services/goal-decomposition.service';
import { TaskExecutionService } from '../../orchestration/services/task-execution.service';
import { HollonOrchestratorService } from '../../orchestration/services/hollon-orchestrator.service';
import { DecompositionStrategy } from '../dto/decomposition-options.dto';
import { TaskService } from '../../task/task.service';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { Team } from '../../team/entities/team.entity';

const execAsync = promisify(exec);

/**
 * GoalAutomationListener: Goal-to-PR 워크플로우 자동화
 *
 * Phase 3.12+ 완전 자동화 (모든 Cron 1분 간격):
 * 1. 새로 생성된 Goal 감지 → 자동 Decomposition (매 1분)
 * 2. Team Epic → Implementation Tasks 분해 (매 1분)
 * 3. 할당된 PENDING Task 감지 → 자동 Execution (매 1분)
 * 4. READY_FOR_REVIEW Task → Manager Review (매 1분)
 * 5. IN_REVIEW Task 감지 → 자동 Review 및 Complete (매 1분)
 *
 * 통일된 1분 간격 설계:
 * - 모든 단계가 1분 간격으로 실행되어 최대 처리 속도 달성
 * - Goal 생성 후 약 5분 내에 전체 워크플로우 완료 가능
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
    @InjectRepository(TaskPullRequest)
    private readonly prRepo: Repository<TaskPullRequest>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    private readonly goalDecompositionService: GoalDecompositionService,
    private readonly taskExecutionService: TaskExecutionService,
    private readonly hollonOrchestratorService: HollonOrchestratorService,
    private readonly taskService: TaskService,
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
          // Phase 4: Edge case check - ensure goal is still ACTIVE
          if (goal.status !== GoalStatus.ACTIVE) {
            this.logger.debug(
              `Skipping goal ${goal.id}: status is ${goal.status}, expected ACTIVE`,
            );
            continue;
          }

          // Phase 4: Edge case check - skip if Team Epics already exist
          // Tasks are related to goals through projects, so we need to find projects first
          const projects = await this.taskRepo.manager
            .getRepository('Project')
            .find({
              where: {
                goalId: goal.id,
              },
            });

          if (projects.length > 0) {
            const projectIds = projects.map((p: any) => p.id);

            // Use query builder to check for team epics with IN operator
            const existingTeamEpics = await this.taskRepo
              .createQueryBuilder('task')
              .where('task.projectId IN (:...projectIds)', { projectIds })
              .andWhere('task.type = :type', { type: 'team_epic' })
              .getCount();

            if (existingTeamEpics > 0) {
              this.logger.debug(
                `Skipping goal ${goal.id}: ${existingTeamEpics} Team Epic(s) already exist`,
              );
              continue;
            }
          }

          this.logger.log(`Auto-decomposing goal: ${goal.title} (${goal.id})`);

          const result = await this.goalDecompositionService.decomposeGoal(
            goal.id,
            {
              autoAssign: true, // 자동으로 Hollon에게 할당
              useTeamDistribution: true, // Team Epic 생성 (계층적 분배)
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
   * Step 1.3: 자동 Manager 할당 (Phase 4)
   * 매 1분마다 team_epic 태스크에 manager hollon 자동 할당
   *
   * 워크플로우:
   * - team_epic이면서 assignedTeamId는 있지만 assignedHollonId가 없는 태스크 찾기
   * - 해당 팀의 manager를 태스크에 할당
   */
  @Cron('*/1 * * * *') // 1분마다
  async autoAssignManagersToTeamEpics(): Promise<void> {
    try {
      this.logger.debug(
        'Checking for team epics needing manager assignment...',
      );

      // team_epic이면서 manager가 할당되지 않은 태스크 찾기
      const unassignedEpics = await this.taskRepo
        .createQueryBuilder('task')
        .where('task.type = :type', { type: 'team_epic' })
        .andWhere('task.assignedTeamId IS NOT NULL')
        .andWhere('task.assignedHollonId IS NULL')
        .andWhere('task.status != :completed', {
          completed: TaskStatus.COMPLETED,
        })
        .leftJoinAndSelect('task.assignedTeam', 'team')
        .leftJoinAndSelect('team.manager', 'manager')
        .take(10) // 한 번에 최대 10개까지 처리
        .getMany();

      if (unassignedEpics.length === 0) {
        this.logger.debug('No team epics need manager assignment');
        return;
      }

      this.logger.log(
        `Found ${unassignedEpics.length} team epics needing manager assignment`,
      );

      let assignedCount = 0;
      for (const task of unassignedEpics) {
        try {
          if (!task.assignedTeam?.manager) {
            this.logger.warn(
              `Team ${task.assignedTeamId} has no manager - skipping task ${task.id}`,
            );
            continue;
          }

          const manager = task.assignedTeam.manager;

          // Manager 할당
          task.assignedHollonId = manager.id;
          await this.taskRepo.save(task);

          this.logger.log(
            `✅ Assigned team epic "${task.title}" to manager ${manager.name}`,
          );
          assignedCount++;
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to assign manager to task ${task.id}: ${err.message}`,
            err.stack,
          );
          // 에러가 발생해도 다음 태스크는 계속 처리
        }
      }

      if (assignedCount > 0) {
        this.logger.log(
          `Successfully assigned ${assignedCount} team epics to managers`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Manager assignment automation failed: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Step 1.5: 자동 Team Epic Decomposition (Phase 3.8+)
   * 매 1분 30초마다 team_epic 태스크를 찾아서 team manager에게 분해 요청
   *
   * 워크플로우:
   * - PENDING/READY 상태의 team_epic 태스크 찾기
   * - 해당 팀의 manager hollon 찾기
   * - Manager의 runCycle 실행 → team_epic pull → decompose
   */
  @Cron('*/1 * * * *') // 1분마다 (Goal decomposition과 동일 간격)
  async autoDecomposeTeamEpics(): Promise<void> {
    try {
      this.logger.debug('Checking for team epics that need decomposition...');

      // PENDING/READY 상태의 team_epic 태스크 찾기
      const teamEpics = await this.taskRepo
        .createQueryBuilder('task')
        .where('task.type = :type', { type: 'team_epic' })
        .andWhere('task.status IN (:...statuses)', {
          statuses: [TaskStatus.PENDING, TaskStatus.READY],
        })
        .andWhere('task.assignedTeamId IS NOT NULL')
        .leftJoinAndSelect('task.assignedTeam', 'team')
        .leftJoinAndSelect('team.manager', 'manager')
        .take(5) // 한 번에 최대 5개까지만 처리
        .getMany();

      if (teamEpics.length === 0) {
        this.logger.debug('No team epics need decomposition');
        return;
      }

      this.logger.log(
        `Found ${teamEpics.length} team epics ready for manager decomposition`,
      );

      // Group by manager to avoid running same manager multiple times
      const tasksByManager = new Map<string, Task[]>();
      for (const task of teamEpics) {
        if (task.assignedTeam?.manager) {
          const managerId = task.assignedTeam.manager.id;
          if (!tasksByManager.has(managerId)) {
            tasksByManager.set(managerId, []);
          }
          tasksByManager.get(managerId)!.push(task);
        } else {
          this.logger.warn(
            `Team ${task.assignedTeamId} has no manager assigned - skipping task ${task.id}`,
          );
        }
      }

      // Run cycle for each manager (they will pull and decompose team epics)
      for (const [managerId, tasks] of tasksByManager.entries()) {
        try {
          const managerName = tasks[0].assignedTeam?.manager?.name || 'Unknown';
          this.logger.log(
            `Manager ${managerName} processing ${tasks.length} team epic(s)`,
          );

          const result =
            await this.hollonOrchestratorService.runCycle(managerId);

          if (result.success) {
            this.logger.log(
              `✅ Manager ${managerName} decomposed team epic: ${result.taskTitle}`,
            );
          } else {
            this.logger.warn(
              `⚠️ Manager ${managerName} cycle failed: ${result.error || 'Unknown error'}`,
            );
          }
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to run cycle for manager ${managerId}: ${err.message}`,
            err.stack,
          );
          // 에러가 발생해도 다음 Manager는 계속 처리
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Team epic decomposition automation failed: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Step 4: 자동 Implementation Task 할당 (Phase 4)
   * 매 1분마다 PENDING 상태의 Implementation Task를 팀원에게 자동 할당
   *
   * 워크플로우:
   * - PENDING 상태의 implementation 태스크 찾기
   * - 해당 태스크의 부모 Team Epic에서 매니저 확인
   * - 매니저의 팀원(subordinates) 목록 조회
   * - 워크로드 밸런싱: 각 팀원의 IN_PROGRESS 태스크 수 확인
   * - 가장 여유로운 팀원에게 할당 및 status → READY로 변경
   */
  @Cron('*/1 * * * *') // 1분마다
  async autoAssignTasks(): Promise<void> {
    try {
      this.logger.debug(
        'Checking for implementation tasks needing assignment...',
      );

      // PENDING 상태이면서 팀원에게 할당되지 않은 implementation 태스크 찾기
      const unassignedTasks = await this.taskRepo
        .createQueryBuilder('task')
        .where('task.status = :status', { status: TaskStatus.PENDING })
        .andWhere('task.type != :teamEpic', { teamEpic: 'team_epic' })
        .andWhere('task.assignedHollonId IS NULL')
        .andWhere('task.parentTaskId IS NOT NULL') // 부모 Team Epic이 있는 태스크만
        .leftJoinAndSelect('task.parentTask', 'parentTask')
        .leftJoinAndSelect('parentTask.assignedHollon', 'manager')
        .leftJoinAndSelect('manager.subordinates', 'subordinates')
        .take(10) // 한 번에 최대 10개까지 처리
        .getMany();

      if (unassignedTasks.length === 0) {
        this.logger.debug('No implementation tasks need assignment');
        return;
      }

      this.logger.log(
        `Found ${unassignedTasks.length} implementation tasks needing assignment`,
      );

      let assignedCount = 0;
      for (const task of unassignedTasks) {
        try {
          // 부모 Team Epic의 매니저 확인
          if (!task.parentTask?.assignedHollon) {
            this.logger.warn(
              `Task ${task.id} has no parent task manager - skipping`,
            );
            continue;
          }

          const manager = task.parentTask.assignedHollon;

          // 매니저의 팀원(subordinates) 확인
          if (!manager.subordinates || manager.subordinates.length === 0) {
            this.logger.warn(
              `Manager ${manager.name} has no subordinates - skipping task ${task.id}`,
            );
            continue;
          }

          // 워크로드 밸런싱: 각 팀원의 현재 IN_PROGRESS 태스크 수 확인
          const workloads = await Promise.all(
            manager.subordinates.map(async (subordinate) => {
              const inProgressCount = await this.taskRepo.count({
                where: {
                  assignedHollonId: subordinate.id,
                  status: TaskStatus.IN_PROGRESS,
                },
              });

              return {
                hollon: subordinate,
                workload: inProgressCount,
              };
            }),
          );

          // 가장 여유로운 팀원 찾기 (IN_PROGRESS 태스크가 가장 적은 팀원)
          const selectedMember = workloads.reduce((min, current) =>
            current.workload < min.workload ? current : min,
          );

          // 태스크 할당 및 상태 변경
          task.assignedHollonId = selectedMember.hollon.id;
          task.status = TaskStatus.READY;
          await this.taskRepo.save(task);

          this.logger.log(
            `✅ Assigned task "${task.title}" to ${selectedMember.hollon.name} (workload: ${selectedMember.workload})`,
          );
          assignedCount++;
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to assign task ${task.id}: ${err.message}`,
            err.stack,
          );
          // 에러가 발생해도 다음 태스크는 계속 처리
        }
      }

      if (assignedCount > 0) {
        this.logger.log(
          `Successfully assigned ${assignedCount} implementation tasks to team members`,
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Task assignment automation failed: ${err.message}`,
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
  @Cron('*/1 * * * *') // 1분마다
  async autoExecuteTasks(): Promise<void> {
    try {
      this.logger.debug('Checking for tasks ready for execution...');

      // Phase 4: Global concurrent execution limit (increased for subtasks)
      const MAX_CONCURRENT_TASKS = 10;

      // Check how many implementation tasks are currently executing (exclude team_epic)
      const currentlyExecuting = await this.taskRepo.count({
        where: {
          status: TaskStatus.IN_PROGRESS,
          type: TaskType.IMPLEMENTATION, // ✅ Only count implementation tasks
        },
      });

      const availableSlots = MAX_CONCURRENT_TASKS - currentlyExecuting;

      if (availableSlots <= 0) {
        this.logger.warn(
          `Maximum concurrent tasks limit reached (${currentlyExecuting}/${MAX_CONCURRENT_TASKS}), skipping auto-execution`,
        );
        return;
      }

      this.logger.debug(
        `Available execution slots: ${availableSlots}/${MAX_CONCURRENT_TASKS} (${currentlyExecuting} currently in progress)`,
      );

      // Phase 4: Pull-based task assignment for idle hollons
      // Find idle permanent hollons and let them pull tasks from the pool
      const idleHollons = await this.hollonRepo
        .createQueryBuilder('h')
        .leftJoin(
          Task,
          't',
          't.assignedHollonId = h.id AND t.status = :inProgress',
          { inProgress: TaskStatus.IN_PROGRESS },
        )
        .where('h.lifecycle = :permanent', { permanent: 'permanent' })
        .andWhere('t.id IS NULL') // No IN_PROGRESS tasks
        .limit(availableSlots)
        .getMany();

      this.logger.debug(`Found ${idleHollons.length} idle hollons`);

      // Let idle hollons pull tasks from the pool
      for (const hollon of idleHollons) {
        try {
          this.logger.log(`Idle hollon ${hollon.name} pulling next task...`);
          await this.hollonOrchestratorService.runCycle(hollon.id);
        } catch (error) {
          this.logger.error(
            `Failed to run cycle for idle hollon ${hollon.name}: ${error instanceof Error ? error.message : 'Unknown error'}`,
          );
          // Continue with other hollons
        }
      }

      // READY 상태이고 Hollon에게 할당된 Task 찾기 (legacy pre-assigned tasks)
      const readyTasks = await this.taskRepo
        .createQueryBuilder('task')
        .where('task.status = :status', { status: TaskStatus.READY })
        .andWhere('task.assignedHollonId IS NOT NULL')
        .andWhere('task.type != :teamEpic', { teamEpic: 'team_epic' })
        .leftJoinAndSelect('task.project', 'project')
        .leftJoinAndSelect('task.assignedHollon', 'hollon')
        .take(Math.min(availableSlots, 5)) // Take minimum of available slots and 5
        .getMany();

      this.logger.log(`🔍 Query returned ${readyTasks.length} tasks`);

      if (readyTasks.length > 0) {
        this.logger.log(
          `First task: ${readyTasks[0].id}, project: ${readyTasks[0].project?.id}, workingDir: ${readyTasks[0].project?.workingDirectory}`,
        );
      }

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

          // Dependency 체크 (Phase 4: Critical!)
          const canExecuteResult = await this.taskService.canExecute(task.id);
          if (!canExecuteResult.canExecute) {
            this.logger.log(
              `Task ${task.id} cannot execute: ${canExecuteResult.reason}`,
            );
            if (
              canExecuteResult.blockedBy &&
              canExecuteResult.blockedBy.length > 0
            ) {
              this.logger.log(
                `  Blocked by: ${canExecuteResult.blockedBy.map((t: Task) => `${t.title} (${t.id})`).join(', ')}`,
              );
            }
            continue;
          }

          // Phase 4: Manager Execution Prevention Check
          // Managers (hollons with subordinates) should not execute implementation tasks
          // They should delegate to their team members instead
          const assignedHollon = task.assignedHollon;
          if (assignedHollon) {
            // Load subordinates if not already loaded
            const hollonWithSubordinates = await this.taskRepo.manager
              .getRepository('Hollon')
              .findOne({
                where: { id: assignedHollon.id },
                relations: ['subordinates'],
              });

            if (
              hollonWithSubordinates?.subordinates &&
              hollonWithSubordinates.subordinates.length > 0
            ) {
              this.logger.warn(
                `Task ${task.id} assigned to manager ${assignedHollon.name} ` +
                  `with ${hollonWithSubordinates.subordinates.length} subordinates - ` +
                  `managers should not execute implementation tasks, skipping`,
              );
              continue;
            }
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

          // CI 실패 retry 처리
          if (err.message.startsWith('CI_FAILURE_RETRY:')) {
            this.logger.warn(
              `Task ${task.id} CI failed, will retry: ${err.message}`,
            );
            // Task를 READY로 되돌려서 다음 cycle에 재실행
            await this.taskRepo.update(task.id, {
              status: TaskStatus.READY,
            });
            continue; // 다음 task로
          }

          // 최대 retry 초과
          if (err.message.startsWith('CI_FAILURE_MAX_RETRIES:')) {
            this.logger.error(
              `Task ${task.id} failed after max retries: ${err.message}`,
            );
            await this.taskRepo.update(task.id, {
              status: TaskStatus.FAILED,
            });
            continue;
          }

          // 일반 에러
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
  /**
   * Step 2.3: 자동 부모 태스크 리뷰 준비 (Phase 4)
   * 매 1분마다 PENDING 상태의 부모 태스크를 찾아서
   * 모든 자식 태스크가 COMPLETED면 READY_FOR_REVIEW로 전환
   *
   * SSOT Line 185-189:
   * - 부모 태스크는 PENDING 상태로 대기
   * - 서브태스크 모두 완료 시 → READY_FOR_REVIEW
   * - 리뷰 사이클은 Priority 0으로 부모 홀론이 담당
   */
  @Cron('*/1 * * * *') // 1분마다
  async autoTransitionParentsToReview(): Promise<void> {
    try {
      this.logger.debug(
        'Checking for parent tasks ready for review transition...',
      );

      // PENDING 상태이면서 자식 태스크가 있는 부모 태스크 찾기
      const parentTasks = await this.taskRepo
        .createQueryBuilder('task')
        .where('task.status = :status', { status: TaskStatus.PENDING })
        .andWhere('task.parentTaskId IS NULL') // 최상위 부모만 (또는 parentTaskId가 있어도 자식을 가진 태스크)
        .leftJoinAndSelect('task.subtasks', 'subtasks')
        .take(10) // 한 번에 최대 10개까지 처리
        .getMany();

      if (parentTasks.length === 0) {
        this.logger.debug('No parent tasks in PENDING state');
        return;
      }

      // 실제로 자식이 있고 모든 자식이 완료된 부모만 필터링
      const parentsReadyForReview = parentTasks.filter((task) => {
        if (!task.subtasks || task.subtasks.length === 0) {
          return false; // 자식이 없으면 제외
        }

        // 모든 자식이 COMPLETED 상태인지 확인
        const allChildrenCompleted = task.subtasks.every(
          (subtask) => subtask.status === TaskStatus.COMPLETED,
        );

        return allChildrenCompleted;
      });

      if (parentsReadyForReview.length === 0) {
        this.logger.debug('No parent tasks have all children completed');
        return;
      }

      this.logger.log(
        `Found ${parentsReadyForReview.length} parent task(s) ready for review`,
      );

      for (const task of parentsReadyForReview) {
        try {
          this.logger.log(
            `Transitioning parent task "${task.title}" (${task.id}) to READY_FOR_REVIEW`,
          );

          // SSOT: 부모 태스크 → READY_FOR_REVIEW
          // reviewerHollonId는 creatorHollonId (부모 홀론이 자신의 작업 리뷰)
          await this.taskRepo.update(task.id, {
            status: TaskStatus.READY_FOR_REVIEW,
            reviewerHollonId: task.creatorHollonId,
          });

          this.logger.log(
            `✅ Parent task ${task.id} transitioned to READY_FOR_REVIEW (${task.subtasks.length} children completed)`,
          );
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to transition parent task ${task.id}: ${err.message}`,
            err.stack,
          );
          // 에러가 발생해도 다음 태스크는 계속 처리
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Parent task review transition failed: ${err.message}`,
        err.stack,
      );
    }
  }

  /**
   * Phase 4: PR 생성 후 CI 상태 체크
   *
   * IN_REVIEW 상태이면서 PR이 있는 Task들의 CI 상태를 체크합니다.
   * - CI 통과: READY_FOR_REVIEW로 전환 (매니저 리뷰 대기)
   * - CI 실패: 재시도 로직 실행
   *
   * 워크플로우:
   * 1. IN_REVIEW 상태 Task 중 PR이 있는 것들 찾기
   * 2. 각 PR의 CI 상태 체크 (gh pr checks)
   * 3. CI 통과 → READY_FOR_REVIEW로 전환
   * 4. CI 실패 → handleCIFailure() 호출, 재시도
   */
  @Cron('*/1 * * * *') // 1분마다
  async autoCheckPRCI(): Promise<void> {
    try {
      this.logger.debug('Checking CI status for PRs...');

      // IN_REVIEW 상태이면서 PR이 있는 Task 찾기
      const tasksWithPRs = await this.taskRepo
        .createQueryBuilder('task')
        .where('task.status = :status', { status: TaskStatus.IN_REVIEW })
        .leftJoinAndSelect('task.assignedHollon', 'hollon')
        .leftJoinAndSelect('task.project', 'project')
        .take(5) // 한 번에 최대 5개까지 처리
        .getMany();

      if (tasksWithPRs.length === 0) {
        this.logger.debug('No tasks with PRs in IN_REVIEW status');
        return;
      }

      // 각 Task의 PR 찾기
      for (const task of tasksWithPRs) {
        try {
          // Task에 연결된 PR 찾기
          const prs = await this.prRepo.find({
            where: { taskId: task.id },
            order: { createdAt: 'DESC' },
          });

          if (prs.length === 0) {
            this.logger.debug(`No PR found for task ${task.id}, skipping`);
            continue;
          }

          const pr = prs[0]; // 가장 최근 PR 사용

          // 테스트 환경에서는 CI 체크 스킵
          if (process.env.NODE_ENV === 'test') {
            this.logger.debug(
              `Skipping CI check in test environment for task ${task.id}`,
            );
            // 테스트 환경에서는 바로 READY_FOR_REVIEW로 전환
            task.status = TaskStatus.READY_FOR_REVIEW;
            await this.taskRepo.save(task);
            this.logger.log(
              `✅ Task ${task.id} moved to READY_FOR_REVIEW (test mode)`,
            );
            continue;
          }

          this.logger.log(
            `Checking CI status for PR #${pr.prNumber} (task ${task.id})`,
          );

          // gh pr checks로 CI 상태 확인
          try {
            const { stdout } = await execAsync(
              `gh pr checks ${pr.prUrl} --json state,name`,
            );

            const checks = JSON.parse(stdout.trim()) as Array<{
              state: string;
              name?: string;
            }>;

            // 모든 체크가 성공했는지 확인
            const hasFailedChecks = checks.some(
              (check) => check.state !== 'success',
            );

            const hasPendingChecks = checks.some(
              (check) =>
                check.state === 'pending' ||
                check.state === 'in_progress' ||
                check.state === null,
            );

            if (hasPendingChecks) {
              this.logger.debug(
                `CI checks still pending for PR #${pr.prNumber}, will check again later`,
              );
              continue; // CI가 아직 진행 중이면 다음 크론 사이클에서 다시 체크
            }

            if (hasFailedChecks) {
              // CI 실패 - 재시도 로직 실행
              this.logger.warn(
                `CI checks failed for PR #${pr.prNumber}, initiating retry logic`,
              );

              // Get task metadata
              const metadata = (task.metadata || {}) as Record<string, unknown>;
              const currentRetryCount = (metadata.ciRetryCount as number) || 0;
              const maxRetries = 3;

              // Get failed check names and detailed CI logs
              const failedCheckNames = checks
                .filter((check) => check.state !== 'success')
                .map((check) => check.name || 'Unknown check')
                .filter((name): name is string => name !== undefined);

              let ciLogs = '';
              try {
                const { stdout } = await execAsync(
                  `gh pr checks ${pr.prUrl} --json name,state,detailsUrl`,
                );
                const detailedChecks = JSON.parse(stdout.trim()) as Array<{
                  name: string;
                  state: string;
                  detailsUrl: string;
                }>;
                const failedDetails = detailedChecks
                  .filter((check) => check.state !== 'success')
                  .map((check) => `${check.name}: ${check.detailsUrl}`)
                  .join('\n');
                ciLogs =
                  failedDetails ||
                  `Failed checks: ${failedCheckNames.join(', ')}`;
              } catch {
                this.logger.debug('Could not fetch detailed CI logs');
                ciLogs = `Failed checks: ${failedCheckNames.join(', ')}`;
              }

              if (currentRetryCount < maxRetries) {
                // 재시도 가능
                this.logger.log(
                  `Retrying task ${task.id} (attempt ${currentRetryCount + 1}/${maxRetries})`,
                );

                // Create feedback message for the brain
                const feedback = `
CI Checks Failed (Attempt ${currentRetryCount + 1}/${maxRetries}):

${ciLogs}

The following CI checks failed:
${failedCheckNames.map((check) => `- ${check}`).join('\n')}

Please review the CI errors and fix the issues in your code. 
${currentRetryCount + 1 < maxRetries ? 'You will have another chance to fix this.' : 'This is the final attempt.'}

Make sure to:
1. Review the error messages carefully
2. Fix any linting, type, or test failures
3. Ensure all tests pass locally before committing
`.trim();

                // Task를 READY로 설정하여 pullNextTask에서 선택될 수 있도록 함
                task.status = TaskStatus.READY;
                task.metadata = {
                  ...metadata,
                  ciRetryCount: currentRetryCount + 1,
                  lastCIFailure: new Date().toISOString(),
                  lastCIFailedChecks: failedCheckNames,
                  lastCIFeedback: feedback, // Store feedback for next execution
                } as Record<string, unknown>;
                await this.taskRepo.save(task);

                this.logger.log(
                  `Task ${task.id} metadata updated with CI feedback`,
                );

                // Hollon에게 재실행 요청
                if (task.assignedHollonId) {
                  this.logger.log(
                    `Re-executing task ${task.id} with hollon ${task.assignedHollonId}`,
                  );
                  await this.hollonOrchestratorService.runCycle(
                    task.assignedHollonId,
                  );
                }
              } else {
                // 최대 재시도 횟수 초과
                this.logger.error(
                  `Task ${task.id} exceeded max retries (${maxRetries}), marking as FAILED`,
                );
                task.status = TaskStatus.FAILED;
                task.metadata = {
                  ...metadata,
                  failureReason: 'CI checks failed after maximum retries',
                } as Record<string, unknown>;
                await this.taskRepo.save(task);
              }
            } else {
              // CI 통과 - READY_FOR_REVIEW로 전환
              this.logger.log(
                `✅ All CI checks passed for PR #${pr.prNumber}, moving task ${task.id} to READY_FOR_REVIEW`,
              );

              task.status = TaskStatus.READY_FOR_REVIEW;
              await this.taskRepo.save(task);

              this.logger.log(
                `Task ${task.id} is now ready for manager review`,
              );
            }
          } catch (error) {
            const err = error as Error;

            // gh CLI 명령어 실패 (예: PR이 아직 CI 설정이 없는 경우)
            if (err.message.includes('no checks reported')) {
              this.logger.warn(
                `No CI checks configured for PR #${pr.prNumber}, moving to READY_FOR_REVIEW`,
              );
              task.status = TaskStatus.READY_FOR_REVIEW;
              await this.taskRepo.save(task);
            } else {
              this.logger.error(
                `Failed to check CI status for PR #${pr.prNumber}: ${err.message}`,
              );
              // CI 상태 체크 실패해도 다음 사이클에서 재시도
            }
          }
        } catch (error) {
          const err = error as Error;
          this.logger.error(
            `Failed to process CI check for task ${task.id}: ${err.message}`,
            err.stack,
          );
          // 에러가 발생해도 다음 Task는 계속 처리
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `PR CI check automation failed: ${err.message}`,
        err.stack,
      );
    }
  }

  @Cron('*/1 * * * *') // 1분마다
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
  @Cron('*/1 * * * *') // 1분마다
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

  /**
   * Phase 1.5: 대기 중인 Task를 사용 가능한 Hollon에 할당
   *
   * Hollon 한도에 도달하여 WAITING_FOR_HOLLON 상태가 된 Task들을
   * 주기적으로 확인하고, Hollon 슬롯이 확보되면 다시 실행 시도
   *
   * 실행 주기: 30초마다 (빠른 대응을 위해 1분보다 짧게 설정)
   */
  @Cron('*/30 * * * * *') // 30초마다 실행
  async assignWaitingTasks(): Promise<void> {
    try {
      // 1. WAITING_FOR_HOLLON 상태인 Task 조회 (FIFO 순서)
      const waitingTasks = await this.taskRepo
        .createQueryBuilder('task')
        .where('task.status = :status', {
          status: TaskStatus.WAITING_FOR_HOLLON,
        })
        .leftJoinAndSelect('task.project', 'project')
        .leftJoinAndSelect('project.assignedTeam', 'assignedTeam')
        .orderBy('task.createdAt', 'ASC') // FIFO: 먼저 대기한 Task부터
        .take(50) // 한 번에 최대 50개 확인
        .getMany();

      if (waitingTasks.length === 0) {
        this.logger.debug('No tasks waiting for hollon slots');
        return;
      }

      this.logger.log(
        `Found ${waitingTasks.length} tasks waiting for hollon slots`,
      );

      // 2. Team별로 그룹화
      const tasksByTeam = new Map<string, Task[]>();
      for (const task of waitingTasks) {
        const teamId = task.project?.assignedTeam?.id;
        if (!teamId) {
          this.logger.warn(`Task ${task.id} has no team - skipping`);
          continue;
        }

        if (!tasksByTeam.has(teamId)) {
          tasksByTeam.set(teamId, []);
        }
        tasksByTeam.get(teamId)!.push(task);
      }

      // 3. Team별로 사용 가능한 Hollon 슬롯 확인 및 Task 할당
      for (const [teamId, tasks] of tasksByTeam.entries()) {
        try {
          // Team의 현재 Hollon 수 확인
          const currentHollonCount = await this.hollonRepo.count({
            where: { teamId },
          });

          // Team 설정에서 최대 Hollon 수 확인
          const team = await this.teamRepo.findOne({
            where: { id: teamId },
            relations: ['organization'],
          });

          if (!team) {
            this.logger.warn(`Team ${teamId} not found`);
            continue;
          }

          const maxHollons =
            (team.organization?.settings?.['maxHollonsPerTeam'] as number) ||
            10;
          const availableSlots = maxHollons - currentHollonCount;

          if (availableSlots <= 0) {
            this.logger.debug(
              `Team ${team.name} has no available hollon slots (${currentHollonCount}/${maxHollons})`,
            );
            continue;
          }

          this.logger.log(
            `Team ${team.name} has ${availableSlots} available hollon slots - processing ${Math.min(availableSlots, tasks.length)} waiting tasks`,
          );

          // 4. 사용 가능한 슬롯만큼 Task를 READY로 변경
          const tasksToAssign = tasks.slice(0, availableSlots);

          for (const task of tasksToAssign) {
            try {
              // Task를 다시 READY 상태로 변경하여 재시도
              await this.taskRepo.update(task.id, {
                status: TaskStatus.READY,
              });

              this.logger.log(
                `Task ${task.id} (${task.title}) changed from WAITING_FOR_HOLLON → READY`,
              );
            } catch (updateError) {
              this.logger.error(
                `Failed to update task ${task.id}: ${updateError instanceof Error ? updateError.message : 'Unknown error'}`,
              );
              // Continue with next task
            }
          }
        } catch (teamError) {
          this.logger.error(
            `Failed to process team ${teamId}: ${teamError instanceof Error ? teamError.message : 'Unknown error'}`,
          );
          // Continue with next team
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(
        `Waiting task assignment failed: ${err.message}`,
        err.stack,
      );
    }
  }
}
