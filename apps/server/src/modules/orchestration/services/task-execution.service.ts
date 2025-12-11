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

    // 1. Hollon별 Worktree 확보 (재사용 전략 - Phase 3.11)
    const worktreePath = await this.getOrCreateWorktree(task.project, hollon);
    this.logger.log(`Worktree ready: ${worktreePath}`);

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

      // Worktree 정리 (에러 발생 시)
      await this.cleanupWorktree(worktreePath).catch((cleanupError) => {
        const cleanupErrorMessage =
          cleanupError instanceof Error
            ? cleanupError.message
            : 'Unknown error';
        this.logger.warn(`Worktree cleanup failed: ${cleanupErrorMessage}`);
      });

      throw error;
    }
  }

  /**
   * Phase 3.11: Hollon별 Worktree 확보 (재사용 전략)
   * - 홀론당 1개의 worktree 생성
   * - 이미 존재하면 재사용
   * - 경로: {projectDir}/../.git-worktrees/worktree-{hollonId}
   */
  private async getOrCreateWorktree(
    project: Project,
    hollon: Hollon,
  ): Promise<string> {
    const worktreePath = path.join(
      project.workingDirectory,
      '..',
      '.git-worktrees',
      `worktree-${hollon.id.slice(0, 8)}`,
    );

    // Check if worktree exists
    const exists = await this.worktreeExists(worktreePath);

    if (!exists) {
      // Create new worktree
      this.logger.debug(`Creating new worktree for hollon ${hollon.name}`);

      try {
        // Ensure .git-worktrees directory exists
        const worktreesDir = path.join(
          project.workingDirectory,
          '..',
          '.git-worktrees',
        );
        await execAsync(`mkdir -p ${worktreesDir}`);

        // Create worktree (checkout main branch as base)
        await execAsync(`git worktree add ${worktreePath}`, {
          cwd: project.workingDirectory,
        });

        this.logger.log(`Worktree created for hollon ${hollon.name}`);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.error(`Failed to create worktree: ${errorMessage}`);
        throw new Error(`Worktree creation failed: ${errorMessage}`);
      }
    } else {
      // Reuse existing worktree
      this.logger.log(`Reusing worktree for hollon ${hollon.name}`);

      try {
        // Fetch latest changes
        await execAsync(`git fetch origin`, { cwd: worktreePath });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(`Failed to fetch in worktree: ${errorMessage}`);
      }
    }

    return worktreePath;
  }

  /**
   * Phase 3.11: Hollon별 브랜치 생성
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
      // Create and checkout branch from origin/main
      await execAsync(`git checkout -b ${branchName} origin/main`, {
        cwd: worktreePath,
      });

      this.logger.log(`Branch created: ${branchName}`);
      return branchName;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create branch: ${errorMessage}`);
      throw new Error(`Branch creation failed: ${errorMessage}`);
    }
  }

  /**
   * Phase 3.11: Worktree 존재 여부 확인
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
   * Worktree 정리
   */
  async cleanupWorktree(worktreePath: string): Promise<void> {
    this.logger.debug(`Cleaning up worktree: ${worktreePath}`);

    try {
      await execAsync(`git worktree remove ${worktreePath} --force`);
      this.logger.log(`Worktree removed: ${worktreePath}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to remove worktree: ${errorMessage}`);
      throw new Error(`Worktree cleanup failed: ${errorMessage}`);
    }
  }
}
