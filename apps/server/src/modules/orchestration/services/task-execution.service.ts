import { Injectable, Logger, Inject } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as path from 'path';
import * as os from 'os';
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
} from '../../task/entities/task.entity';
import { Project } from '../../project/entities/project.entity';
import {
  Hollon,
  HollonStatus,
  HollonLifecycle,
} from '../../hollon/entities/hollon.entity';
import { Team } from '../../team/entities/team.entity';
import { Organization } from '../../organization/entities/organization.entity';
import { Role } from '../../role/entities/role.entity';
import { OrganizationSettings } from '../../organization/interfaces/organization-settings.interface';
import {
  Document,
  DocumentType,
} from '../../document/entities/document.entity';
import { TaskPullRequest } from '../../collaboration/entities/task-pull-request.entity';
import { BrainProviderService } from '../../brain-provider/brain-provider.service';
import { BrainResponse } from '../../brain-provider/interfaces/brain-provider.interface';
import { ICodeReviewPort } from '../domain/ports/code-review.port';
import { QualityGateService } from './quality-gate.service';
import { IHollonService } from '../../hollon/domain/hollon-service.interface';

const execAsync = promisify(exec);

/**
 * Phase 4: Team Epic Decomposition - Work Item Interface
 */
interface DecompositionWorkItem {
  title: string;
  description: string;
  priority?: string;
  estimatedHours?: number;
  requiredSkills?: string[];
  acceptanceCriteria?: string[];
  dependencies?: string[]; // Task titles that must complete before this task
}

interface DecompositionResult {
  workItems: DecompositionWorkItem[];
  teamDistribution?: Record<string, DecompositionWorkItem[]>;
}

/**
 * Phase 3.5: Task 실행 → Worktree → 코딩 → 커밋 → PR 생성
 * Git Worktree를 활용한 격리된 작업 환경 제공
 *
 * ✅ DDD: CodeReviewService 직접 의존성 제거, ICodeReviewPort 사용
 */
@Injectable()
export class TaskExecutionService {
  private readonly logger = new Logger(TaskExecutionService.name);
  // Git operation locks to prevent concurrent access to .git/config
  private static gitLocks: Map<string, Promise<void>> = new Map();

