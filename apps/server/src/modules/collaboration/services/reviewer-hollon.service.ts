import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { promisify } from 'util';
import { exec } from 'child_process';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { BrainProviderService } from '../../brain-provider/brain-provider.service';
import { CodeReviewService } from './code-review.service';
import {
  TaskPullRequest,
  PullRequestStatus,
  ReviewerType,
} from '../entities/task-pull-request.entity';

const execAsync = promisify(exec);

/**
 * Phase 3.5: 리뷰어 Hollon이 PR 자동 리뷰
 * BrainProvider를 활용한 자동화된 코드 리뷰 수행
 */
@Injectable()
export class ReviewerHollonService {
  private readonly logger = new Logger(ReviewerHollonService.name);

  constructor(
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    private readonly brainProvider: BrainProviderService,
    private readonly codeReviewService: CodeReviewService,
  ) {}

  /**
   * PR 자동 리뷰 수행
   * 1. PR diff 다운로드
   * 2. BrainProvider로 리뷰
   * 3. 리뷰 제출
   */
  async performReview(
    prId: string,
    reviewerHollonId: string,
  ): Promise<{
    decision: PullRequestStatus.APPROVED | PullRequestStatus.CHANGES_REQUESTED;
    comments: string;
  }> {
    this.logger.log(
      `Performing review for PR ${prId} by reviewer ${reviewerHollonId}`,
    );

    const pr = await this.codeReviewService.getPullRequest(prId);

    if (!pr) {
      throw new Error(`Pull request ${prId} not found`);
    }

    const hollon = await this.hollonRepo.findOne({
      where: { id: reviewerHollonId },
      relations: ['role', 'team'],
    });

    if (!hollon) {
      throw new Error(`Reviewer hollon ${reviewerHollonId} not found`);
    }

    // 1. PR diff 다운로드
    const diff = await this.fetchPRDiff(pr.prUrl, pr.prNumber);
    this.logger.debug(`Fetched PR diff: ${diff.length} characters`);

    // 2. BrainProvider로 리뷰
    const reviewResult = await this.executeReviewWithBrain(hollon, pr, diff);

    // 3. 리뷰 제출
    await this.codeReviewService.submitReview(prId, reviewerHollonId, {
      decision: reviewResult.decision,
      comments: reviewResult.comments,
    });

    this.logger.log(
      `Review submitted: decision=${reviewResult.decision}, ` +
        `reviewer=${hollon.name}`,
    );

    return reviewResult;
  }

