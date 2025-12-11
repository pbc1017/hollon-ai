import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promisify } from 'util';
import { exec } from 'child_process';
import * as path from 'path';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import { Project } from '../../project/entities/project.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { BrainProviderService } from '../../brain-provider/brain-provider.service';
import { CodeReviewService } from '../../collaboration/services/code-review.service';
import { KnowledgeContext } from '../../brain-provider/services/knowledge-injection.service';

const execAsync = promisify(exec);

/**
 * Phase 3.5: Task 실행 → Worktree → 코딩 → 커밋 → PR 생성
 * Git Worktree를 활용한 격리된 작업 환경 제공
 */
@Injectable()
export class TaskExecutionService {
  private readonly logger = new Logger(TaskExecutionService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    private readonly brainProvider: BrainProviderService,
    private readonly codeReviewService: CodeReviewService,
  ) {}

  /**
   * Task 실행 전체 플로우
   * Phase 3.11: Hollon별 Worktree 재사용 + Hollon 이름이 포함된 브랜치
   * 1. Hollon별 Worktree 확보 (재사용 전략)
   * 2. Hollon별 브랜치 생성
   * 3. BrainProvider 실행 (지식 주입 포함)
   * 4. PR 생성
   * 5. CodeReview 요청
   */
  async executeTask(
    taskId: string,
    hollonId: string,
  ): Promise<{ prUrl: string; worktreePath: string }> {
    this.logger.log(`Executing task ${taskId} by hollon ${hollonId}`);

    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['project', 'project.organization'],
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

      // 4. BrainProvider 실행 (worktree 경로에서)
      await this.executeBrainProvider(hollon, task, worktreePath);

      // 5. PR 생성
      const prUrl = await this.createPullRequest(
        task.project,
        task,
        worktreePath,
      );
      this.logger.log(`PR created: ${prUrl}`);

      // 6. CodeReview 요청 (Phase 2 활용)
      await this.requestCodeReview(task, prUrl, hollonId, worktreePath);

      // 7. Task를 IN_REVIEW로 변경
      await this.taskRepo.update(taskId, {
        status: TaskStatus.IN_REVIEW,
      });

      return { prUrl, worktreePath };
    } catch (error) {
      this.logger.error(
        `Task execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      // Phase 3.12: Task worktree 정리 (에러 발생 시)
      await this.cleanupTaskWorktree(worktreePath).catch(() => {
        // Already logged in cleanupTaskWorktree
      });

      throw error;
    }
  }

  /**
   * Phase 3.12: Task별 Worktree 생성 (완전 격리 전략)
   * - Task당 1개의 독립적인 worktree 생성
   * - 경로: {projectDir}/../.git-worktrees/hollon-{hollonId}/task-{taskId}
   * - 장점: 완전 격리, Git 충돌 없음, 병렬 처리 가능
   */
  private async getOrCreateWorktree(
    project: Project,
    hollon: Hollon,
    task: Task,
  ): Promise<string> {
    const worktreePath = path.join(
      project.workingDirectory,
      '..',
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

    // Create new worktree for this task
    this.logger.log(
      `Creating task worktree for ${hollon.name} / task ${task.id.slice(0, 8)}`,
    );

    try {
      // Ensure parent directory exists
      const hollonDir = path.join(
        project.workingDirectory,
        '..',
        '.git-worktrees',
        `hollon-${hollon.id.slice(0, 8)}`,
      );
      await execAsync(`mkdir -p ${hollonDir}`);

      // Create unique temporary branch name for worktree
      const tempBranch = `wt-hollon-${hollon.id.slice(0, 8)}-task-${task.id.slice(0, 8)}`;

      // Create worktree with explicit branch from main
      await execAsync(
        `git worktree add -b ${tempBranch} ${worktreePath} main`,
        {
          cwd: project.workingDirectory,
        },
      );

      this.logger.log(
        `Task worktree created: hollon-${hollon.id.slice(0, 8)}/task-${task.id.slice(0, 8)}`,
      );
    } catch (error: unknown) {
      const err = error as Error & { stderr?: string };
      const errorMessage = err?.message || 'Unknown error';
      const stderr = err?.stderr || '';
      const fullError = stderr
        ? `${errorMessage}\nstderr: ${stderr}`
        : errorMessage;
      this.logger.error(`Failed to create task worktree: ${fullError}`);
      throw new Error(`Task worktree creation failed: ${fullError}`);
    }

    return worktreePath;
  }

  /**
   * Phase 3.12: Hollon별 브랜치 생성 (Task worktree 내)
   * - 브랜치명: feature/{hollonName}/task-{taskId}
   * - 작업자를 브랜치명으로 명확히 식별
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
      // The worktree was created with a temporary branch, now rename it to the feature branch
      await execAsync(`git branch -m ${branchName}`, {
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
   * Phase 3.12: Task worktree 정리 (Task 완료 후 호출)
   * PR merge 후 자동으로 호출되어 worktree 삭제
   */
  async cleanupTaskWorktree(worktreePath: string): Promise<void> {
    this.logger.debug(`Cleaning up task worktree: ${worktreePath}`);

    try {
      await execAsync(`git worktree remove ${worktreePath} --force`);
      this.logger.log(`Task worktree removed: ${worktreePath}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Failed to remove task worktree: ${errorMessage}`);
      // Don't throw - cleanup failures shouldn't block task completion
    }
  }

  /**
   * BrainProvider 실행 (지식 주입 포함)
   */
  private async executeBrainProvider(
    hollon: Hollon,
    task: Task,
    worktreePath: string,
  ): Promise<void> {
    // 프롬프트 구성
    const prompt = this.buildTaskPrompt(task);

    // Knowledge Context 구성 (Phase 3.5)
    const knowledgeContext: KnowledgeContext = {
      task,
      organizationId: task.project.organizationId,
      projectId: task.projectId,
      requiredSkills: task.requiredSkills,
      tags: task.tags,
    };

    this.logger.log(`Executing brain provider for task ${task.id}`);

    // BrainProvider 실행 (자동으로 지식 주입됨)
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
      knowledgeContext, // Phase 3.5: 지식 주입
    );

    this.logger.log(
      `Brain execution completed: cost=${result.cost.totalCostCents.toFixed(4)}`,
    );
  }

  /**
   * Task 프롬프트 생성
   */
  private buildTaskPrompt(task: Task): string {
    const sections: string[] = [];

    sections.push(`# Task: ${task.title}\n`);

    if (task.description) {
      sections.push(`## Description\n${task.description}\n`);
    }

    if (task.acceptanceCriteria) {
      sections.push(`## Acceptance Criteria\n${task.acceptanceCriteria}\n`);
    }

    if (task.affectedFiles && task.affectedFiles.length > 0) {
      sections.push(`## Affected Files\n${task.affectedFiles.join('\n')}\n`);
    }

    sections.push(
      `## Instructions\n` +
        `Please implement the task described above. ` +
        `Make sure to:\n` +
        `1. Write clean, maintainable code\n` +
        `2. Follow the project's coding standards\n` +
        `3. Add appropriate tests if needed\n` +
        `4. Update documentation if required\n` +
        `5. Commit your changes with a descriptive message\n`,
    );

    return sections.join('\n');
  }

  /**
   * Pull Request 생성
   * Phase 3.11: 현재 브랜치를 자동 감지 (feature/{hollonName}/task-{id})
   */
  private async createPullRequest(
    _project: Project,
    task: Task,
    worktreePath: string,
  ): Promise<string> {
    this.logger.debug(`Creating PR for task ${task.id}`);

    // Skip PR creation in test environment (no GitHub remote)
    if (process.env.NODE_ENV === 'test') {
      this.logger.debug(`Skipping PR creation in test environment`);
      return `https://github.com/test/repo/pull/${Math.floor(Math.random() * 1000)}`;
    }

    try {
      // 1. Get current branch name
      const { stdout: branchName } = await execAsync(
        `git branch --show-current`,
        { cwd: worktreePath },
      );
      const currentBranch = branchName.trim();

      this.logger.debug(`Current branch: ${currentBranch}`);

      // 2. Push to remote
      await execAsync(`git push -u origin ${currentBranch}`, {
        cwd: worktreePath,
      });

      // 3. PR body 구성
      const prBody = this.buildPRBody(task);

      // 4. Create PR using gh CLI
      const { stdout } = await execAsync(
        `gh pr create --title "${task.title}" --body "${prBody}" --base main`,
        { cwd: worktreePath },
      );

      const prUrl = stdout.trim();
      return prUrl;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create PR: ${errorMessage}`);
      throw new Error(`PR creation failed: ${errorMessage}`);
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
  private async requestCodeReview(
    task: Task,
    prUrl: string,
    authorHollonId: string,
    worktreePath: string,
  ): Promise<void> {
    const prNumber = this.extractPRNumber(prUrl);

    if (!prNumber) {
      this.logger.warn(`Could not extract PR number from ${prUrl}`);
      return;
    }

    this.logger.log(`Requesting code review for PR #${prNumber}`);

    // Get current branch name
    const { stdout } = await execAsync(`git branch --show-current`, {
      cwd: worktreePath,
    });
    const branchName = stdout.trim();

    // TaskPullRequest 생성 (Phase 2)
    const pr = await this.codeReviewService.createPullRequest({
      taskId: task.id,
      prNumber,
      prUrl,
      repository: task.project.repositoryUrl || 'unknown',
      branchName, // Phase 3.11: 동적 브랜치명 (feature/{hollonName}/task-{id})
      authorHollonId,
    });

    // 리뷰어 자동 할당 (Phase 2)
    await this.codeReviewService.requestReview(pr.id);
  }

  /**
   * PR URL에서 PR 번호 추출
   */
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