  private async withGitLock<T>(
    repoPath: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    // Wait for any existing lock on this repository
    while (TaskExecutionService.gitLocks.has(repoPath)) {
      await TaskExecutionService.gitLocks.get(repoPath);
      await new Promise((resolve) => setTimeout(resolve, 100)); // Small delay before retry
    }

    // Create new lock
    let resolve: () => void;
    const lockPromise = new Promise<void>((r) => {
      resolve = r;
    });
    TaskExecutionService.gitLocks.set(repoPath, lockPromise);

    try {
      // Execute the operation
      return await operation();
    } finally {
      // Release the lock
      TaskExecutionService.gitLocks.delete(repoPath);
      resolve!();
    }
  }

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Organization)
    private readonly orgRepo: Repository<Organization>,
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(TaskPullRequest)
    private readonly prRepo: Repository<TaskPullRequest>,
    private readonly brainProvider: BrainProviderService,
    private readonly qualityGateService: QualityGateService,
    @Inject('ICodeReviewPort')
    private readonly codeReviewPort: ICodeReviewPort,
    @Inject('IHollonService')
    private readonly hollonService: IHollonService,
  ) {}

  /**
   * Task 실행 전체 플로우
   * Phase 3.11: Hollon별 Worktree 재사용 + Hollon 이름이 포함된 브랜치
   * Phase 3.12/4: Quality Gate + Document 저장 통합
   * 1. Hollon별 Worktree 확보 (재사용 전략)
   * 2. Hollon별 브랜치 생성
   * 3. BrainProvider 실행 (지식 주입 포함)
   * 4. Quality Gate 검증
   * 5. Document로 결과 저장
   * 6. PR 생성
   * 7. CI 체크 대기 및 검증
   * 8. CodeReview 요청
   */
  async executeTask(
    taskId: string,
    hollonId: string,
  ): Promise<{ prUrl: string | null; worktreePath: string | null }> {
    this.logger.log(`Executing task ${taskId} by hollon ${hollonId}`);

    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['project', 'project.organization', 'dependencies'],
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    if (!task.project) {
      throw new Error(`Task ${taskId} has no associated project`);
    }

    const hollon = await this.hollonRepo.findOne({
      where: { id: hollonId },
      relations: ['role'],
    });

    if (!hollon) {
      throw new Error(`Hollon ${hollonId} not found`);
    }

    // ✅ Phase 4: team_epic은 워크트리 없이 decomposition만 수행
    if (task.type === TaskType.TEAM_EPIC) {
      return await this.executeTeamEpicDecomposition(task, hollon);
    }

    // 1. Task별 Worktree 생성 (완전 격리 - Phase 3.12)
    const worktreePath = await this.getOrCreateWorktree(
      task.project,
      hollon,
      task,
    );
    this.logger.log(`Task worktree ready: ${worktreePath}`);

    // 2. Hollon별 브랜치 생성 (Phase 3.11)
    const branchName = await this.createBranch(hollon, task, worktreePath);
    this.logger.log(`Branch created: ${branchName}`);

    try {
      // 3. Task를 IN_PROGRESS로 변경
      await this.taskRepo.update(taskId, {
        status: TaskStatus.IN_PROGRESS,
        startedAt: new Date(),
      });

      // Phase 4: Check if this is a resumed task (all subtasks completed)
      const childTasks = await this.taskRepo.find({
        where: { parentTaskId: taskId },
      });

      const isResumedTask =
        childTasks.length > 0 &&
        childTasks.every((child) => child.status === TaskStatus.COMPLETED);

      if (isResumedTask) {
        this.logger.log(
          `Task ${taskId} is resumed after ${childTasks.length} subtasks completed, skipping Brain execution`,
        );
        // Skip Brain execution and go straight to PR creation
        // Use empty brain result for document saving
        const emptyBrainResult: BrainResponse = {
          success: true,
          output: `Task completed through ${childTasks.length} subtasks:\n${childTasks.map((c) => `- ${c.title}`).join('\n')}`,
          cost: { totalCostCents: 0, inputTokens: 0, outputTokens: 0 },
          duration: 0,
        };

        // Save result document
        await this.saveResultDocument(
          task,
          hollonId,
          emptyBrainResult.output,
          0,
        );

        // Create PR only for permanent hollons
        let prUrl: string | null = null;

        if (hollon.lifecycle === HollonLifecycle.PERMANENT) {
          // ✅ Phase 4: Run ESLint and Prettier before creating PR
          this.logger.log(
            `Running ESLint and Prettier before PR creation for resumed task`,
          );
          try {
            // Fix #9: Run ESLint --fix first
            await execAsync(
              `npx eslint --fix "src/**/*.{ts,tsx}" --no-error-on-unmatched-pattern || true`,
              {
                cwd: worktreePath,
              },
            );
            this.logger.log(`ESLint fix completed`);

            // Then run Prettier
            await execAsync(
              `npx prettier --write "**/*.{ts,tsx,js,jsx,json}"`,
              {
                cwd: worktreePath,
              },
            );
            this.logger.log(`Code formatted successfully`);

            // Check if ESLint/Prettier made any changes
            const { stdout: statusOut } = await execAsync(
              `git status --porcelain`,
              {
                cwd: worktreePath,
              },
            );

            if (statusOut.trim()) {
              // ESLint/Prettier made changes, commit them
              this.logger.log(`ESLint/Prettier made changes, committing...`);
              await execAsync(`git add -A`, { cwd: worktreePath });
              await execAsync(
                `git commit -m "style: Apply ESLint and Prettier fixes"`,
                {
                  cwd: worktreePath,
                },
              );
              this.logger.log(`Formatting changes committed`);
            } else {
              this.logger.log(`No formatting changes needed`);
            }
          } catch (lintError) {
            // Don't fail the task if lint/prettier fails, just log it
            this.logger.warn(
              `ESLint/Prettier failed: ${lintError instanceof Error ? lintError.message : 'Unknown error'}`,
            );
          }

          // ✅ Permanent hollon: Full PR workflow for resumed task
          prUrl = await this.createPullRequest(
            task.project,
            task,
            worktreePath,
          );
          this.logger.log(`PR created for resumed task: ${prUrl}`);

          // Phase 4.2: Save PR to database immediately (for CI monitoring)
          await this.savePRRecord(task, prUrl, hollonId, worktreePath);

          // Phase 4: Set task to IN_REVIEW for asynchronous CI monitoring
          // The autoCheckPRCI Cron will monitor CI status and handle failures
          this.logger.log(
            `Setting resumed task ${taskId} to IN_REVIEW for CI monitoring by Cron`,
          );
          await this.taskRepo.update(taskId, {
            status: TaskStatus.IN_REVIEW,
          });

          this.logger.log(
            `Resumed task ${taskId} is now IN_REVIEW - autoCheckPRCI Cron will monitor CI status`,
          );
        } else {
          // ✅ Temporary hollon: Mark as COMPLETED without PR
          this.logger.log(
            `Temporary hollon ${hollon.id.slice(0, 8)} completed resumed task ${taskId.slice(0, 8)} - marking as COMPLETED (no PR)`,
          );

          await this.taskRepo.update(taskId, {
            status: TaskStatus.COMPLETED,
            completedAt: new Date(),
          });

          // Release hollon
          await this.hollonRepo.update(hollonId, {
            status: HollonStatus.IDLE,
            currentTaskId: null as any,
          });

          // Check if parent task should resume
          await this.checkAndResumeParentTask(task);
        }

        return { prUrl, worktreePath };
      }

      // 4. BrainProvider 실행 (worktree 경로에서)
      const brainResult = await this.executeBrainProvider(
        hollon,
        task,
        worktreePath,
      );

      // 5. Quality Gate 검증 (Phase 3.12/4)
      const organization = await this.orgRepo.findOne({
        where: { id: task.project.organizationId },
      });
      const settings = (organization?.settings || {}) as OrganizationSettings;

      const qualityResult = await this.qualityGateService.validateResult({
        task,
        brainResult,
        organizationId: task.project.organizationId,
        costLimitDailyCents: settings.costLimitDailyCents,
      });

      if (!qualityResult.passed) {
        this.logger.warn(
          `Quality gate failed for task ${taskId}: ${qualityResult.reason}`,
        );

        if (qualityResult.shouldRetry) {
          throw new Error(
            `QUALITY_GATE_FAILURE: ${qualityResult.reason || 'Quality validation failed'}`,
          );
        } else {
          throw new Error(
            `QUALITY_GATE_FAILURE_NO_RETRY: ${qualityResult.reason || 'Quality validation failed - max retries'}`,
          );
        }
      }

      this.logger.log(`Quality gate passed for task ${taskId}`);

      // 6. Brain이 서브태스크 분해를 제안했는지 확인 (Phase 4: Recursive Task Decomposition)
      const shouldDecompose = this.shouldDecomposeTask(
        brainResult.output,
        task,
      );

      if (shouldDecompose) {
        this.logger.log(
          `Brain suggests decomposing task ${taskId} into subtasks`,
        );

        // 서브태스크로 분해하고 임시 Hollon들에게 할당
        await this.decomposeIntoSubtasks(
          task,
          hollon,
          worktreePath,
          brainResult.output,
        );

        // 부모 Task는 PENDING 상태로 대기 (자식들이 완료될 때까지)
        await this.taskRepo.update(taskId, {
          status: TaskStatus.PENDING,
        });

        // Hollon은 IDLE로 해방
        await this.hollonRepo.update(hollonId, {
          status: HollonStatus.IDLE,
          currentTaskId: null as any,
        });

        this.logger.log(
          `✅ Task ${taskId} decomposed into subtasks, waiting for completion`,
        );

        // 분해된 경우 PR 생성 안함
        return { prUrl: null, worktreePath };
      }

      // 7. Document로 결과 저장 (Phase 3.12/4)
      await this.saveResultDocument(
        task,
        hollonId,
        brainResult.output,
        brainResult.cost.totalCostCents,
      );

      // 7. PR 생성 (임시 홀론은 PR 생성 안함)
      let prUrl: string | null = null;

      if (hollon.lifecycle === HollonLifecycle.PERMANENT) {
        // ✅ Phase 4: Run ESLint and Prettier before creating PR
        this.logger.log(
          `Running ESLint and Prettier to fix code issues before PR creation`,
        );
        try {
          // Fix #9: Run ESLint --fix first to fix lint errors
          await execAsync(
            `npx eslint --fix "src/**/*.{ts,tsx}" --no-error-on-unmatched-pattern || true`,
            {
              cwd: worktreePath,
            },
          );
          this.logger.log(`ESLint fix completed`);

          // Then run Prettier for formatting
          await execAsync(`npx prettier --write "**/*.{ts,tsx,js,jsx,json}"`, {
            cwd: worktreePath,
          });
          this.logger.log(`Code formatted successfully`);

          // Check if ESLint/Prettier made any changes
          const { stdout: statusOut } = await execAsync(
            `git status --porcelain`,
            {
              cwd: worktreePath,
            },
          );

          if (statusOut.trim()) {
            // ESLint/Prettier made changes, commit them
            this.logger.log(`ESLint/Prettier made changes, committing...`);
            await execAsync(`git add -A`, { cwd: worktreePath });
            await execAsync(
              `git commit -m "style: Apply ESLint and Prettier fixes"`,
              {
                cwd: worktreePath,
              },
            );
            this.logger.log(`Formatting changes committed`);
          } else {
            this.logger.log(`No formatting changes needed`);
          }
        } catch (lintError) {
          // Don't fail the task if lint/prettier fails, just log it
          this.logger.warn(
            `ESLint/Prettier failed: ${lintError instanceof Error ? lintError.message : 'Unknown error'}`,
          );
        }

        // ✅ Permanent hollon: Full PR workflow
        prUrl = await this.createPullRequest(task.project, task, worktreePath);
        this.logger.log(`PR created: ${prUrl}`);

        // Phase 4.2: Save PR to database immediately (for CI monitoring)
        // Issue #29: savePRRecord -> codeReviewPort.createPullRequest now atomically
        // saves PR record AND updates task status to IN_REVIEW in a transaction
        await this.savePRRecord(task, prUrl, hollonId, worktreePath);

        this.logger.log(
          `Task ${taskId} is now IN_REVIEW - autoCheckPRCI Cron will monitor CI status`,
        );
      } else {
        // ✅ Temporary hollon: Skip PR workflow, mark as COMPLETED
        this.logger.log(
          `Temporary hollon ${hollon.id.slice(0, 8)} completed subtask ${taskId.slice(0, 8)} - marking as COMPLETED (no PR)`,
        );

        await this.taskRepo.update(taskId, {
          status: TaskStatus.COMPLETED,
          completedAt: new Date(),
        });

        // Phase 1: Immediately delete temporary hollon to free up team slot
        this.logger.log(
          `Deleting temporary hollon ${hollon.name} (${hollon.id.slice(0, 8)}) to free up team slot`,
        );

        try {
          await this.hollonService.deleteTemporary(hollonId);
          this.logger.log(
            `Successfully deleted temporary hollon ${hollon.name} - team slot freed`,
          );
        } catch (deleteError) {
          this.logger.error(
            `Failed to delete temporary hollon ${hollonId}: ${deleteError instanceof Error ? deleteError.message : 'Unknown error'}`,
          );
          // Don't throw - task is already completed, just log the error
        }

        // Check if parent task should resume
        await this.checkAndResumeParentTask(task);
      }

      return { prUrl, worktreePath };
    } catch (error) {
      this.logger.error(
        `Task execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Fix #27: Only cleanup worktree if PR was NOT created
      // If PR exists, worktree should be kept for conflict resolution and CI retries
      const hasPR = await this.prRepo.findOne({
        where: { taskId: task.id },
      });

      if (!hasPR) {
        this.logger.log(
          `No PR created for task ${task.id}, cleaning up worktree`,
        );
        // Phase 3.12: Task worktree 정리 (에러 발생 시, PR 없을 때만)
        await this.cleanupTaskWorktree(worktreePath, task.id).catch(() => {
          // Already logged in cleanupTaskWorktree
        });
      } else {
        this.logger.log(
          `PR exists for task ${task.id}, keeping worktree for future retries`,
        );
      }

      throw error;
    }
  }

  /**
   * Phase 4: Team Epic Decomposition (워크트리 없이 분해만 수행)
   *
   * SSOT 정렬:
   * - 부모 태스크는 PENDING 상태로 대기 (Line 185-186)
   * - Manager Hollon은 IDLE로 해방 (다른 작업 가능)
   * - 계층적 팀 구조 지원: 자식 팀 있으면 sub team_epic 생성
   */
  private async executeTeamEpicDecomposition(
    task: Task,
    hollon: Hollon,
  ): Promise<{ prUrl: string | null; worktreePath: string | null }> {
    if (!task.id) {
      throw new Error(
        `Task object is missing id property. Task: ${JSON.stringify(task)}`,
      );
    }

    this.logger.log(
      `Manager ${hollon.name} decomposing team epic ${task.id.slice(0, 8)}`,
    );

    // 1. Task IN_PROGRESS로 변경
    await this.taskRepo.update(task.id, {
      status: TaskStatus.IN_PROGRESS,
      startedAt: new Date(),
    });

    // 2. Team 정보 조회 (자식 팀 포함)
    if (!task.assignedTeamId) {
      throw new Error(`Team epic task ${task.id} has no assigned team`);
    }

    const team = await this.teamRepo.findOne({
      where: { id: task.assignedTeamId },
      relations: ['hollons', 'manager'],
    });

    if (!team) {
      throw new Error(`Team ${task.assignedTeamId} not found`);
    }

    // 3. 자식 팀 조회 (계층적 구조)
    const childTeams = await this.teamRepo.find({
      where: { parentTeamId: team.id },
      relations: ['manager'],
    });

    // 4. Brain Provider로 decomposition 수행
    const brainResult = await this.executeBrainProviderForDecomposition(
      hollon,
      task,
      team,
      childTeams,
    );

    // 5. 자식 태스크 생성 (계층적)
    const childTasks: Task[] = [];

    if (childTeams.length > 0) {
      // ✅ 하위 팀이 있으면 sub team_epic 생성 (재귀)
      this.logger.log(
        `Creating ${childTeams.length} sub team epics for child teams`,
      );

      for (let i = 0; i < childTeams.length; i++) {
        const childTeam = childTeams[i];
        const teamWorkItems =
          brainResult.teamDistribution?.[childTeam.id] || [];

        if (teamWorkItems.length === 0) continue;

        const subTeamEpic = this.taskRepo.create({
          organizationId: task.organizationId,
          projectId: task.projectId,
          parentTaskId: task.id, // ✅ 부모 참조
          creatorHollonId: hollon.id, // ✅ 에스컬레이션용
          title: `${childTeam.name}: ${task.title} - Batch ${i + 1}`,
          description: this.formatTeamTaskDescription(teamWorkItems),
          type: TaskType.TEAM_EPIC,
          status: TaskStatus.PENDING,
          assignedTeamId: childTeam.id,
          depth: (task.depth || 0) + 1,
          priority: task.priority,
        });

        const savedSubTeamEpic = await this.taskRepo.save(subTeamEpic);
        childTasks.push(savedSubTeamEpic);

        this.logger.log(
          `Created sub team_epic for ${childTeam.name} with ${teamWorkItems.length} work items`,
        );
      }
    } else {
      // ✅ 말단 팀이면 implementation tasks 생성
      this.logger.log(
        `Creating ${brainResult.workItems?.length || 0} implementation tasks for team members`,
      );

      // Task title → Task 객체 매핑 (dependency resolution용)
      const taskMap = new Map<string, Task>();

      // First pass: Create all tasks without dependencies
      for (const workItem of brainResult.workItems || []) {
        // 팀원 중 적절한 홀론 선택
        const assignedHollon = await this.selectBestHollon(team, workItem);

        // Phase 4 Fix: XOR constraint requires either assignedTeamId OR assignedHollonId, not both
        // If hollon is assigned, don't set assignedTeamId. Otherwise, inherit from parent for team-based task pulling.
        const implTask = this.taskRepo.create({
          organizationId: task.organizationId,
          projectId: task.projectId,
          parentTaskId: task.id, // ✅ 부모 참조
          creatorHollonId: hollon.id, // ✅ 에스컬레이션용
          assignedTeamId: assignedHollon ? null : task.assignedTeamId, // XOR: team only if no hollon
          title: workItem.title,
          description: workItem.description,
          type: TaskType.IMPLEMENTATION,
          status: TaskStatus.READY, // Will be updated if has dependencies
          assignedHollonId: assignedHollon?.id,
          depth: (task.depth || 0) + 1,
          priority: this.mapPriority(workItem.priority || ''),
          acceptanceCriteria: workItem.acceptanceCriteria,
          requiredSkills: workItem.requiredSkills,
          // workingDirectory will be set at execution time by getOrCreateWorktree()
        });

        const savedImplTask = await this.taskRepo.save(implTask);
        taskMap.set(workItem.title, savedImplTask);
        childTasks.push(savedImplTask);
      }

      // Second pass: Resolve and set dependencies
      let blockedCount = 0;
      for (const workItem of brainResult.workItems || []) {
        const currentTask = taskMap.get(workItem.title);
        if (!currentTask) continue;

        // Parse dependencies
        const dependencyTitles = workItem.dependencies || [];
        const dependencyTasks = dependencyTitles
          .map((depTitle: string) => taskMap.get(depTitle))
          .filter((t: Task | undefined): t is Task => t != null);

        if (dependencyTasks.length > 0) {
          // Set dependencies (many-to-many relation)
          currentTask.dependencies = dependencyTasks;

          // Update status to BLOCKED
          currentTask.status = TaskStatus.BLOCKED;

          await this.taskRepo.save(currentTask);
          blockedCount++;

          this.logger.log(
            `Task "${currentTask.title}" → BLOCKED (depends on ${dependencyTasks.length} task(s))`,
          );
        }
      }

      this.logger.log(
        `Created ${childTasks.length} implementation tasks (${blockedCount} BLOCKED, ${childTasks.length - blockedCount} READY)`,
      );
    }

    // 6. ✅ SSOT Line 185-186: 부모는 PENDING으로 대기
    await this.taskRepo.update(task.id, {
      status: TaskStatus.PENDING, // 자식들이 완료될 때까지 대기
    });

    // 7. ✅ Manager Hollon은 IDLE로 해방
    await this.hollonRepo.update(hollon.id, {
      status: HollonStatus.IDLE,
      currentTaskId: null as any,
    });

    this.logger.log(
      `✅ Manager ${hollon.name} freed. Team epic ${task.id.slice(0, 8)} ` +
        `waiting for ${childTasks.length} children (PENDING state)`,
    );

    // 8. team_epic은 PR 생성 안함
    return { prUrl: null, worktreePath: null };
  }

  /**
   * Brain Provider로 team epic decomposition 수행
   */
  private async executeBrainProviderForDecomposition(
    hollon: Hollon,
    task: Task,
    team: Team,
    childTeams: Team[],
  ): Promise<DecompositionResult> {
    const prompt = this.buildDecompositionPrompt(task, team, childTeams);

    const result = await this.brainProvider.executeWithTracking(
      {
        prompt,
        systemPrompt: hollon.role?.systemPrompt || hollon.systemPrompt,
        context: {
          // Phase 4.1 Fix #6: Use temp directory for decomposition to prevent
          // Claude from creating files on main branch. Decomposition should
          // only return JSON, not create actual code files.
          workingDirectory: os.tmpdir(),
        },
        options: {
          // Phase 4.1 Fix #7: Disable file system tools for decomposition mode
          // Prevents Claude from: creating files (Write/Edit), running git commands (Bash),
          // or navigating to main project directory. Only analysis and JSON output allowed.
          disallowedTools: ['Write', 'Edit', 'Bash', 'MultiEdit'],
        },
      },
      {
        organizationId: task.organizationId,
      },
    );

    // JSON 응답 파싱
    return this.parseDecompositionResponse(result.output);
  }

  /**
   * Decomposition 프롬프트 생성
   */
  private buildDecompositionPrompt(
    task: Task,
    team: Team,
    childTeams: Team[],
  ): string {
    const hasChildTeams = childTeams.length > 0;

    return `
You are a ${team.name} manager decomposing a team epic task.

# Team Epic Task
${task.title}

${task.description || ''}

# Team Structure
${
  hasChildTeams
    ? `This team has ${childTeams.length} sub-teams:
${childTeams.map((t) => `- ${t.name}`).join('\n')}

Please distribute work items among these sub-teams.
`
    : `This is a leaf team with ${team.hollons?.length || 0} members.

Please create implementation tasks for individual team members.

IMPORTANT: Identify task dependencies - which tasks must be completed before others can start.`
}

# Output Format
Return a JSON object with this structure:

${
  hasChildTeams
    ? `{
  "teamDistribution": {
    "${childTeams[0]?.id}": [
      {
        "title": "Work item title",
        "description": "Detailed description",
        "priority": "P1",
        "acceptanceCriteria": ["criterion 1", "criterion 2"],
        "requiredSkills": ["skill1", "skill2"],
        "dependencies": ["Exact title of task that must complete first"]
      }
    ]
  }
}`
    : `{
  "workItems": [
    {
      "title": "Task title",
      "description": "Detailed description",
      "priority": "P1",
      "acceptanceCriteria": ["criterion 1", "criterion 2"],
      "requiredSkills": ["TypeScript", "NestJS"],
      "dependencies": ["Exact title of task that must complete first"]
    }
  ]
}`
}

IMPORTANT:
- Use "dependencies" array to specify which tasks must be completed before this task can start
- Dependencies should reference exact task titles from the same workItems array
- If a task has no dependencies, use an empty array: "dependencies": []
- Tasks with dependencies will be marked as BLOCKED until their dependencies complete

Return ONLY the JSON, no other text.

CRITICAL: Do NOT create, write, or modify any files. Do NOT use file system tools.
This is a PLANNING task only. Output ONLY the JSON response.
`.trim();
  }

  /**
   * Decomposition 응답 파싱
   */
  private parseDecompositionResponse(output: string): DecompositionResult {
    // Extract JSON from markdown code blocks or plain text
    const jsonMatch =
      output.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
      output.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Failed to parse decomposition response: No JSON found');
    }

    const jsonStr = jsonMatch[1] || jsonMatch[0];
    return JSON.parse(jsonStr);
  }

  /**
   * 팀원 중 최적의 홀론 선택
   */
  private async selectBestHollon(
    team: Team,
    _workItem: unknown,
  ): Promise<Hollon | null> {
    if (!team.hollons || team.hollons.length === 0) {
      return null;
    }

    // 간단한 라운드로빈 (향후 스킬 매칭으로 개선)
    const idleHollons = team.hollons.filter(
      (h) => h.status === HollonStatus.IDLE,
    );

    if (idleHollons.length === 0) {
      // 모두 바쁘면 첫 번째 홀론에 할당 (큐잉)
      return team.hollons[0];
    }

    // 가장 적게 할당된 홀론 선택
    const hollonTaskCounts = await Promise.all(
      idleHollons.map(async (h) => ({
        hollon: h,
        taskCount: await this.taskRepo.count({
          where: {
            assignedHollonId: h.id,
            status: TaskStatus.IN_PROGRESS,
          },
        }),
      })),
    );

    hollonTaskCounts.sort((a, b) => a.taskCount - b.taskCount);
    return hollonTaskCounts[0].hollon;
  }

  /**
   * Team task description 포맷팅
   */
  private formatTeamTaskDescription(
    workItems: DecompositionWorkItem[],
  ): string {
    return `This is a Team Task containing ${workItems.length} work items.

The team manager will distribute these items to team members as subtasks.

**Work Items:**

${workItems
  .map((item, i) =>
    `
${i + 1}. **${item.title}**
   ${item.description}
   Priority: ${item.priority}
   Required Skills: ${item.requiredSkills?.join(', ') || 'N/A'}
   Acceptance Criteria:
   ${item.acceptanceCriteria?.map((c) => `- ${c}`).join('\n   ') || '- N/A'}
`.trim(),
  )
  .join('\n\n')}
`.trim();
  }

  /**
   * Priority 매핑
   */
  private mapPriority(priority: string): TaskPriority {
    const map: Record<string, TaskPriority> = {
      P0: TaskPriority.P1_CRITICAL,
      P1: TaskPriority.P1_CRITICAL,
      P2: TaskPriority.P2_HIGH,
      P3: TaskPriority.P3_MEDIUM,
      P4: TaskPriority.P4_LOW,
    };
    return map[priority] || TaskPriority.P3_MEDIUM;
  }

  /**
   * Phase 3.12: Task별 Worktree 생성 (완전 격리 전략)
   * - Task당 1개의 독립적인 worktree 생성
   * - 경로: {projectDir}/../.git-worktrees/hollon-{hollonId}/task-{taskId}
   * - 장점: 완전 격리, Git 충돌 없음, 병렬 처리 가능
   * - Organization settings의 baseBranch를 기준으로 생성 (기본값: main)
   * - 서브태스크는 부모의 worktree를 재사용 (임시 Hollon의 경우)
   */
  private async getOrCreateWorktree(
    project: Project,
    hollon: Hollon,
    task: Task,
  ): Promise<string> {
    // Phase 3.12: Reuse existing worktree if already set (subtasks from temporary hollon)
    // Fix #11 & #22: Verify inherited path exists AND is a valid worktree (not main repo)
    if (task.workingDirectory) {
      const exists = await this.worktreeExists(task.workingDirectory);
      if (exists) {
        // Fix #22: Validate it's actually a worktree path, not the main repository
        // Get git root to validate against
        let gitRoot: string;
        try {
          const { stdout } = await execAsync('git rev-parse --show-toplevel', {
            cwd: project.workingDirectory,
          });
          gitRoot = stdout.trim();
        } catch {
          gitRoot = project.workingDirectory;
        }

        if (this.isValidWorktreePath(task.workingDirectory, gitRoot)) {
          this.logger.log(
            `Reusing inherited worktree for subtask ${task.id.slice(0, 8)}: ${task.workingDirectory}`,
          );
          return task.workingDirectory;
        } else {
          this.logger.error(
            `CRITICAL FIX #22: task.workingDirectory points to main repository, not a worktree! ` +
              `Path: ${task.workingDirectory}. Clearing and creating new worktree.`,
          );
          await this.taskRepo.update(task.id, { workingDirectory: null });
        }
      } else {
        this.logger.warn(
          `Fix #11: Inherited worktree path does not exist: ${task.workingDirectory}. Clearing stale reference and creating new worktree.`,
        );
        await this.taskRepo.update(task.id, { workingDirectory: null });
      }
    }

    // Phase 4.1 Fix #1: If subtask has no worktree, check parent's worktree dynamically
    // This handles cases where subtask was created before parent started
    // Fix #11 & #22: Verify parent's path exists on disk AND is a valid worktree before inheriting
    if (task.parentTaskId) {
      const parentTask = await this.taskRepo.findOne({
        where: { id: task.parentTaskId },
      });
      if (parentTask?.workingDirectory) {
        const parentExists = await this.worktreeExists(
          parentTask.workingDirectory,
        );
        if (parentExists) {
          // Fix #22: Validate parent's path is a worktree, not main repo
          let gitRoot: string;
          try {
            const { stdout } = await execAsync(
              'git rev-parse --show-toplevel',
              {
                cwd: project.workingDirectory,
              },
            );
            gitRoot = stdout.trim();
          } catch {
            gitRoot = project.workingDirectory;
          }

          if (this.isValidWorktreePath(parentTask.workingDirectory, gitRoot)) {
            this.logger.log(
              `Subtask ${task.id.slice(0, 8)} inheriting parent's worktree at execution time: ${parentTask.workingDirectory}`,
            );
            // Update task's workingDirectory for future reference
            await this.taskRepo.update(task.id, {
              workingDirectory: parentTask.workingDirectory,
            });
            return parentTask.workingDirectory;
          } else {
            this.logger.error(
              `CRITICAL FIX #22: Parent task's workingDirectory points to main repository! ` +
                `Path: ${parentTask.workingDirectory}. Will create new worktree.`,
            );
          }
        } else {
          this.logger.warn(
            `Fix #11: Parent's worktree path does not exist: ${parentTask.workingDirectory}. Will create new worktree.`,
          );
        }
      }
    }

    // Phase 4.1 Fix #2: Worktree must be created at git root, not in project subdirectory
    // project.workingDirectory may be apps/server, but .git is at project root
    // Use git rev-parse to find actual git root (handles any depth of subdirectory)
    let gitRoot: string;
    try {
      const { stdout } = await execAsync('git rev-parse --show-toplevel', {
        cwd: project.workingDirectory,
      });
      gitRoot = stdout.trim();
      this.logger.debug(`Git root detected: ${gitRoot}`);
    } catch {
      // Fallback: assume workingDirectory is at git root
      gitRoot = project.workingDirectory;
      this.logger.warn(
        `Could not detect git root, using project.workingDirectory: ${gitRoot}`,
      );
    }
    const worktreePath = path.join(
      gitRoot,
      '.git-worktrees',
      `hollon-${hollon.id.slice(0, 8)}`,
      `task-${task.id.slice(0, 8)}`,
    );

    // Check if worktree already exists (should not happen)
    const exists = await this.worktreeExists(worktreePath);

    if (exists) {
      this.logger.warn(
        `Worktree already exists: ${worktreePath}, this should not happen`,
      );
      throw new Error(`Worktree already exists: ${worktreePath}`);
    }

    // Get base branch from organization settings
    const organization = await this.orgRepo.findOne({
      where: { id: project.organizationId },
    });
    const settings = (organization?.settings || {}) as OrganizationSettings;
    let baseBranch = settings.baseBranch || 'main';

    // Phase 4: In TEST mode only, use dependency's branch as base
    // Production: PRs are merged to main, so always use main as base
    // Test: PRs are NOT merged, so use dependency's branch to get its changes
    const isTestMode = process.env.NODE_ENV === 'test';

    if (isTestMode && task.dependencies && task.dependencies.length > 0) {
      const completedDeps = task.dependencies.filter(
        (dep) => dep.status === TaskStatus.COMPLETED,
      );

      if (completedDeps.length > 0) {
        // Use the most recently completed dependency's branch
        const mostRecentDep = completedDeps.sort(
          (a, b) =>
            (b.completedAt?.getTime() || 0) - (a.completedAt?.getTime() || 0),
        )[0];

        // Construct the branch name from the dependency task
        const depBranch = `wt-hollon-${mostRecentDep.assignedHollonId?.slice(0, 8)}-task-${mostRecentDep.id.slice(0, 8)}`;

        this.logger.log(
          `[TEST MODE] Task has completed dependency ${mostRecentDep.id.slice(0, 8)}, using its branch as base: ${depBranch}`,
        );
        baseBranch = depBranch;
      }
    }

    // Create new worktree for this task
    this.logger.log(
      `Creating task worktree for ${hollon.name} / task ${task.id.slice(0, 8)} from ${baseBranch}`,
    );

    // Use git lock to prevent concurrent git operations (use gitRoot for lock)
    await this.withGitLock(gitRoot, async () => {
      try {
        // Ensure parent directory exists
        const hollonDir = path.join(
          gitRoot,
          '.git-worktrees',
          `hollon-${hollon.id.slice(0, 8)}`,
        );
        await execAsync(`mkdir -p ${hollonDir}`);

        // Phase 4: Fetch latest from origin to ensure we have up-to-date base branch
        this.logger.log(`Fetching latest from origin for ${baseBranch}`);
        let useOriginBranch = true;
        try {
          await execAsync('git fetch origin', {
            cwd: gitRoot,
          });
          this.logger.log('✅ Git fetch succeeded');
        } catch (fetchError) {
          const err = fetchError as Error & { stderr?: string };
          this.logger.warn(
            `Failed to fetch from origin (${err.message}). Will use local branch instead.`,
          );
          useOriginBranch = false;
        }

        // Create unique temporary branch name for worktree
        const tempBranch = `wt-hollon-${hollon.id.slice(0, 8)}-task-${task.id.slice(0, 8)}`;

        // Create worktree from origin/baseBranch or local baseBranch
        // Prefer origin branch to ensure latest code, but fall back to local if fetch failed
        // In test mode with worktree dependency branches, use local branch (not in origin)
        const isWorktreeBranch = baseBranch.startsWith('wt-hollon-');
        const shouldUseLocalBranch =
          !useOriginBranch || (isTestMode && isWorktreeBranch);
        const branchRef = shouldUseLocalBranch
          ? baseBranch
          : `origin/${baseBranch}`;
        this.logger.log(
          `Creating worktree from ${branchRef} for task ${task.id.slice(0, 8)}`,
        );
        await execAsync(
          `git worktree add -b ${tempBranch} ${worktreePath} ${branchRef}`,
          {
            cwd: gitRoot,
          },
        );

        this.logger.log(
          `Task worktree created: hollon-${hollon.id.slice(0, 8)}/task-${task.id.slice(0, 8)} from ${branchRef}`,
        );
      } catch (error: unknown) {
        const err = error as Error & { stderr?: string };
        const errorMessage = err?.message || 'Unknown error';
        const stderr = err?.stderr || '';
        const fullError = stderr
          ? `${errorMessage}\nstderr: ${stderr}`
          : errorMessage;
        this.logger.error(
          `Failed to create task worktree from ${baseBranch}: ${fullError}`,
        );
        throw new Error(
          `Task worktree creation failed from ${baseBranch}: ${fullError}`,
        );
      }
    });

    // Phase 3.12: Save worktree path to task entity
    await this.taskRepo.update(task.id, {
      workingDirectory: worktreePath,
    });

    this.logger.log(`Task worktree path saved: ${worktreePath}`);

    return worktreePath;
  }

  /**
   * Phase 3.12: Hollon별 브랜치 생성 (Task worktree 내)
   * - 브랜치명: feature/{hollonName}/task-{taskId}
   * - 작업자를 브랜치명으로 명확히 식별
   * Phase 4 Fix: Reuse existing remote branch instead of deleting (preserves PRs)
   */
  private async createBranch(
    hollon: Hollon,
    task: Task,
    worktreePath: string,
  ): Promise<string> {
    // Sanitize hollon name for branch (특수문자 제거)
    const sanitizedName = hollon.name.replace(/[^a-zA-Z0-9-]/g, '-');
    const branchName = `feature/${sanitizedName}/task-${task.id.slice(0, 8)}`;

    this.logger.debug(
      `Creating branch ${branchName} for hollon ${hollon.name}`,
    );

    try {
      // Check if we're already on the correct branch (worktree reuse case)
      const { stdout: currentBranch } = await execAsync(
        `git branch --show-current`,
        { cwd: worktreePath },
      );

      const currentBranchTrimmed = currentBranch.trim();

      if (currentBranchTrimmed === branchName) {
        this.logger.log(
          `Already on branch ${branchName}, skipping branch creation`,
        );
        return branchName;
      }

      // Phase 4 Fix: Check if branch exists remotely and REUSE it instead of deleting
      // This preserves existing PRs and allows CI retry to push fixes to same branch
      try {
        const { stdout } = await execAsync(
          `git ls-remote --heads origin ${branchName}`,
          { cwd: worktreePath },
        );

        if (stdout.trim()) {
          // Branch exists remotely - fetch and checkout instead of deleting
          this.logger.log(
            `Remote branch ${branchName} exists, fetching and checking out (preserving PR)`,
          );

          // Fetch the remote branch
          await execAsync(`git fetch origin ${branchName}`, {
            cwd: worktreePath,
          });

          // Fix #22: Protect main branch from accidental rename
          // Verify we're in a worktree and not on main branch before renaming
          const { stdout: currentBranch } = await execAsync(
            'git branch --show-current',
            { cwd: worktreePath },
          );
          const branchToRename = currentBranch.trim();

          if (branchToRename === 'main') {
            this.logger.error(
              `CRITICAL: Attempted to rename main branch! Aborting. worktreePath=${worktreePath}`,
            );
            throw new Error(
              'Cannot rename main branch - worktree setup may be incorrect',
            );
          }

          // Rename current branch to the feature branch (using -C for safety)
          await execAsync(`git -C "${worktreePath}" branch -m ${branchName}`, {
            cwd: worktreePath,
          });

          // Reset to match remote (get the latest changes from previous attempt)
          await execAsync(`git reset --hard origin/${branchName}`, {
            cwd: worktreePath,
          });

          this.logger.log(`Checked out existing remote branch ${branchName}`);
          return branchName;
        }
      } catch (checkError) {
        // Ignore errors from ls-remote (branch might not exist)
        this.logger.debug(
          `Branch remote check skipped: ${checkError instanceof Error ? checkError.message : 'Unknown error'}`,
        );
      }

      // Branch doesn't exist remotely - create new branch
      // The worktree was created with a temporary branch, now rename it to the feature branch
      // Git automatically creates the necessary directory structure for nested branches

      // Fix #22: Protect main branch from accidental rename
      // Verify we're in a worktree and not on main branch before renaming
      const { stdout: currentBranch2 } = await execAsync(
        'git branch --show-current',
        { cwd: worktreePath },
      );
      const branchToRename2 = currentBranch2.trim();

      if (branchToRename2 === 'main') {
        this.logger.error(
          `CRITICAL: Attempted to rename main branch! Aborting. worktreePath=${worktreePath}`,
        );
        throw new Error(
          'Cannot rename main branch - worktree setup may be incorrect',
        );
      }

      await execAsync(`git -C "${worktreePath}" branch -m ${branchName}`, {
        cwd: worktreePath,
      });

      this.logger.log(`Branch created: ${branchName}`);
      return branchName;
    } catch (error: unknown) {
      const err = error as Error & { stderr?: string };
      const errorMessage = err?.message || 'Unknown error';
      const stderr = err?.stderr || '';
      const fullError = stderr
        ? `${errorMessage}\nstderr: ${stderr}`
        : errorMessage;
      this.logger.error(`Failed to create branch: ${fullError}`);
      throw new Error(`Branch creation failed: ${fullError}`);
    }
  }

  /**
   * Phase 3.12: Worktree 존재 여부 확인
   */
  private async worktreeExists(worktreePath: string): Promise<boolean> {
    try {
      await execAsync(`test -d ${worktreePath}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Fix #22: Validate that a path is actually a worktree, not the main repository
   * Worktree paths must be inside .git-worktrees/ directory
   */
  private isValidWorktreePath(worktreePath: string, gitRoot: string): boolean {
    const normalizedPath = path.resolve(worktreePath);
    const normalizedRoot = path.resolve(gitRoot);
    const worktreesDir = path.join(normalizedRoot, '.git-worktrees');

    // Path must be inside .git-worktrees/ directory, not the main repo
    return (
      normalizedPath.startsWith(worktreesDir) &&
      normalizedPath !== normalizedRoot
    );
  }

  /**
   * Phase 3.12: Task worktree 정리 (Task 완료 후 호출)
   * PR merge 후 자동으로 호출되어 worktree 삭제
   */
  async cleanupTaskWorktree(
    worktreePath: string,
    _taskId?: string,
  ): Promise<void> {
    this.logger.debug(`Cleaning up task worktree: ${worktreePath}`);

    try {
      await execAsync(`git worktree remove ${worktreePath} --force`);
      this.logger.log(`Task worktree removed: ${worktreePath}`);

      // Fix #11: Clear workingDirectory for ALL tasks that reference this worktree path
      // This prevents stale references when subtasks inherit parent's worktree
      const updateResult = await this.taskRepo.update(
        { workingDirectory: worktreePath },
        { workingDirectory: null },
      );
      this.logger.log(
        `Cleared workingDirectory for ${updateResult.affected || 0} tasks referencing ${worktreePath}`,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to remove task worktree: ${errorMessage}`);
      // Don't throw - cleanup failures shouldn't block task completion
    }
  }

  /**
   * BrainProvider 실행 (지식 주입 포함)
   * Phase 3.12/4: BrainResponse 반환하여 Quality Gate와 Document 저장에 사용
   */
  private async executeBrainProvider(
    hollon: Hollon,
    task: Task,
    worktreePath: string,
  ): Promise<BrainResponse> {
    // 프롬프트 구성 (Phase 4: Pass hollon for depth-aware prompting)
    const prompt = this.buildTaskPrompt(task, hollon);

    this.logger.log(`Executing brain provider for task ${task.id}`);

    // BrainProvider 실행
    const result = await this.brainProvider.executeWithTracking(
      {
        prompt,
        context: {
          workingDirectory: worktreePath,
          taskId: task.id,
        },
      },
      {
        organizationId: task.project.organizationId,
        hollonId: hollon.id,
        taskId: task.id,
      },
    );

    this.logger.log(
      `Brain execution completed: cost=${result.cost.totalCostCents.toFixed(4)}`,
    );

    return result;
  }

  /**
   * Phase 3.12/4: Save execution result as document for future reference
   * Documents serve as execution history and can be used for knowledge retrieval
   */
  private async saveResultDocument(
    task: Task,
    hollonId: string,
    output: string,
    costCents: number,
  ): Promise<void> {
    try {
      const document = this.documentRepo.create({
        title: `Task Execution: ${task.title}`,
        content: output,
        type: DocumentType.TASK_CONTEXT,
        organizationId: task.organizationId,
        projectId: task.projectId,
        hollonId: hollonId,
        taskId: task.id,
        tags: [
          'task-execution',
          'automated',
          ...(task.requiredSkills || []),
          ...(task.tags || []),
        ],
        metadata: {
          executionCostCents: costCents,
          taskType: task.type,
          hollonName: task.assignedHollon?.name || 'unknown',
          executedAt: new Date().toISOString(),
        },
      });

      await this.documentRepo.save(document);

      this.logger.log(
        `Task execution result saved as document: ${document.id}`,
      );
    } catch (error) {
      // Log error but don't fail the task execution
      this.logger.error(
        `Failed to save result document: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Task 프롬프트 생성
   */
  /**
   * Task 프롬프트 생성
   * Phase 4: Ask Brain if decomposition is needed for complex tasks
   */
  private buildTaskPrompt(task: Task, hollon?: Hollon): string {
    const sections: string[] = [];

    sections.push(`# Task: ${task.title}\n`);

    // Check for CI failure feedback
    const metadata = (task.metadata || {}) as Record<string, unknown>;
    const ciFeedback = metadata.lastCIFeedback as string | undefined;

    if (ciFeedback) {
      sections.push(`## ⚠️ CI FAILURE FEEDBACK\n${ciFeedback}\n`);
      sections.push(
        `## Recovery Options\n` +
          `You have TWO options to fix this CI failure:\n\n` +
          `**Option 1: Self-Correction (Recommended for simple fixes)**\n` +
          `- Review the CI errors above\n` +
          `- Fix the issues directly in your code (linting, types, tests, etc.)\n` +
          `- Commit the fixes\n` +
          `- Start your response with "SELF_CORRECT: <brief reason>"\n\n` +
          `**Option 2: Decompose into Subtasks (For complex issues)**\n` +
          `- If the CI failures indicate that the task is too complex\n` +
          `- Break down the fix into smaller, manageable subtasks\n` +
          `- Start your response with "DECOMPOSE_TASK: <reason>"\n` +
          `- Provide subtask JSON as described in the Instructions section below\n\n` +
          `**Choose wisely:** Use Option 1 for quick fixes (typos, missing imports, simple test fixes). ` +
          `Use Option 2 if you need to restructure code or the issue is complex.\n`,
      );
    }

    if (task.description) {
      sections.push(`## Description\n${task.description}\n`);
    }

    if (task.acceptanceCriteria) {
      sections.push(`## Acceptance Criteria\n${task.acceptanceCriteria}\n`);
    }

    if (task.affectedFiles && task.affectedFiles.length > 0) {
      sections.push(`## Affected Files\n${task.affectedFiles.join('\n')}\n`);
    }

    // Phase 4: Analyze task complexity and hollon depth
    const analysis = this.analyzeTaskComplexity(task);
    const isPermanentHollon = hollon && hollon.depth === 0;

    // Phase 4.1: MANDATORY decomposition if estimated commits >= 2
    const mustDecompose = isPermanentHollon && analysis.estimatedCommits >= 2;
    const shouldRecommendDecomposition =
      isPermanentHollon && !mustDecompose && analysis.level === 'medium';

    // Log prompt decision
    console.log(
      `\n🎯 Phase 4: Prompt decision for task "${task.title}":\n` +
        `   Hollon depth: ${hollon?.depth ?? 'undefined'}\n` +
        `   Is permanent hollon: ${isPermanentHollon}\n` +
        `   Complexity: ${analysis.level}\n` +
        `   Estimated commits: ${analysis.estimatedCommits}\n` +
        `   Must decompose: ${mustDecompose}\n` +
        `   Should recommend decomposition: ${shouldRecommendDecomposition}\n` +
        `   Prompt branch: ${mustDecompose ? 'MANDATORY_DECOMPOSITION' : shouldRecommendDecomposition ? 'RECOMMENDED_DECOMPOSITION' : isPermanentHollon ? 'DIRECT_IMPLEMENTATION' : 'TEMPORARY_DIRECT_ONLY'}\n`,
    );

    if (mustDecompose) {
      // For tasks requiring multiple commits: MANDATORY decomposition
      sections.push(
        `## Instructions\n` +
          `🚨 MANDATORY DECOMPOSITION REQUIRED 🚨\n\n` +
          `This task is estimated to require ${analysis.estimatedCommits} commits, which means it should be broken down into ${analysis.estimatedCommits} subtasks.\n\n` +
          `**You MUST decompose this task. Direct implementation is NOT allowed.**\n\n` +
          `Start your response with:\n` +
          `"DECOMPOSE_TASK: This task requires ${analysis.estimatedCommits} separate commits"\n\n` +
          `Then provide a JSON object with this structure:\n` +
          `{\n` +
          `  "subtasks": [\n` +
          `    {\n` +
          `      "title": "Subtask title (e.g., 'Implement entity layer')",\n` +
          `      "description": "What this subtask accomplishes (should result in 1 commit)",\n` +
          `      "priority": "P1",\n` +
          `      "acceptanceCriteria": ["criterion 1", "criterion 2"],\n` +
          `      "requiredSkills": ["skill1", "skill2"]\n` +
          `    }\n` +
          `  ]\n` +
          `}\n\n` +
          `**Guidelines for decomposition:**\n` +
          `- Each subtask should represent ONE logical commit\n` +
          `- Split by architectural layers (e.g., entity → service → controller → tests)\n` +
          `- Each subtask should be independently testable\n` +
          `- Subtasks will be executed in parallel by specialized sub-hollons\n`,
      );
    } else if (shouldRecommendDecomposition) {
      // For medium complexity: Recommend but not mandatory
      sections.push(
        `## Instructions\n` +
          `This task appears to be ${analysis.level} complexity.\n` +
          `While it could be implemented directly, decomposition is recommended for better code quality.\n\n` +
          `**Option 1: Decompose (Recommended)**\n` +
          `Start your response with "DECOMPOSE_TASK: <reason>" and provide subtask JSON.\n\n` +
          `**Option 2: Implement directly**\n` +
          `If you believe this can be done in a single, focused commit:\n` +
          `1. Write clean, maintainable code\n` +
          `2. Follow the project's coding standards\n` +
          `3. Add appropriate tests if needed\n` +
          `4. Update documentation if required\n` +
          `5. Create ONE commit with all changes\n`,
      );
    } else if (isPermanentHollon) {
      // For low complexity: Direct implementation preferred
      sections.push(
        `## Instructions\n` +
          `Please implement the task described above. ` +
          `Make sure to:\n` +
          `1. Write clean, maintainable code\n` +
          `2. Follow the project's coding standards\n` +
          `3. Add appropriate tests if needed\n` +
          `4. Update documentation if required\n` +
          `5. **Commit frequently** - make atomic commits after each logical change\n` +
          `6. Each commit should be independently valid (pass lint/build)\n` +
          `7. Run \`npm run lint:fix\` before each commit to fix lint errors\n\n` +
          `Note: This task is estimated to require ${analysis.estimatedCommits} commit(s).\n`,
      );
    } else {
      // For temporary hollons (depth >= 1): Direct implementation only
      sections.push(
        `## Instructions\n` +
          `You are a temporary sub-hollon responsible for executing this specific subtask.\n` +
          `Please implement the task described above directly. DO NOT attempt to decompose further.\n\n` +
          `Make sure to:\n` +
          `1. Write clean, maintainable code\n` +
          `2. Follow the project's coding standards\n` +
          `3. Add appropriate tests if needed\n` +
          `4. Update documentation if required\n` +
          `5. **Commit frequently** - make atomic commits after each logical change\n` +
          `6. Run \`npm run lint:fix\` before each commit to fix lint errors\n`,
      );
    }

    return sections.join('\n');
  }

  /**
   * Phase 4: Analyze task complexity to determine if decomposition should be recommended
   *
   * Complexity heuristics:
   * - High complexity: Long description, multiple acceptance criteria, many affected files
   * - Medium complexity: Moderate requirements
   * - Low complexity: Simple, focused task
   */
  private analyzeTaskComplexity(task: Task): {
    level: 'high' | 'medium' | 'low';
    estimatedCommits: number;
  } {
    let complexityScore = 0;
    const scoreBreakdown: string[] = [];

    // Estimate number of commits based on task characteristics
    let estimatedCommits = 1;

    // Check description length
    if (task.description) {
      const descLength = task.description.length;
      if (descLength > 500) {
        complexityScore += 3;
        scoreBreakdown.push(`Description length (${descLength}): +3`);
      } else if (descLength > 200) {
        complexityScore += 2;
        scoreBreakdown.push(`Description length (${descLength}): +2`);
      } else if (descLength > 100) {
        complexityScore += 1;
        scoreBreakdown.push(`Description length (${descLength}): +1`);
      }
    }

    // Check acceptance criteria - each criterion could be a separate commit
    if (task.acceptanceCriteria && Array.isArray(task.acceptanceCriteria)) {
      const criteriaCount = task.acceptanceCriteria.length;
      if (criteriaCount > 5) {
        complexityScore += 3;
        scoreBreakdown.push(`Acceptance criteria (${criteriaCount}): +3`);
        // 5+ criteria likely needs 3+ commits (e.g., entity, service, controller, tests, docs)
        estimatedCommits = Math.max(
          estimatedCommits,
          Math.ceil(criteriaCount / 2),
        );
      } else if (criteriaCount > 3) {
        complexityScore += 2;
        scoreBreakdown.push(`Acceptance criteria (${criteriaCount}): +2`);
        // 4-5 criteria likely needs 2 commits
        estimatedCommits = Math.max(estimatedCommits, 2);
      } else if (criteriaCount > 1) {
        complexityScore += 1;
        scoreBreakdown.push(`Acceptance criteria (${criteriaCount}): +1`);
      }
    }

    // Check affected files - multiple files across different concerns = multiple commits
    if (task.affectedFiles && task.affectedFiles.length > 0) {
      const fileCount = task.affectedFiles.length;
      if (fileCount > 5) {
        complexityScore += 3;
        scoreBreakdown.push(`Affected files (${fileCount}): +3`);
        // 5+ files likely span multiple concerns (entity, service, controller, DTOs, tests)
        estimatedCommits = Math.max(estimatedCommits, 3);
      } else if (fileCount > 3) {
        complexityScore += 2;
        scoreBreakdown.push(`Affected files (${fileCount}): +2`);
        // 4-5 files likely need 2 commits (e.g., implementation + tests)
        estimatedCommits = Math.max(estimatedCommits, 2);
      } else if (fileCount > 1) {
        complexityScore += 1;
        scoreBreakdown.push(`Affected files (${fileCount}): +1`);
      }
    }

    // Check required skills
    if (task.requiredSkills && task.requiredSkills.length > 3) {
      complexityScore += 2;
      scoreBreakdown.push(
        `Required skills (${task.requiredSkills.length}): +2`,
      );
    }

    // Keywords indicating complexity
    const complexKeywords = [
      'implement complete',
      'full system',
      'entire module',
      'end-to-end',
      'comprehensive',
    ];
    const titleKeywords = task.title
      ? complexKeywords.filter((keyword) =>
          task.title.toLowerCase().includes(keyword),
        )
      : [];
    const descKeywords = task.description
      ? complexKeywords.filter((keyword) =>
          task.description.toLowerCase().includes(keyword),
        )
      : [];

    if (titleKeywords.length > 0) {
      complexityScore += 2;
      scoreBreakdown.push(`Title keywords (${titleKeywords.join(', ')}): +2`);
      // "Complete" or "Full" systems need multiple commits
      estimatedCommits = Math.max(estimatedCommits, 3);
    }
    if (descKeywords.length > 0) {
      complexityScore += 2;
      scoreBreakdown.push(
        `Description keywords (${descKeywords.join(', ')}): +2`,
      );
    }

    // Classify based on score
    let complexityLevel: 'high' | 'medium' | 'low';
    if (complexityScore >= 7) {
      complexityLevel = 'high';
    } else if (complexityScore >= 4) {
      complexityLevel = 'medium';
    } else {
      complexityLevel = 'low';
    }

    // Log the analysis using console.log to ensure it appears in test output
    console.log(
      `\n📊 Phase 4: Task complexity analysis for "${task.title}":\n` +
        `   Score breakdown:\n` +
        scoreBreakdown.map((s) => `     - ${s}`).join('\n') +
        `\n   Total score: ${complexityScore}\n` +
        `   Complexity level: ${complexityLevel.toUpperCase()}\n` +
        `   Estimated commits: ${estimatedCommits}\n`,
    );

    return { level: complexityLevel, estimatedCommits };
  }

  /**
   * Phase 4: Check if Brain suggests task decomposition
   */
  private shouldDecomposeTask(brainOutput: string, _task: Task): boolean {
    // Look for decomposition marker in Brain's output
    const shouldDecompose = brainOutput.trim().startsWith('DECOMPOSE_TASK:');

    // Log Brain's decision
    const firstLine = brainOutput.split('\n')[0].substring(0, 100);
    console.log(
      `\n🤖 Phase 4: Brain's decomposition decision:\n` +
        `   Should decompose: ${shouldDecompose}\n` +
        `   Response starts with: "${firstLine}${brainOutput.length > 100 ? '...' : ''}"\n`,
    );

    return shouldDecompose;
  }

  /**
   * Phase 4: Create temporary sub-hollon for a subtask
   * Follows the pattern from HollonOrchestratorService.handleComplexTask()
   */

  /**
   * Phase 4: Get system prompt for sub-hollon based on type
   * Reads prompt templates from the prompts/ directory
   */
  /**
   * Phase 4: Get appropriate Role for sub-hollon based on type
   * Finds specialized roles from the database
   */
  private async getRoleForSubHollonType(
    type: 'planning' | 'implementation' | 'testing' | 'integration',
    organizationId: string,
  ): Promise<Role | null> {
    const roleNameMap = {
      planning: 'PlanningSpecialist',
      implementation: 'ImplementationSpecialist',
      testing: 'TestingSpecialist',
      integration: 'IntegrationSpecialist',
    };

    const roleName = roleNameMap[type];

    try {
      const role = await this.roleRepo.findOne({
        where: {
          name: roleName,
          organizationId,
          availableForTemporaryHollon: true,
        },
      });

      if (!role) {
        this.logger.warn(
          `Role ${roleName} not found for organization ${organizationId}`,
        );
      }

      return role;
    } catch (error) {
      this.logger.error(
        `Failed to load role for ${type}: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async createSubHollonForSubtask(
    parentHollon: Hollon,
    task: Task,
    subtaskData: {
      title: string;
      description: string;
      requiredSkills?: string[];
      subHollonType?: 'planning' | 'implementation' | 'testing' | 'integration';
    },
  ): Promise<Hollon> {
    // Phase 4: Determine sub-hollon type (default to 'implementation')
    const subHollonType = subtaskData.subHollonType || 'implementation';

    // Phase 4: Get specialized role for the sub-hollon type
    const specializedRole = await this.getRoleForSubHollonType(
      subHollonType,
      parentHollon.organizationId,
    );

    // Fallback to parent's role if specialized role not found
    const roleId = specializedRole?.id || parentHollon.roleId;
    const systemPrompt = specializedRole?.systemPrompt || undefined;

    const subHollonName = `${subHollonType.substring(0, 4)}-${task.id.substring(0, 8)}-${subtaskData.title.substring(0, 20).replace(/[^a-zA-Z0-9-]/g, '-')}`;

    this.logger.log(
      `Creating temporary sub-hollon ${subHollonName} (type: ${subHollonType}, role: ${specializedRole?.name || 'fallback'}) for subtask "${subtaskData.title}"`,
    );

    // Create temporary sub-hollon using the service
    const subHollon = await this.hollonService.createTemporaryHollon({
      name: subHollonName,
      organizationId: parentHollon.organizationId,
      teamId: parentHollon.teamId || undefined,
      roleId, // ✅ Phase 4: Use specialized role ID
      brainProviderId: parentHollon.brainProviderId || 'claude_code',
      createdBy: parentHollon.id,
      systemPrompt, // ✅ Phase 4: Inject role's system prompt
    });

    this.logger.log(
      `Created temporary sub-hollon ${subHollon.id.slice(0, 8)} with ${specializedRole?.name || 'default'} role for "${subtaskData.title}"`,
    );

    return subHollon;
  }

  /**
   * Phase 4: Decompose task into subtasks with temporary sub-hollons
   * Each subtask is assigned to a temporary sub-hollon for precise execution
   * Subtasks share the parent hollon's worktree for git operations
   */
  private async decomposeIntoSubtasks(
    task: Task,
    hollon: Hollon,
    worktreePath: string,
    brainOutput: string,
  ): Promise<void> {
    this.logger.log(
      `Decomposing task ${task.id.slice(0, 8)} into subtasks for hollon ${hollon.name}`,
    );

    // Parse the decomposition result
    const decompositionResult = this.parseSubtaskDecomposition(brainOutput);

    if (
      !decompositionResult.subtasks ||
      decompositionResult.subtasks.length === 0
    ) {
      this.logger.warn('No subtasks found in decomposition result');
      return;
    }

    // Create subtasks with temporary sub-hollons (Phase 4)
    const subtasks: Task[] = [];

    for (const subtaskData of decompositionResult.subtasks) {
      // ✅ Phase 4: Create temporary sub-hollon for each subtask
      const subHollon = await this.createSubHollonForSubtask(
        hollon,
        task,
        subtaskData,
      );

      // Phase 4 Fix: XOR constraint requires either assignedTeamId OR assignedHollonId, not both
      // Since subtask is assigned to subHollon, don't set assignedTeamId
      const subtask = this.taskRepo.create({
        organizationId: task.organizationId,
        projectId: task.projectId,
        parentTaskId: task.id, // Link to parent
        creatorHollonId: hollon.id,
        assignedTeamId: null, // XOR: hollon is assigned, so no team
        title: subtaskData.title,
        description: subtaskData.description,
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.READY, // Ready to execute immediately
        assignedHollonId: subHollon.id, // ✅ Assign to sub-hollon instead of parent
        depth: (task.depth || 0) + 1,
        priority: this.mapPriority(subtaskData.priority || ''),
        acceptanceCriteria: subtaskData.acceptanceCriteria,
        workingDirectory: worktreePath, // ✅ Share parent's worktree (key requirement)
        requiredSkills: subtaskData.requiredSkills,
      });

      const savedSubtask = await this.taskRepo.save(subtask);
      subtasks.push(savedSubtask);

      this.logger.log(
        `Created subtask ${savedSubtask.id.slice(0, 8)}: ${savedSubtask.title} → sub-hollon ${subHollon.id.slice(0, 8)}`,
      );
    }

    this.logger.log(
      `✅ Created ${subtasks.length} subtasks for task ${task.id.slice(0, 8)} with temporary sub-hollons, ` +
        `all sharing worktree: ${worktreePath}`,
    );
  }

  /**
   * Phase 4: Parse subtask decomposition from Brain output
   */
  private parseSubtaskDecomposition(output: string): {
    subtasks: Array<{
      title: string;
      description: string;
      priority?: string;
      acceptanceCriteria?: string[];
      requiredSkills?: string[];
    }>;
  } {
    // Remove the DECOMPOSE_TASK: marker and reason
    const lines = output.split('\n');
    const jsonStartIndex = lines.findIndex((line) =>
      line.trim().startsWith('{'),
    );

    if (jsonStartIndex === -1) {
      throw new Error('No JSON found in decomposition output');
    }

    const jsonStr = lines.slice(jsonStartIndex).join('\n');

    // Extract JSON from markdown code blocks or plain text
    const jsonMatch =
      jsonStr.match(/```(?:json)?\s*([\s\S]*?)\s*```/) ||
      jsonStr.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Failed to parse subtask decomposition: No JSON found');
    }

    const extractedJson = jsonMatch[1] || jsonMatch[0];
    return JSON.parse(extractedJson);
  }

  /**
   * Pull Request 생성
   * Phase 3.11: 현재 브랜치를 자동 감지 (feature/{hollonName}/task-{id})
   * Phase 4: No-commit check - ensure task made changes before creating PR
   */
  private async createPullRequest(
    _project: Project,
    task: Task,
    worktreePath: string,
  ): Promise<string> {
    this.logger.debug(`Creating PR for task ${task.id}`);

    try {
      // 1. Get current branch name
      const { stdout: branchName } = await execAsync(
        `git branch --show-current`,
        { cwd: worktreePath },
      );
      const currentBranch = branchName.trim();

      this.logger.debug(`Current branch: ${currentBranch}`);

      // Phase 4: Get base branch from organization settings to check commit count
      const organization = await this.orgRepo.findOne({
        where: { id: task.project.organizationId },
      });
      const settings = (organization?.settings || {}) as OrganizationSettings;
      const baseBranch = settings.baseBranch || 'main';

      // Phase 4: Check if there are any commits to push
      try {
        const { stdout: commitCount } = await execAsync(
          `git rev-list --count origin/${baseBranch}..HEAD`,
          { cwd: worktreePath },
        );

        const count = parseInt(commitCount.trim(), 10);

        if (count === 0) {
          throw new Error(
            `No commits to create PR - task made no changes. Branch ${currentBranch} has no commits ahead of origin/${baseBranch}.`,
          );
        }

        this.logger.log(
          `Found ${count} commit(s) to push for PR on branch ${currentBranch}`,
        );
      } catch (countError) {
        const err = countError as Error;
        // Re-throw if it's our custom error about no commits
        if (err.message.includes('No commits to create PR')) {
          throw err;
        }
        // Otherwise log and continue (might be git command issue)
        this.logger.warn(
          `Could not verify commit count: ${err.message}, proceeding with PR creation`,
        );
      }

      // 2. Push to remote
      await execAsync(`git push -u origin ${currentBranch}`, {
        cwd: worktreePath,
      });

      // Fix #13: Check if PR already exists for this branch (CI retry case)
      try {
        const { stdout: existingPR } = await execAsync(
          `gh pr view ${currentBranch} --json url --jq '.url'`,
          { cwd: worktreePath },
        );

        if (existingPR.trim()) {
          const existingUrl = existingPR.trim();
          this.logger.log(
            `Fix #13: PR already exists for branch ${currentBranch}, reusing: ${existingUrl}`,
          );
          return existingUrl;
        }
      } catch {
        // No existing PR, proceed to create one
        this.logger.debug(
          `No existing PR for branch ${currentBranch}, creating new PR`,
        );
      }

      // 3. PR body 구성
      const prBody = this.buildPRBody(task);

      // 4. Base branch was already retrieved above for commit count check
      this.logger.debug(`Creating PR with base branch: ${baseBranch}`);

      // 5. Create PR using gh CLI
      const { stdout } = await execAsync(
        `gh pr create --title "${task.title}" --body "${prBody}" --base ${baseBranch}`,
        { cwd: worktreePath },
      );

      const prUrl = stdout.trim();
      return prUrl;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      const stderr = (error as any)?.stderr || '';
      this.logger.error(
        `Failed to create PR: ${errorMessage}${stderr ? `\nStderr: ${stderr}` : ''}`,
      );
      throw new Error(
        `PR creation failed: ${errorMessage}${stderr ? ` (${stderr})` : ''}`,
      );
    }
  }

  /**
   * Phase 4: Check CI status for a PR
   * Uses gh CLI to check all CI checks on the PR
   */
  async checkCIStatus(
    prUrl: string,
    worktreePath: string,
  ): Promise<{ passed: boolean; failedChecks: string[] }> {
    this.logger.debug(`Checking CI status for PR: ${prUrl}`);

    // Skip CI checks in test environment
    if (process.env.NODE_ENV === 'test') {
      this.logger.debug(`Skipping CI checks in test environment`);
      return { passed: true, failedChecks: [] };
    }

    try {
      // Use gh pr checks to get CI status
      const { stdout } = await execAsync(`gh pr checks ${prUrl}`, {
        cwd: worktreePath,
      });

      // Parse output to check if all checks passed
      // gh pr checks output format:
      // X  check-name  conclusion  url
      // ✓  check-name  success     url
      const lines = stdout.trim().split('\n');
      const failedChecks: string[] = [];

      for (const line of lines) {
        // Lines starting with X or ✗ indicate failure
        if (line.trim().startsWith('X') || line.trim().startsWith('✗')) {
          // Extract check name (second column)
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 2) {
            failedChecks.push(parts[1]);
          }
        }
      }

      const passed = failedChecks.length === 0;

      if (passed) {
        this.logger.log(`All CI checks passed for PR: ${prUrl}`);
      } else {
        this.logger.warn(
          `CI checks failed for PR ${prUrl}: ${failedChecks.join(', ')}`,
        );
      }

      return { passed, failedChecks };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to check CI status: ${errorMessage}`);

      // If gh pr checks fails, it might mean checks are still pending
      // Return as not passed so we can retry
      return { passed: false, failedChecks: ['CI check command failed'] };
    }
  }

  /**
   * Phase 4: Handle CI failure with retry logic
   * Returns feedback for the brain and determines if retry is possible
   */
  async handleCIFailure(
    task: Task,
    failedChecks: string[],
    prUrl: string,
    worktreePath: string,
  ): Promise<{
    shouldRetry: boolean;
    feedback: string;
    retryCount: number;
  }> {
    this.logger.warn(
      `Handling CI failure for task ${task.id}: ${failedChecks.join(', ')}`,
    );

    // Get current retry count from task metadata
    const metadata = (task.metadata || {}) as Record<string, unknown>;
    const currentRetryCount = (metadata.ciRetryCount as number) || 0;
    const maxRetries = 3;

    const shouldRetry = currentRetryCount < maxRetries;
    const retryCount = currentRetryCount + 1;

    // Get detailed CI logs for failed checks
    let ciLogs = '';
    try {
      // Use gh run view to get detailed logs
      const { stdout } = await execAsync(
        `gh pr checks ${prUrl} --json name,conclusion,detailsUrl | jq -r '.[] | select(.conclusion != "success") | "\\(.name): \\(.detailsUrl)"'`,
        { cwd: worktreePath },
      );
      ciLogs = stdout.trim();
    } catch {
      this.logger.debug('Could not fetch detailed CI logs');
      ciLogs = `Failed checks: ${failedChecks.join(', ')}`;
    }

    // Format feedback for the brain
    const feedback = `
CI Checks Failed (Attempt ${retryCount}/${maxRetries}):

${ciLogs}

The following CI checks failed:
${failedChecks.map((check) => `- ${check}`).join('\n')}

Please review the CI errors and fix the issues in your code. 
${shouldRetry ? 'You will have another chance to fix this.' : 'This is the final attempt.'}

Make sure to:
1. Review the error messages carefully
2. Fix any linting, type, or test failures
3. Ensure all tests pass locally before committing
`.trim();

    // Update task metadata with retry count and feedback
    await this.taskRepo.update(task.id, {
      metadata: {
        ...metadata,
        ciRetryCount: retryCount,
        lastCIFailure: new Date().toISOString(),
        lastCIFailedChecks: failedChecks,
        lastCIFeedback: feedback, // Store feedback for next execution
      } as any,
    });

    if (shouldRetry) {
      this.logger.log(
        `Will retry task ${task.id} after CI failure (attempt ${retryCount}/${maxRetries})`,
      );
    } else {
      this.logger.warn(
        `Max retries reached for task ${task.id}, will not retry`,
      );
    }

    return { shouldRetry, feedback, retryCount };
  }

  /**
   * Phase 4: Wait for CI checks to start and complete
   * Polls the PR until CI checks are done (success or failure)
   * @deprecated No longer used - CI monitoring now handled by autoCheckPRCI Cron
   */
  // @ts-expect-error - Kept for reference, may be useful for debugging
  private async _waitForCIChecks(
    prUrl: string,
    worktreePath: string,
    maxWaitMinutes: number = 10,
  ): Promise<void> {
    this.logger.debug(
      `Waiting for CI checks to complete (max ${maxWaitMinutes} minutes)`,
    );

    // Skip in test environment
    if (process.env.NODE_ENV === 'test') {
      this.logger.debug('Skipping CI wait in test environment');
      return;
    }

    const startTime = Date.now();
    const maxWaitMs = maxWaitMinutes * 60 * 1000;
    const pollIntervalMs = 30 * 1000; // Poll every 30 seconds

    while (true) {
      try {
        // Check if CI checks have started and completed
        const { stdout } = await execAsync(
          `gh pr checks ${prUrl} --json state,status,conclusion`,
          { cwd: worktreePath },
        );

        const checks = JSON.parse(stdout.trim()) as Array<{
          state: string;
          status: string;
          conclusion: string;
        }>;

        // If no checks yet, continue waiting
        if (checks.length === 0) {
          this.logger.debug('No CI checks found yet, waiting...');
        } else {
          // Check if all checks are completed
          const allCompleted = checks.every(
            (check) =>
              check.status === 'completed' || check.conclusion !== null,
          );

          if (allCompleted) {
            this.logger.log('All CI checks completed');
            return;
          }

          this.logger.debug(
            `CI checks in progress (${checks.filter((c) => c.status === 'completed').length}/${checks.length} completed)`,
          );
        }
      } catch (error) {
        this.logger.debug(
          `Error checking CI status (will retry): ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }

      // Check timeout
      if (Date.now() - startTime > maxWaitMs) {
        throw new Error(
          `CI checks did not complete within ${maxWaitMinutes} minutes`,
        );
      }

      // Wait before next poll
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }
  }

  /**
   * PR Body 생성
   */
  private buildPRBody(task: Task): string {
    const sections: string[] = [];

    sections.push(`## Task: ${task.title}\n`);

    if (task.description) {
      sections.push(`### Description\n${task.description}\n`);
    }

    if (task.acceptanceCriteria) {
      sections.push(`### Acceptance Criteria\n${task.acceptanceCriteria}\n`);
    }

    sections.push(`### Task ID\n${task.id}\n`);

    if (task.requiredSkills && task.requiredSkills.length > 0) {
      sections.push(`### Required Skills\n${task.requiredSkills.join(', ')}\n`);
    }

    sections.push(`---\n🤖 Generated by Hollon AI`);

    return sections.join('\n').replace(/"/g, '\\"'); // Escape quotes for shell
  }

  /**
   * CodeReview 요청 (Phase 2 활용)
   * Phase 3.11: PR URL에서 브랜치명 추출
   */
  /**
   * Phase 4.2: Save PR record to database (without requesting review)
   * This is called immediately after PR creation to enable CI monitoring
   * even if CI checks fail before review can be requested
   */
  private async savePRRecord(
    task: Task,
    prUrl: string,
    authorHollonId: string,
    worktreePath: string,
  ): Promise<string> {
    const prNumber = this.extractPRNumber(prUrl);

    if (!prNumber) {
      this.logger.warn(`Could not extract PR number from ${prUrl}`);
      throw new Error(`Invalid PR URL: ${prUrl}`);
    }

    this.logger.log(
      `Saving PR #${prNumber} to database for task ${task.id.slice(0, 8)}`,
    );

    // Fix #13: Check if PR record already exists (CI retry case)
    const existingPRs = await this.codeReviewPort.findPullRequestsByTaskId(
      task.id,
    );

    if (existingPRs.length > 0) {
      const existingPR = existingPRs.find((pr) => pr.prNumber === prNumber);
      if (existingPR) {
        this.logger.log(
          `Fix #13: PR record already exists for task ${task.id.slice(0, 8)}: ${existingPR.id}`,
        );
        return existingPR.id;
      }
    }

    // Get current branch name
    const { stdout } = await execAsync(`git branch --show-current`, {
      cwd: worktreePath,
    });
    const branchName = stdout.trim();

    // ✅ DDD: TaskPullRequest 생성 (Port 사용) - 리뷰 요청 없이
    const pr = await this.codeReviewPort.createPullRequest({
      taskId: task.id,
      prNumber,
      prUrl,
      repository: task.project.repositoryUrl || 'unknown',
      branchName,
      authorHollonId,
    });

    this.logger.log(`PR record saved to database: ${pr.id}`);
    return pr.id;
  }

  /**
   * @deprecated No longer used - Review requests now handled by autoCheckPRCI Cron after CI passes
   */
  // @ts-expect-error - Kept for reference, may be useful for debugging
  private async _requestCodeReview(task: Task, prUrl: string): Promise<void> {
    const prNumber = this.extractPRNumber(prUrl);

    if (!prNumber) {
      this.logger.warn(`Could not extract PR number from ${prUrl}`);
      return;
    }

    this.logger.log(`Requesting code review for PR #${prNumber}`);

    // Phase 4.2: Find existing PR record (created by savePRRecord)
    const existingPRs = await this.codeReviewPort.findPullRequestsByTaskId(
      task.id,
    );

    if (existingPRs.length === 0) {
      this.logger.error(
        `No PR record found for task ${task.id.slice(0, 8)} - PR should have been saved after creation`,
      );
      throw new Error(`PR record not found for task ${task.id}`);
    }

    const pr = existingPRs[0]; // Get the first (should be only one)
    this.logger.log(`Found existing PR record: ${pr.id}`);

    // ✅ DDD: 리뷰어 자동 할당 (Port 사용)
    await this.codeReviewPort.requestReview(pr.id);
  }

  /**
   * PR URL에서 PR 번호 추출
   */
  /**
   * Phase 4: Check if parent task should be reviewed after subtask completion
   *
   * When a subtask completes, check if ALL sibling subtasks are also complete.
   * If yes, mark the parent task as READY_FOR_REVIEW for manager review.
   * Manager can then decide to:
   * - Approve and continue (execute parent task → create PR)
   * - Request changes or add more subtasks
   * - Change direction if the approach was wrong
   */
  private async checkAndResumeParentTask(subtask: Task): Promise<void> {
    if (!subtask.parentTaskId) {
      // No parent task, nothing to resume
      return;
    }

    this.logger.log(
      `Checking if parent task ${subtask.parentTaskId.slice(0, 8)} should resume after subtask ${subtask.id.slice(0, 8)} completed`,
    );

    // Load parent task with all subtasks
    const parentTask = await this.taskRepo.findOne({
      where: { id: subtask.parentTaskId },
      relations: ['assignedHollon'],
    });

    if (!parentTask) {
      this.logger.warn(
        `Parent task ${subtask.parentTaskId} not found for subtask ${subtask.id}`,
      );
      return;
    }

    // Load all sibling subtasks
    const siblings = await this.taskRepo.find({
      where: { parentTaskId: subtask.parentTaskId },
    });

    // Check if all subtasks are completed
    const allCompleted = siblings.every(
      (s) => s.status === TaskStatus.COMPLETED,
    );

    if (!allCompleted) {
      const completedCount = siblings.filter(
        (s) => s.status === TaskStatus.COMPLETED,
      ).length;
      this.logger.log(
        `Parent task ${parentTask.id.slice(0, 8)}: ${completedCount}/${siblings.length} subtasks completed, waiting for others`,
      );
      return;
    }

    this.logger.log(
      `✅ All ${siblings.length} subtasks completed for parent task ${parentTask.id.slice(0, 8)}, marking as READY_FOR_REVIEW for manager review`,
    );

    // Mark parent task as READY_FOR_REVIEW so manager can review before resuming
    // This allows checking if the direction is still correct or needs adjustment
    await this.taskRepo.update(parentTask.id, {
      status: TaskStatus.READY_FOR_REVIEW,
      assignedHollonId: parentTask.assignedHollonId, // Keep the same hollon
    });

    this.logger.log(
      `Parent task ${parentTask.id.slice(0, 8)} marked as READY_FOR_REVIEW, awaiting manager review before PR creation`,
    );
  }

  private extractPRNumber(prUrl: string): number | null {
    // GitHub PR URL 형식: https://github.com/owner/repo/pull/123
    const match = prUrl.match(/\/pull\/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Phase 3.12: Legacy method - kept for backward compatibility
   * Use cleanupTaskWorktree() for new code
   */
  async cleanupWorktree(worktreePath: string): Promise<void> {
    await this.cleanupTaskWorktree(worktreePath);
  }
}