  /**
   * PR diff 다운로드 (gh CLI 사용)
   */
  private async fetchPRDiff(prUrl: string, prNumber: number): Promise<string> {
    try {
      // GitHub PR URL에서 owner/repo 추출
      // 예: https://github.com/owner/repo/pull/123
      const match = prUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
      if (!match) {
        throw new Error(`Invalid GitHub PR URL: ${prUrl}`);
      }

      const [, owner, repo] = match;
      const repoPath = `${owner}/${repo}`;

      this.logger.debug(
        `Fetching diff for ${repoPath} PR #${prNumber} via gh CLI`,
      );

      // gh pr diff 명령으로 diff 가져오기
      const { stdout } = await execAsync(
        `gh pr diff ${prNumber} --repo ${repoPath}`,
      );

      if (!stdout || stdout.trim().length === 0) {
        this.logger.warn(`No diff found for PR #${prNumber}, using API`);
        // Fallback: gh api로 diff 가져오기
        const apiResult = await execAsync(
          `gh api repos/${repoPath}/pulls/${prNumber} --jq '.diff_url' | xargs curl -L`,
        );
        return apiResult.stdout;
      }

      return stdout;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to fetch PR diff: ${errorMessage}`);
      throw new Error(`PR diff fetch failed: ${errorMessage}`);
    }
  }

  /**
   * BrainProvider로 코드 리뷰 실행
   */
  private async executeReviewWithBrain(
    hollon: Hollon,
    pr: TaskPullRequest,
    diff: string,
  ): Promise<{
    decision: PullRequestStatus.APPROVED | PullRequestStatus.CHANGES_REQUESTED;
    comments: string;
  }> {
    // 프롬프트 구성
    const prompt = this.buildReviewPrompt(hollon, pr, diff);

    this.logger.log(
      `Executing brain review: reviewer=${hollon.name}, type=${pr.reviewerType}`,
    );

    // BrainProvider 실행
    const result = await this.brainProvider.executeWithTracking(
      {
        prompt,
        systemPrompt: 'You are an expert code reviewer.',
      },
      {
        organizationId: hollon.team?.organizationId || 'unknown',
        hollonId: hollon.id,
      },
    );

    // 응답 파싱
    const reviewResult = this.parseReviewResult(result.output);

    return reviewResult;
  }

  /**
   * 리뷰 프롬프트 구성
   */
  private buildReviewPrompt(
    hollon: Hollon,
    pr: TaskPullRequest,
    diff: string,
  ): string {
    const sections: string[] = [];

    sections.push(`# Code Review Task\n`);
    sections.push(
      `You are **${hollon.name}**, a ${pr.reviewerType || 'general'} code reviewer.\n`,
    );

    // Reviewer Type별 가이드라인
    sections.push(`## Review Guidelines\n`);
    sections.push(this.getReviewerGuidelines(pr.reviewerType));
    sections.push('\n');

    // PR 정보
    sections.push(`## Pull Request Information\n`);
    sections.push(`- **Branch**: ${pr.branchName}\n`);
    sections.push(`- **PR Number**: #${pr.prNumber}\n`);
    sections.push(`- **Repository**: ${pr.repository}\n`);
    sections.push(`- **URL**: ${pr.prUrl}\n\n`);

    // Code Changes
    sections.push(`## Code Changes\n`);
    sections.push('```diff\n');
    // Diff가 너무 길면 잘라내기 (10000자 제한)
    const truncatedDiff =
      diff.length > 10000
        ? diff.substring(0, 10000) + '\n... (truncated)'
        : diff;
    sections.push(truncatedDiff);
    sections.push('\n```\n\n');

    // Output 형식
    sections.push(`## Instructions\n`);
    sections.push(
      `Please review the code changes above and provide your feedback in the following JSON format:\n\n`,
    );
    sections.push('```json\n');
    sections.push('{\n');
    sections.push('  "approved": true,\n');
    sections.push('  "comments": "Your detailed review comments here"\n');
    sections.push('}\n');
    sections.push('```\n\n');

    sections.push(
      `**Important**: Your response must be valid JSON only, no additional text.\n`,
    );

    return sections.join('');
  }

  /**
   * Reviewer Type별 가이드라인
   */
  private getReviewerGuidelines(type: ReviewerType | null): string {
    switch (type) {
      case ReviewerType.SECURITY_REVIEWER:
        return `As a **Security Reviewer**, focus on:
- SQL injection vulnerabilities
- XSS (Cross-Site Scripting) risks
- Hardcoded secrets or credentials
- Authentication and authorization issues
- Input validation and sanitization
- Secure communication (HTTPS, encryption)
- Dependency vulnerabilities`;

      case ReviewerType.ARCHITECTURE_REVIEWER:
        return `As an **Architecture Reviewer**, focus on:
- SOLID principles adherence
- Design patterns usage
- Code modularity and separation of concerns
- System scalability and extensibility
- Technical debt introduction
- Maintainability and testability
- Proper abstraction levels`;

      case ReviewerType.PERFORMANCE_REVIEWER:
        return `As a **Performance Reviewer**, focus on:
- N+1 query problems
- Missing database indexes
- Caching opportunities
- Algorithm complexity (time/space)
- Memory leaks
- Unnecessary computations
- Efficient data structures`;

      default:
        return `As a **General Code Reviewer**, focus on:
- Code quality and readability
- Proper error handling
- Test coverage
- Documentation completeness
- Code style consistency
- Edge cases handling
- Potential bugs`;
    }
  }

  /**
   * BrainProvider 응답 파싱
   */
  private parseReviewResult(output: string): {
    decision: PullRequestStatus.APPROVED | PullRequestStatus.CHANGES_REQUESTED;
    comments: string;
  } {
    try {
      // JSON 추출 (코드 블록 내부에 있을 수 있음)
      const jsonMatch = output.match(/\{[\s\S]*"approved"[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in review output');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      if (typeof parsed.approved !== 'boolean') {
        throw new Error('Invalid "approved" field in review result');
      }

      if (typeof parsed.comments !== 'string') {
        throw new Error('Invalid "comments" field in review result');
      }

      return {
        decision: parsed.approved
          ? PullRequestStatus.APPROVED
          : PullRequestStatus.CHANGES_REQUESTED,
        comments: parsed.comments,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to parse review result: ${errorMessage}`);
      this.logger.debug(`Raw output: ${output}`);

      // Fallback: 기본 응답
      return {
        decision: PullRequestStatus.CHANGES_REQUESTED,
        comments: `Review parsing failed. Raw output:\n${output}`,
      };
    }
  }
}
