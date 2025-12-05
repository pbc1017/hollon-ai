import { Test, TestingModule } from '@nestjs/testing';
import { QualityGateService } from './quality-gate.service';
import { Task, TaskType } from '../../task/entities/task.entity';
import { BrainResponse } from '../../brain-provider/interfaces/brain-provider.interface';

describe('QualityGateService', () => {
  let service: QualityGateService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [QualityGateService],
    }).compile();

    service = module.get<QualityGateService>(QualityGateService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateResult', () => {
    const mockTask: Partial<Task> = {
      id: 'task-1',
      title: 'Test Task',
      type: TaskType.IMPLEMENTATION,
    };

    const mockBrainResult: BrainResponse = {
      success: true,
      output: 'function test() { return true; }',
      duration: 1000,
      cost: {
        inputTokens: 100,
        outputTokens: 50,
        totalCostCents: 0.5,
      },
    };

    it('should pass validation for valid result', async () => {
      const result = await service.validateResult({
        task: mockTask as Task,
        brainResult: mockBrainResult,
        organizationId: 'org-1',
        costLimitDailyCents: 100,
      });

      expect(result.passed).toBe(true);
      expect(result.shouldRetry).toBe(false);
    });

    it('should fail if result is empty', async () => {
      const emptyResult: BrainResponse = {
        ...mockBrainResult,
        output: '',
      };

      const result = await service.validateResult({
        task: mockTask as Task,
        brainResult: emptyResult,
        organizationId: 'org-1',
      });

      expect(result.passed).toBe(false);
      expect(result.shouldRetry).toBe(true);
      expect(result.reason).toContain('empty');
    });

    it('should fail if result is too short', async () => {
      const shortResult: BrainResponse = {
        ...mockBrainResult,
        output: 'Error',
      };

      const result = await service.validateResult({
        task: mockTask as Task,
        brainResult: shortResult,
        organizationId: 'org-1',
      });

      expect(result.passed).toBe(false);
      expect(result.shouldRetry).toBe(true);
      expect(result.reason).toContain('too short');
    });

    it('should fail if output contains error patterns', async () => {
      const errorResult: BrainResponse = {
        ...mockBrainResult,
        output: 'Error: Command failed with exit code 1',
      };

      const result = await service.validateResult({
        task: mockTask as Task,
        brainResult: errorResult,
        organizationId: 'org-1',
      });

      expect(result.passed).toBe(false);
      expect(result.shouldRetry).toBe(true);
      expect(result.reason).toContain('error messages');
    });

    it('should fail if cost exceeds threshold', async () => {
      const expensiveResult: BrainResponse = {
        ...mockBrainResult,
        cost: {
          inputTokens: 10000,
          outputTokens: 5000,
          totalCostCents: 50, // 50% of daily limit
        },
      };

      const result = await service.validateResult({
        task: mockTask as Task,
        brainResult: expensiveResult,
        organizationId: 'org-1',
        costLimitDailyCents: 100,
      });

      expect(result.passed).toBe(false);
      expect(result.shouldRetry).toBe(false); // Don't retry expensive operations
      expect(result.reason).toContain('cost');
    });

    it('should pass if no cost limit is set', async () => {
      const expensiveResult: BrainResponse = {
        ...mockBrainResult,
        cost: {
          inputTokens: 10000,
          outputTokens: 5000,
          totalCostCents: 50,
        },
      };

      const result = await service.validateResult({
        task: mockTask as Task,
        brainResult: expensiveResult,
        organizationId: 'org-1',
        // No cost limit
      });

      expect(result.passed).toBe(true);
    });

    it('should pass if cost is within threshold', async () => {
      const affordableResult: BrainResponse = {
        ...mockBrainResult,
        cost: {
          inputTokens: 100,
          outputTokens: 50,
          totalCostCents: 5, // 5% of daily limit
        },
      };

      const result = await service.validateResult({
        task: mockTask as Task,
        brainResult: affordableResult,
        organizationId: 'org-1',
        costLimitDailyCents: 100,
      });

      expect(result.passed).toBe(true);
    });

    it('should handle fatal error patterns', async () => {
      const fatalResult: BrainResponse = {
        ...mockBrainResult,
        output: 'Fatal: System crash detected',
      };

      const result = await service.validateResult({
        task: mockTask as Task,
        brainResult: fatalResult,
        organizationId: 'org-1',
      });

      expect(result.passed).toBe(false);
      expect(result.shouldRetry).toBe(true);
    });

    it('should handle permission denied patterns', async () => {
      const permissionResult: BrainResponse = {
        ...mockBrainResult,
        output: 'permission denied: cannot access file',
      };

      const result = await service.validateResult({
        task: mockTask as Task,
        brainResult: permissionResult,
        organizationId: 'org-1',
      });

      expect(result.passed).toBe(false);
      expect(result.shouldRetry).toBe(true);
    });

    it('should warn but pass for implementation tasks without code indicators', async () => {
      const textResult: BrainResponse = {
        ...mockBrainResult,
        output:
          'This is a long text output that does not contain any code. '.repeat(
            10,
          ),
      };

      const result = await service.validateResult({
        task: {
          ...mockTask,
          type: TaskType.IMPLEMENTATION,
        } as Task,
        brainResult: textResult,
        organizationId: 'org-1',
      });

      // Should still pass but log warning
      expect(result.passed).toBe(true);
    });

    it('should pass for review tasks without code', async () => {
      const reviewResult: BrainResponse = {
        ...mockBrainResult,
        output: 'Review complete: All checks passed. Code looks good.',
      };

      const result = await service.validateResult({
        task: {
          ...mockTask,
          type: TaskType.REVIEW,
        } as Task,
        brainResult: reviewResult,
        organizationId: 'org-1',
      });

      expect(result.passed).toBe(true);
    });

    it('should include validation details in result', async () => {
      const result = await service.validateResult({
        task: mockTask as Task,
        brainResult: mockBrainResult,
        organizationId: 'org-1',
        costLimitDailyCents: 100,
      });

      expect(result).toHaveProperty('passed');
      expect(result).toHaveProperty('shouldRetry');
    });

    it('should handle edge case: exactly 10 characters', async () => {
      const edgeResult: BrainResponse = {
        ...mockBrainResult,
        output: 'exactlyten',
      };

      const result = await service.validateResult({
        task: mockTask as Task,
        brainResult: edgeResult,
        organizationId: 'org-1',
      });

      // 10 characters should pass the minimum length check
      expect(result.passed).toBe(true);
    });

    it('should handle edge case: exactly at cost threshold', async () => {
      const thresholdResult: BrainResponse = {
        ...mockBrainResult,
        cost: {
          inputTokens: 1000,
          outputTokens: 500,
          totalCostCents: 10, // Exactly 10% of daily limit
        },
      };

      const result = await service.validateResult({
        task: mockTask as Task,
        brainResult: thresholdResult,
        organizationId: 'org-1',
        costLimitDailyCents: 100,
      });

      expect(result.passed).toBe(true);
    });

    it('should handle code with semicolons and braces', async () => {
      const codeResult: BrainResponse = {
        ...mockBrainResult,
        output: `
          function test() {
            const x = 1;
            const y = 2;
            return x + y;
          }
        `,
      };

      const result = await service.validateResult({
        task: {
          ...mockTask,
          type: TaskType.IMPLEMENTATION,
        } as Task,
        brainResult: codeResult,
        organizationId: 'org-1',
      });

      expect(result.passed).toBe(true);
    });

    it('should handle code with import/export statements', async () => {
      const moduleResult: BrainResponse = {
        ...mockBrainResult,
        output: `
          import { Injectable } from '@nestjs/common';
          
          export class MyService {
            constructor() {}
          }
        `,
      };

      const result = await service.validateResult({
        task: {
          ...mockTask,
          type: TaskType.IMPLEMENTATION,
        } as Task,
        brainResult: moduleResult,
        organizationId: 'org-1',
      });

      expect(result.passed).toBe(true);
    });
  });
});
