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
   * 1. Worktree 생성
   * 2. BrainProvider 실행 (지식 주입 포함)
   * 3. PR 생성
   * 4. CodeReview 요청
   * 5. Worktree 정리
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

    // 1. Worktree 생성
    const worktreePath = await this.createWorktree(task.project, task);
    this.logger.log(`Worktree created: ${worktreePath}`);

    try {
      // 2. Task를 IN_PROGRESS로 변경
      await this.taskRepo.update(taskId, {
        status: TaskStatus.IN_PROGRESS,
        startedAt: new Date(),
      });

      // 3. BrainProvider 실행 (worktree 경로에서)
      await this.executeBrainProvider(hollon, task, worktreePath);

      // 4. PR 생성
      const prUrl = await this.createPullRequest(
        task.project,
        task,
        worktreePath,
      );
      this.logger.log(`PR created: ${prUrl}`);

      // 5. CodeReview 요청 (Phase 2 활용)
      await this.requestCodeReview(task, prUrl, hollonId);

      // 6. Task를 IN_REVIEW로 변경
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
   * Git Worktree 생성
   * feature/task-{taskId} 브랜치로 격리된 작업 환경 생성
   */
  private async createWorktree(project: Project, task: Task): Promise<string> {
    const branchName = `feature/task-${task.id.slice(0, 8)}`;
    const worktreePath = path.join(
      project.workingDirectory,
      '..',
      `task-${task.id.slice(0, 8)}`,
    );

    this.logger.debug(
      `Creating worktree: branch=${branchName}, path=${worktreePath}`,
    );

    try {
      // Worktree 생성
      await execAsync(`git worktree add ${worktreePath} -b ${branchName}`, {
        cwd: project.workingDirectory,
      });

      return worktreePath;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to create worktree: ${errorMessage}`);
      throw new Error(`Worktree creation failed: ${errorMessage}`);
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
   */
  private async createPullRequest(
    _project: Project,
    task: Task,
    worktreePath: string,
  ): Promise<string> {
    const branchName = `feature/task-${task.id.slice(0, 8)}`;

    this.logger.debug(`Creating PR for branch ${branchName}`);

    try {
      // 1. Push to remote
      await execAsync(`git push -u origin ${branchName}`, {
        cwd: worktreePath,
      });

      // 2. PR body 구성
      const prBody = this.buildPRBody(task);

      // 3. Create PR using gh CLI
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
   */
  private async requestCodeReview(
    task: Task,
    prUrl: string,
    authorHollonId: string,
  ): Promise<void> {
    const prNumber = this.extractPRNumber(prUrl);

    if (!prNumber) {
      this.logger.warn(`Could not extract PR number from ${prUrl}`);
      return;
    }

    this.logger.log(`Requesting code review for PR #${prNumber}`);

    // TaskPullRequest 생성 (Phase 2)
    const pr = await this.codeReviewService.createPullRequest({
      taskId: task.id,
      prNumber,
      prUrl,
      repository: task.project.repositoryUrl || 'unknown',
      branchName: `feature/task-${task.id.slice(0, 8)}`,
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
