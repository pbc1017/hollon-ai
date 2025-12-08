import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TaskAnalyzerService } from './task-analyzer.service';
import {
  Task,
  TaskType,
  TaskStatus,
  TaskPriority,
} from '../../task/entities/task.entity';
import { BrainProviderService } from '../../brain-provider/brain-provider.service';

describe('TaskAnalyzerService', () => {
  let service: TaskAnalyzerService;
  let module: TestingModule;
  let taskRepo: jest.Mocked<Repository<Task>>;
  let brainProvider: jest.Mocked<BrainProviderService>;

  const mockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-1',
    title: 'Test Task',
    description: 'A test task description',
    type: TaskType.IMPLEMENTATION,
    status: TaskStatus.READY,
    priority: TaskPriority.P3_MEDIUM,
    projectId: 'project-1',
    cycleId: null,
    assignedHollonId: null,
    parentTaskId: null,
    creatorHollonId: null,
    depth: 0,
    affectedFiles: [],
    acceptanceCriteria: [],
    estimatedComplexity: null,
    tags: [],
    retryCount: 0,
    errorMessage: null,
    startedAt: null,
    completedAt: null,
    dueDate: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    project: undefined as any,
    cycle: undefined as any,
    assignedHollon: undefined as any,
    parentTask: undefined as any,
    subtasks: [],
    creatorHollon: undefined as any,
    dependencies: [],
    dependentTasks: [],
    ...overrides,
  });

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        TaskAnalyzerService,
        {
          provide: getRepositoryToken(Task),
          useValue: {
            findOne: jest.fn(),
          },
        },
        {
          provide: BrainProviderService,
          useValue: {
            executeWithTracking: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TaskAnalyzerService>(TaskAnalyzerService);
    taskRepo = module.get(getRepositoryToken(Task));
    brainProvider = module.get(BrainProviderService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (module) {
      await module.close();
    }
  });

  describe('analyzeComplexity', () => {
    it('should analyze simple task as low complexity', async () => {
      const task = mockTask({
        description: 'Simple task',
        acceptanceCriteria: ['Criterion 1'],
        affectedFiles: ['file1.ts'],
        type: TaskType.DOCUMENTATION,
      });

      taskRepo.findOne.mockResolvedValue(task);

      const result = await service.analyzeComplexity('task-1');

      expect(result.complexity).toBe('low');
      expect(result.recommendation).toBe('can_execute');
      expect(result.score).toBeLessThan(60);
    });

    it('should analyze moderately complex task', async () => {
      const task = mockTask({
        description:
          'A moderately complex task with some details and requirements that need to be addressed carefully. This involves multiple steps and considerations.',
        acceptanceCriteria: ['Criterion 1', 'Criterion 2', 'Criterion 3'],
        affectedFiles: ['file1.ts', 'file2.ts', 'file3.ts'],
        type: TaskType.IMPLEMENTATION,
      });

      taskRepo.findOne.mockResolvedValue(task);

      const result = await service.analyzeComplexity('task-1');

      expect(result.complexity).toBe('medium');
      // Score is close to threshold, can be either recommendation
      expect(['can_execute', 'should_split']).toContain(result.recommendation);
      expect(result.score).toBeGreaterThanOrEqual(40);
      expect(result.score).toBeLessThan(80);
    });

    it('should analyze highly complex task', async () => {
      const longDescription = 'A'.repeat(1500);
      const task = mockTask({
        description: longDescription,
        acceptanceCriteria: Array.from(
          { length: 12 },
          (_, i) => `Criterion ${i + 1}`,
        ),
        affectedFiles: Array.from({ length: 15 }, (_, i) => `file${i + 1}.ts`),
        type: TaskType.IMPLEMENTATION,
        subtasks: [mockTask({ id: 'subtask-1' })],
      });

      taskRepo.findOne.mockResolvedValue(task);

      const result = await service.analyzeComplexity('task-1');

      expect(result.complexity).toBe('very_high');
      expect(result.recommendation).toBe('must_split');
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.factors.hasSubtasks).toBe(true);
    });

    it('should handle task with no acceptance criteria', async () => {
      const task = mockTask({
        description: 'Task without criteria',
        acceptanceCriteria: [],
        affectedFiles: ['file1.ts'],
      });

      taskRepo.findOne.mockResolvedValue(task);

      const result = await service.analyzeComplexity('task-1');

      expect(result.factors.acceptanceCriteriaCount).toBe(0);
      expect(result.score).toBeGreaterThan(0); // Still gets points for unclear requirements
    });

    it('should handle task with no affected files', async () => {
      const task = mockTask({
        description: 'Task without files specified',
        acceptanceCriteria: ['Criterion 1'],
        affectedFiles: [],
      });

      taskRepo.findOne.mockResolvedValue(task);

      const result = await service.analyzeComplexity('task-1');

      expect(result.factors.affectedFilesCount).toBe(0);
      expect(result.score).toBeGreaterThan(0); // Gets points for unknown scope
    });

    it('should throw error if task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await expect(service.analyzeComplexity('nonexistent')).rejects.toThrow(
        'Task nonexistent not found',
      );
    });

    it('should enhance analysis with AI when requested', async () => {
      const task = mockTask({
        description: 'Medium complexity task',
        acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
        affectedFiles: ['file1.ts', 'file2.ts'],
      });

      taskRepo.findOne.mockResolvedValue(task);

      brainProvider.executeWithTracking.mockResolvedValue({
        success: true,
        output: JSON.stringify({
          adjustedScore: 70,
          recommendation: 'should_split',
          reasoning: 'AI detected hidden complexity in requirements',
          estimatedLinesOfCode: 250,
        }),
        cost: {
          inputTokens: 100,
          outputTokens: 50,
          totalCostCents: 0.15,
        },
        duration: 1200,
      });

      const result = await service.analyzeComplexity('task-1', {
        useAI: true,
        organizationId: 'org-1',
        hollonId: 'hollon-1',
      });

      expect(brainProvider.executeWithTracking).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.stringContaining('Analyze the complexity'),
        }),
        {
          organizationId: 'org-1',
          hollonId: 'hollon-1',
          taskId: 'task-1',
        },
      );

      expect(result.factors.estimatedLinesOfCode).toBe(250);
      expect(result.reasoning).toContain('AI-enhanced');
    });

    it('should fallback to heuristics if AI fails', async () => {
      const task = mockTask({
        description: 'Task description',
        acceptanceCriteria: ['Criterion 1'],
      });

      taskRepo.findOne.mockResolvedValue(task);
      brainProvider.executeWithTracking.mockRejectedValue(
        new Error('AI service unavailable'),
      );

      const result = await service.analyzeComplexity('task-1', {
        useAI: true,
        organizationId: 'org-1',
      });

      // Should still return a result using heuristics
      expect(result).toBeDefined();
      expect(result.complexity).toBeDefined();
      expect(result.recommendation).toBeDefined();
    });

    it('should consider task type in complexity calculation', async () => {
      const implementationTask = mockTask({
        description: 'Same description',
        acceptanceCriteria: ['Criterion 1'],
        affectedFiles: ['file1.ts'],
        type: TaskType.IMPLEMENTATION,
      });

      const documentationTask = mockTask({
        id: 'task-2',
        description: 'Same description',
        acceptanceCriteria: ['Criterion 1'],
        affectedFiles: ['file1.ts'],
        type: TaskType.DOCUMENTATION,
      });

      taskRepo.findOne.mockResolvedValueOnce(implementationTask);
      const implResult = await service.analyzeComplexity('task-1');

      taskRepo.findOne.mockResolvedValueOnce(documentationTask);
      const docResult = await service.analyzeComplexity('task-2');

      // Implementation should score higher than documentation
      expect(implResult.score).toBeGreaterThan(docResult.score);
    });
  });

  describe('suggestSubtasks', () => {
    it('should generate basic subtasks from acceptance criteria', async () => {
      const task = mockTask({
        title: 'Implement Feature X',
        description: 'Build feature X with multiple components',
        acceptanceCriteria: [
          'Component A works',
          'Component B works',
          'Integration test passes',
        ],
        type: TaskType.IMPLEMENTATION,
      });

      taskRepo.findOne.mockResolvedValue(task);

      const result = await service.suggestSubtasks('task-1');

      expect(result.subtaskDefinitions).toHaveLength(3);
      expect(result.strategy).toBe('sequential');
      expect(result.usedAI).toBe(false);
      expect(result.reasoning).toContain('acceptance criteria');

      result.subtaskDefinitions.forEach((subtask, index) => {
        expect(subtask.title).toContain('Part');
        expect(subtask.acceptanceCriteria).toHaveLength(1);
        expect(subtask.acceptanceCriteria![0]).toBe(
          task.acceptanceCriteria![index],
        );
      });
    });

    it('should split by file directories when many files', async () => {
      const task = mockTask({
        title: 'Refactor Modules',
        description: 'Refactor multiple modules',
        affectedFiles: [
          'src/module-a/file1.ts',
          'src/module-a/file2.ts',
          'src/module-b/file3.ts',
          'src/module-b/file4.ts',
          'src/module-c/file5.ts',
        ],
      });

      taskRepo.findOne.mockResolvedValue(task);

      const result = await service.suggestSubtasks('task-1');

      expect(result.strategy).toBe('parallel');
      expect(result.usedAI).toBe(false);
      expect(result.reasoning).toContain('file directories');
      expect(result.subtaskDefinitions.length).toBeGreaterThan(1);

      result.subtaskDefinitions.forEach((subtask) => {
        expect(subtask.affectedFiles).toBeDefined();
        expect(subtask.affectedFiles!.length).toBeGreaterThan(0);
      });
    });

    it('should use generic 3-phase split as fallback', async () => {
      const task = mockTask({
        title: 'Complex Task',
        description: 'A complex task without clear splitting criteria',
        acceptanceCriteria: ['Get it done'], // Single vague criterion
        affectedFiles: ['file1.ts'], // Few files
      });

      taskRepo.findOne.mockResolvedValue(task);

      const result = await service.suggestSubtasks('task-1');

      expect(result.subtaskDefinitions).toHaveLength(3);
      expect(result.strategy).toBe('sequential');
      expect(result.reasoning).toContain('3-phase');

      const titles = result.subtaskDefinitions.map((st) => st.title);
      expect(
        titles.some((t) => t.includes('Setup') || t.includes('Research')),
      ).toBe(true);
      expect(titles.some((t) => t.includes('Implementation'))).toBe(true);
      expect(
        titles.some(
          (t) => t.includes('Testing') || t.includes('Documentation'),
        ),
      ).toBe(true);
    });

    it('should generate AI-powered subtask suggestions', async () => {
      const task = mockTask({
        title: 'Build Authentication System',
        description: 'Implement complete authentication with JWT',
        acceptanceCriteria: ['Secure', 'Scalable', 'Well-tested'],
      });

      taskRepo.findOne.mockResolvedValue(task);

      brainProvider.executeWithTracking.mockResolvedValue({
        success: true,
        output: JSON.stringify({
          subtasks: [
            {
              title: 'Setup JWT infrastructure',
              description: 'Configure JWT library and keys',
              type: 'implementation',
              acceptanceCriteria: ['JWT library installed', 'Keys generated'],
              affectedFiles: ['src/auth/jwt.ts'],
              priority: 'P2',
            },
            {
              title: 'Implement authentication endpoints',
              description: 'Create login/logout/refresh endpoints',
              type: 'implementation',
              acceptanceCriteria: [
                'Login works',
                'Logout works',
                'Refresh works',
              ],
              affectedFiles: [
                'src/auth/auth.controller.ts',
                'src/auth/auth.service.ts',
              ],
              priority: 'P1',
            },
          ],
          strategy: 'sequential',
          reasoning:
            'JWT setup must happen before endpoints can be implemented',
        }),
        cost: { inputTokens: 200, outputTokens: 100, totalCostCents: 0.3 },
        duration: 1500,
      });

      const result = await service.suggestSubtasks('task-1', {
        useAI: true,
        organizationId: 'org-1',
        hollonId: 'hollon-1',
      });

      expect(result.usedAI).toBe(true);
      expect(result.subtaskDefinitions).toHaveLength(2);
      expect(result.strategy).toBe('sequential');
      expect(result.subtaskDefinitions[0].title).toBe(
        'Setup JWT infrastructure',
      );

      expect(brainProvider.executeWithTracking).toHaveBeenCalled();
    });

    it('should fallback to basic splitting if AI fails', async () => {
      const task = mockTask({
        title: 'Task Title',
        description: 'Task description',
        acceptanceCriteria: ['Criterion 1', 'Criterion 2'],
      });

      taskRepo.findOne.mockResolvedValue(task);
      brainProvider.executeWithTracking.mockRejectedValue(
        new Error('AI failed'),
      );

      const result = await service.suggestSubtasks('task-1', {
        useAI: true,
        organizationId: 'org-1',
      });

      // Should fallback to rule-based splitting
      expect(result.usedAI).toBe(false);
      expect(result.subtaskDefinitions.length).toBeGreaterThan(0);
    });

    it('should throw error if task not found', async () => {
      taskRepo.findOne.mockResolvedValue(null);

      await expect(service.suggestSubtasks('nonexistent')).rejects.toThrow(
        'Task nonexistent not found',
      );
    });
  });

  describe('shouldAnalyzeBeforeExecution', () => {
    it('should return true for long description', () => {
      const task = mockTask({
        description: 'A'.repeat(600),
        acceptanceCriteria: ['Simple criterion'],
      });

      expect(service.shouldAnalyzeBeforeExecution(task)).toBe(true);
    });

    it('should return true for many acceptance criteria', () => {
      const task = mockTask({
        description: 'Short description',
        acceptanceCriteria: Array.from(
          { length: 8 },
          (_, i) => `Criterion ${i + 1}`,
        ),
      });

      expect(service.shouldAnalyzeBeforeExecution(task)).toBe(true);
    });

    it('should return true for many affected files', () => {
      const task = mockTask({
        description: 'Short description',
        acceptanceCriteria: ['Criterion 1'],
        affectedFiles: Array.from({ length: 10 }, (_, i) => `file${i + 1}.ts`),
      });

      expect(service.shouldAnalyzeBeforeExecution(task)).toBe(true);
    });

    it('should return true if task has subtasks', () => {
      const task = mockTask({
        description: 'Short description',
        acceptanceCriteria: ['Criterion 1'],
        subtasks: [mockTask({ id: 'subtask-1' })],
      });

      expect(service.shouldAnalyzeBeforeExecution(task)).toBe(true);
    });

    it('should return false for simple task', () => {
      const task = mockTask({
        description: 'Short and simple description',
        acceptanceCriteria: ['One criterion'],
        affectedFiles: ['file1.ts'],
        subtasks: [],
      });

      expect(service.shouldAnalyzeBeforeExecution(task)).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('should handle task with extremely long description', async () => {
      const task = mockTask({
        description: 'A'.repeat(5000),
        acceptanceCriteria: Array.from(
          { length: 15 },
          (_, i) => `Criterion ${i + 1}`,
        ),
        affectedFiles: Array.from({ length: 15 }, (_, i) => `file${i + 1}.ts`),
        type: TaskType.IMPLEMENTATION,
      });

      taskRepo.findOne.mockResolvedValue(task);

      const result = await service.analyzeComplexity('task-1');

      expect(result).toBeDefined();
      expect(result.complexity).toBe('very_high');
    });

    it('should handle task with many files in same directory', async () => {
      const task = mockTask({
        title: 'Refactor Module',
        description: 'Refactor all files in module',
        affectedFiles: Array.from(
          { length: 20 },
          (_, i) => `src/module/file${i + 1}.ts`,
        ),
      });

      taskRepo.findOne.mockResolvedValue(task);

      const result = await service.suggestSubtasks('task-1');

      expect(result.subtaskDefinitions.length).toBeGreaterThan(0);
    });

    it('should handle malformed AI response gracefully', async () => {
      const task = mockTask({
        description: 'Task description',
      });

      taskRepo.findOne.mockResolvedValue(task);

      brainProvider.executeWithTracking.mockResolvedValue({
        success: true,
        output: 'invalid json',
        cost: { inputTokens: 10, outputTokens: 10, totalCostCents: 0.01 },
        duration: 100,
      });

      const result = await service.analyzeComplexity('task-1', {
        useAI: true,
        organizationId: 'org-1',
      });

      // Should fallback to heuristics
      expect(result).toBeDefined();
      expect(result.complexity).toBeDefined();
    });
  });
});
