import { Injectable, Logger } from '@nestjs/common';
import { Task } from '../../task/entities/task.entity';
import { BrainResponse } from '../../brain-provider/interfaces/brain-provider.interface';

export interface ValidationResult {
  passed: boolean;
  shouldRetry: boolean;
  reason?: string;
  details?: Record<string, unknown>;
}

export interface QualityCheckContext {
  task: Task;
  brainResult: BrainResponse;
  organizationId: string;
  costLimitDailyCents?: number;
  costLimitMonthlyCents?: number;
}

@Injectable()
export class QualityGateService {
  private readonly logger = new Logger(QualityGateService.name);

  /**
   * Run all quality gate checks on brain execution result
   * Returns validation result indicating whether the result passes quality standards
   */
  async validateResult(context: QualityCheckContext): Promise<ValidationResult> {
    this.logger.log(
      `Running quality gate for task ${context.task.id} (${context.task.title})`,
    );

    // 1. Check if result exists and is not empty
    const resultCheck = this.checkResultExists(context.brainResult);
    if (!resultCheck.passed) {
      return resultCheck;
    }

    // 2. Check format compliance (basic validation for now)
    const formatCheck = this.checkFormatCompliance(
      context.task,
      context.brainResult,
    );
    if (!formatCheck.passed) {
      return formatCheck;
    }

    // 3. Check code quality (basic validation)
    const qualityCheck = this.checkCodeQuality(context.brainResult);
    if (!qualityCheck.passed) {
      return qualityCheck;
    }

    // 4. Check cost is within budget
    const costCheck = this.checkCostWithinBudget(
      context.brainResult,
      context.costLimitDailyCents,
    );
    if (!costCheck.passed) {
      return costCheck;
    }

    this.logger.log(
      `Quality gate passed for task ${context.task.id}: all checks successful`,
    );

    return {
      passed: true,
      shouldRetry: false,
    };
  }

  /**
   * Check 1: Verify result exists and is not empty
   */
  private checkResultExists(brainResult: BrainResponse): ValidationResult {
    if (!brainResult.output || brainResult.output.trim().length === 0) {
      this.logger.warn('Quality gate failed: Empty result');
      return {
        passed: false,
        shouldRetry: true,
        reason: 'Brain execution returned empty result',
        details: {
          checkType: 'result_exists',
          outputLength: brainResult.output?.length || 0,
        },
      };
    }

    // Check if output is suspiciously short (likely an error message)
    if (brainResult.output.trim().length < 10) {
      this.logger.warn(
        `Quality gate failed: Suspiciously short result (${brainResult.output.length} chars)`,
      );
      return {
        passed: false,
        shouldRetry: true,
        reason: 'Result is too short to be a valid response',
        details: {
          checkType: 'result_exists',
          outputLength: brainResult.output.length,
        },
      };
    }

    return { passed: true, shouldRetry: false };
  }

  /**
   * Check 2: Verify format compliance with task requirements
   * For now, basic validation. Can be enhanced with task-specific format rules
   */
  private checkFormatCompliance(
    task: Task,
    brainResult: BrainResponse,
  ): ValidationResult {
    const output = brainResult.output;

    // Check for common error patterns in output
    const errorPatterns = [
      /^Error:/i,
      /^Fatal:/i,
      /^Exception:/i,
      /command not found/i,
      /permission denied/i,
    ];

    for (const pattern of errorPatterns) {
      if (pattern.test(output)) {
        this.logger.warn(
          `Quality gate failed: Error pattern detected in output: ${pattern}`,
        );
        return {
          passed: false,
          shouldRetry: true,
          reason: 'Output contains error messages',
          details: {
            checkType: 'format_compliance',
            errorPattern: pattern.toString(),
          },
        };
      }
    }

    // For code tasks, check if output looks like code
    if (
      task.type === 'implementation' ||
      task.type === 'bug_fix'
    ) {
      // Basic heuristic: code should contain common programming elements
      const hasCodeIndicators =
        /\bfunction\b|\bclass\b|\bconst\b|\blet\b|\bvar\b|\bimport\b|\bexport\b|\breturn\b/i.test(
          output,
        ) ||
        /\{.*\}/s.test(output) || // Contains braces
        /;/g.test(output); // Contains semicolons

      if (!hasCodeIndicators && output.length > 100) {
        this.logger.warn(
          'Quality gate warning: Implementation task result does not look like code',
        );
        // This is a warning, not a failure - allow it to pass but log
      }
    }

    return { passed: true, shouldRetry: false };
  }

  /**
   * Check 3: Basic code quality validation
   * Future enhancements: run actual linters, syntax checkers
   */
  private checkCodeQuality(brainResult: BrainResponse): ValidationResult {
    const output = brainResult.output;

    // Check for TODO/FIXME markers (indicating incomplete work)
    const incompletionMarkers = ['TODO', 'FIXME', 'XXX', 'HACK'];
    const foundMarkers = incompletionMarkers.filter((marker) =>
      output.includes(marker),
    );

    if (foundMarkers.length > 0) {
      this.logger.warn(
        `Quality gate warning: Found incompletion markers: ${foundMarkers.join(', ')}`,
      );
      // This is a warning, not a failure - the work might intentionally include TODOs
    }

    // Check for extremely long lines (potential code quality issue)
    const lines = output.split('\n');
    const longLines = lines.filter((line) => line.length > 200);
    if (longLines.length > 5) {
      this.logger.warn(
        `Quality gate warning: Found ${longLines.length} extremely long lines`,
      );
      // Warning only
    }

    return { passed: true, shouldRetry: false };
  }

  /**
   * Check 4: Verify cost is within budget limits
   */
  private checkCostWithinBudget(
    brainResult: BrainResponse,
    dailyLimitCents?: number,
  ): ValidationResult {
    const costCents = brainResult.cost.totalCostCents;

    // If no limit is set, always pass
    if (!dailyLimitCents) {
      return { passed: true, shouldRetry: false };
    }

    // Check if single execution exceeds reasonable threshold (10% of daily limit)
    const singleExecutionThreshold = dailyLimitCents * 0.1;
    if (costCents > singleExecutionThreshold) {
      this.logger.warn(
        `Quality gate failed: Cost too high ($${costCents.toFixed(4)} > $${singleExecutionThreshold.toFixed(4)})`,
      );
      return {
        passed: false,
        shouldRetry: false, // Don't retry - cost will likely be high again
        reason: 'Execution cost exceeds single-task threshold (10% of daily limit)',
        details: {
          checkType: 'cost_validation',
          actualCostCents: costCents,
          thresholdCents: singleExecutionThreshold,
          dailyLimitCents,
        },
      };
    }

    this.logger.log(
      `Cost validation passed: $${costCents.toFixed(4)} (threshold: $${singleExecutionThreshold.toFixed(4)})`,
    );

    return { passed: true, shouldRetry: false };
  }

  /**
   * Check 5: Verify tests are passing (if test files exist)
   * Placeholder for future implementation
   * This would need to:
   * 1. Detect if task involves testable code
   * 2. Run test suite in working directory
   * 3. Parse test results
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private async _checkTestsPassing(
    _workingDirectory?: string,
  ): Promise<ValidationResult> {
    // TODO: Implement test execution and validation
    // For now, always pass
    return { passed: true, shouldRetry: false };
  }
}
