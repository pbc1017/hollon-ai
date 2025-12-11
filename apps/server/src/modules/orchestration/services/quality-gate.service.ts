import { Injectable, Logger } from '@nestjs/common';
import { Task } from '../../task/entities/task.entity';
import { BrainResponse } from '../../brain-provider/interfaces/brain-provider.interface';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

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
  async validateResult(
    context: QualityCheckContext,
  ): Promise<ValidationResult> {
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

    // 5. Run lint check (optional, only if affected files specified)
    const lintCheck = await this.checkLint(context.task);
    if (!lintCheck.passed) {
      return lintCheck;
    }

    // 6. Run TypeScript compilation check (optional, only if affected files specified)
    const tsCheck = await this.checkTypeScriptCompilation(context.task);
    if (!tsCheck.passed) {
      return tsCheck;
    }

    // 7. Run tests (Phase 3.15 - optional, only if test files exist)
    const testCheck = await this.checkTestsPassing(context.task);
    if (!testCheck.passed) {
      return testCheck;
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
    if (task.type === 'implementation' || task.type === 'bug_fix') {
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
   * Includes: static analysis, incomplete markers, code style
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
   * Check 4a: Run ESLint on affected files
   * This is an optional validation that runs if affected files are specified
   */
  async checkLint(task: Task): Promise<ValidationResult> {
    // Skip if no affected files or not in a project with working directory
    if (!task.affectedFiles || task.affectedFiles.length === 0) {
      return { passed: true, shouldRetry: false };
    }

    if (!task.project?.workingDirectory) {
      this.logger.debug('No working directory specified, skipping lint check');
      return { passed: true, shouldRetry: false };
    }

    try {
      // Check if files actually exist
      const existingFiles = task.affectedFiles.filter((file) =>
        existsSync(join(task.project!.workingDirectory!, file)),
      );

      if (existingFiles.length === 0) {
        this.logger.debug('No affected files exist yet, skipping lint check');
        return { passed: true, shouldRetry: false };
      }

      const files = existingFiles.join(' ');
      this.logger.log(`Running ESLint on: ${files}`);

      execSync(`npx eslint ${files} --format json`, {
        cwd: task.project.workingDirectory,
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      this.logger.log('Lint check passed');
      return { passed: true, shouldRetry: false };
    } catch (error: unknown) {
      // Parse ESLint JSON output if available
      let errorCount = 0;
      let warningCount = 0;

      try {
        const errorWithOutput = error as { stdout?: string };
        const results = JSON.parse(errorWithOutput.stdout || '[]') as Array<{
          errorCount: number;
          warningCount: number;
        }>;
        errorCount = results.reduce((sum: number, r) => sum + r.errorCount, 0);
        warningCount = results.reduce(
          (sum: number, r) => sum + r.warningCount,
          0,
        );
      } catch {
        // If parsing fails, treat as generic error
      }

      this.logger.warn(
        `Lint check failed: ${errorCount} errors, ${warningCount} warnings`,
      );

      return {
        passed: false,
        shouldRetry: true, // Retry - the Brain can fix lint issues
        reason: `ESLint found ${errorCount} error(s) and ${warningCount} warning(s)`,
        details: {
          checkType: 'lint',
          errorCount,
          warningCount,
        },
      };
    }
  }

  /**
   * Check 4b: Run TypeScript compiler check on affected files
   * This validates that the generated code compiles without errors
   */
  async checkTypeScriptCompilation(task: Task): Promise<ValidationResult> {
    // Skip if no affected files or not in a project with working directory
    if (!task.affectedFiles || task.affectedFiles.length === 0) {
      return { passed: true, shouldRetry: false };
    }

    if (!task.project?.workingDirectory) {
      this.logger.debug(
        'No working directory specified, skipping TypeScript check',
      );
      return { passed: true, shouldRetry: false };
    }

    try {
      // Check if files actually exist
      const existingFiles = task.affectedFiles.filter((file) =>
        existsSync(join(task.project!.workingDirectory!, file)),
      );

      if (existingFiles.length === 0) {
        this.logger.debug(
          'No affected files exist yet, skipping TypeScript check',
        );
        return { passed: true, shouldRetry: false };
      }

      this.logger.log('Running TypeScript compiler check');

      // Run tsc --noEmit to check for type errors without generating output
      execSync('npx tsc --noEmit', {
        cwd: task.project.workingDirectory,
        stdio: 'pipe',
        encoding: 'utf-8',
      });

      this.logger.log('TypeScript compilation check passed');
      return { passed: true, shouldRetry: false };
    } catch (error: unknown) {
      const errorWithOutput = error as {
        stdout?: string;
        stderr?: string;
      };
      const errorOutput =
        errorWithOutput.stdout || errorWithOutput.stderr || '';

      // Count errors
      const errorLines = errorOutput
        .split('\n')
        .filter((line: string) => line.includes('error TS'));
      const errorCount = errorLines.length;

      this.logger.warn(
        `TypeScript compilation check failed: ${errorCount} error(s)`,
      );

      return {
        passed: false,
        shouldRetry: true, // Retry - the Brain can fix type errors
        reason: `TypeScript compiler found ${errorCount} error(s)`,
        details: {
          checkType: 'typescript',
          errorCount,
          errors: errorLines.slice(0, 10), // First 10 errors
        },
      };
    }
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
        reason:
          'Execution cost exceeds single-task threshold (10% of daily limit)',
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
  /**
   * Check 5: Verify tests are passing (if test files exist)
   * Phase 3.15: Complete implementation
   *
   * Runs Jest tests and validates results
   */
  private async checkTestsPassing(task: Task): Promise<ValidationResult> {
    // Skip if no affected files or not in a project with working directory
    if (!task.affectedFiles || task.affectedFiles.length === 0) {
      return { passed: true, shouldRetry: false };
    }

    if (!task.project?.workingDirectory) {
      this.logger.debug('No working directory specified, skipping test check');
      return { passed: true, shouldRetry: false };
    }

    try {
      // Check if test files exist
      const testFiles = task.affectedFiles.filter(
        (file) =>
          file.includes('.spec.') ||
          file.includes('.test.') ||
          file.includes('__tests__'),
      );

      if (testFiles.length === 0) {
        this.logger.debug(
          'No test files in affected files, skipping test check',
        );
        return { passed: true, shouldRetry: false };
      }

      this.logger.log(`Running tests for ${testFiles.length} test file(s)`);

      // Run Jest tests with JSON output
      // --passWithNoTests: Don't fail if no tests found
      // --bail: Stop at first failure for faster feedback
      // --json: Output results as JSON
      const testCommand = `npx jest ${testFiles.join(' ')} --passWithNoTests --bail --json`;

      const result = execSync(testCommand, {
        cwd: task.project.workingDirectory,
        stdio: 'pipe',
        encoding: 'utf-8',
        timeout: 300000, // 5 minutes timeout
      });

      // Parse Jest JSON output
      const testResult = JSON.parse(result) as {
        success: boolean;
        numTotalTests: number;
        numPassedTests: number;
        numFailedTests: number;
        numPendingTests: number;
        testResults: Array<{
          assertionResults: Array<{
            status: string;
            title: string;
            failureMessages: string[];
          }>;
        }>;
      };

      if (!testResult.success) {
        const failedTests = testResult.testResults.flatMap((tr) =>
          tr.assertionResults
            .filter((ar) => ar.status === 'failed')
            .map((ar) => ar.title),
        );

        this.logger.warn(
          `Tests failed: ${testResult.numFailedTests}/${testResult.numTotalTests} failed`,
        );

        return {
          passed: false,
          shouldRetry: true, // Retry - tests might pass after code fixes
          reason: `${testResult.numFailedTests} test(s) failed`,
          details: {
            checkType: 'tests',
            totalTests: testResult.numTotalTests,
            passedTests: testResult.numPassedTests,
            failedTests: testResult.numFailedTests,
            pendingTests: testResult.numPendingTests,
            failedTestNames: failedTests.slice(0, 10), // First 10 failed tests
          },
        };
      }

      this.logger.log(
        `All tests passed: ${testResult.numPassedTests}/${testResult.numTotalTests}`,
      );
      return { passed: true, shouldRetry: false };
    } catch (error: unknown) {
      // Jest returns non-zero exit code on test failure
      const err = error as {
        stdout?: string;
        stderr?: string;
        status?: number;
      };

      // Try to parse JSON output even from failed execution
      try {
        const output = err.stdout || '';
        if (output) {
          const testResult = JSON.parse(output) as {
            success: boolean;
            numFailedTests: number;
            numTotalTests: number;
          };
          this.logger.warn(
            `Tests failed: ${testResult.numFailedTests}/${testResult.numTotalTests}`,
          );
          return {
            passed: false,
            shouldRetry: true,
            reason: `${testResult.numFailedTests} test(s) failed`,
            details: {
              checkType: 'tests',
              errorOutput: output.substring(0, 500),
            },
          };
        }
      } catch {
        // Parsing failed, treat as generic error
      }

      const errorMessage = err.stderr || err.stdout || 'Test execution failed';
      this.logger.error(`Test execution error: ${errorMessage}`);

      return {
        passed: false,
        shouldRetry: true, // Retry - might be transient error
        reason: 'Test execution failed',
        details: {
          checkType: 'tests',
          error: errorMessage.substring(0, 500),
        },
      };
    }
  }
}
