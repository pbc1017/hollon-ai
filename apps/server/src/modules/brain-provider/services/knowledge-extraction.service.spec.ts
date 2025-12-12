import { Test, TestingModule } from '@nestjs/testing';
import {
  KnowledgeExtractionService,
  TaskCompletionData,
} from './knowledge-extraction.service';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
} from '../../task/entities/task.entity';

describe('KnowledgeExtractionService', () => {
  let service: KnowledgeExtractionService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [KnowledgeExtractionService],
    }).compile();

    service = module.get<KnowledgeExtractionService>(
      KnowledgeExtractionService,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extractKnowledge', () => {
    it('should extract knowledge with basic task data', () => {
      const task = createMockTask({
        title: 'Implement user authentication',
        description: 'Add JWT-based authentication',
        type: TaskType.IMPLEMENTATION,
        priority: TaskPriority.P2_HIGH,
      });

      const data: TaskCompletionData = { task };
      const result = service.extractKnowledge(data);

      expect(result.title).toContain('Implement user authentication');
      expect(result.content).toContain('Add JWT-based authentication');
      expect(result.tags).toContain('implementation');
      expect(result.tags).toContain('priority-p2');
      expect(result.metadata.taskId).toBe(task.id);
      expect(result.metadata.taskType).toBe(TaskType.IMPLEMENTATION);
      expect(result.createdAt).toBeInstanceOf(Date);
    });

    it('should extract knowledge with completion outcome', () => {
      const task = createMockTask({
        title: 'Fix login bug',
        type: TaskType.BUG_FIX,
      });

      const data: TaskCompletionData = {
        task,
        outcome: {
          output: 'Successfully fixed the login issue',
          pullRequestUrl: 'https://github.com/org/repo/pull/123',
          filesChanged: ['src/auth/login.ts', 'src/auth/login.spec.ts'],
          testsPassed: true,
        },
      };

      const result = service.extractKnowledge(data);

      expect(result.content).toContain('Successfully fixed the login issue');
      expect(result.content).toContain('https://github.com/org/repo/pull/123');
      expect(result.content).toContain('src/auth/login.ts');
      expect(result.tags).toContain('tests-passed');
      expect(result.metadata.pullRequestUrl).toBe(
        'https://github.com/org/repo/pull/123',
      );
      expect(result.metadata.testsPassed).toBe(true);
    });

    it('should extract skills from task and infer from files', () => {
      const task = createMockTask({
        title: 'Build React component',
        requiredSkills: ['react', 'frontend'],
      });

      const data: TaskCompletionData = {
        task,
        outcome: {
          filesChanged: [
            'src/components/Button.tsx',
            'src/components/Button.spec.ts',
            'src/styles/button.scss',
          ],
        },
      };

      const result = service.extractKnowledge(data);

      expect(result.skills).toContain('react');
      expect(result.skills).toContain('frontend');
      expect(result.skills).toContain('typescript');
      expect(result.tags).toContain('filetype-tsx');
      expect(result.tags).toContain('filetype-ts');
      expect(result.tags).toContain('filetype-scss');
    });

    it('should handle task with acceptance criteria', () => {
      const task = createMockTask({
        title: 'Add search feature',
        acceptanceCriteria:
          '- Search returns results in < 1s\n- Supports fuzzy matching',
      });

      const data: TaskCompletionData = { task };
      const result = service.extractKnowledge(data);

      expect(result.content).toContain('Acceptance Criteria');
      expect(result.content).toContain('Search returns results in < 1s');
      expect(result.content).toContain('Supports fuzzy matching');
    });

    it('should include review comments in content', () => {
      const task = createMockTask({ title: 'Code review task' });
      const data: TaskCompletionData = {
        task,
        outcome: {
          reviewComments: [
            'Consider adding error handling',
            'Great work on the tests',
          ],
        },
      };

      const result = service.extractKnowledge(data);

      expect(result.content).toContain('Review Comments');
      expect(result.content).toContain('Consider adding error handling');
      expect(result.content).toContain('Great work on the tests');
    });

    it('should handle task with custom tags', () => {
      const task = createMockTask({
        title: 'Database migration',
        tags: ['database', 'postgresql', 'migration'],
      });

      const data: TaskCompletionData = { task };
      const result = service.extractKnowledge(data);

      expect(result.tags).toContain('database');
      expect(result.tags).toContain('postgresql');
      expect(result.tags).toContain('migration');
    });

    it('should include complexity in metadata', () => {
      const task = createMockTask({
        title: 'Complex task',
        estimatedComplexity: 8,
      });

      const data: TaskCompletionData = { task };
      const result = service.extractKnowledge(data);

      expect(result.metadata.complexity).toBe(8);
    });

    it('should handle additional metadata fields', () => {
      const task = createMockTask({ title: 'Task with metadata' });
      const data: TaskCompletionData = {
        task,
        metadata: {
          customField: 'custom value',
          performanceMetrics: { duration: 120 },
        },
      };

      const result = service.extractKnowledge(data);

      expect(result.metadata.customField).toBe('custom value');
      expect(result.metadata.performanceMetrics).toEqual({ duration: 120 });
    });

    it('should handle test failure outcome', () => {
      const task = createMockTask({ title: 'Failed test task' });
      const data: TaskCompletionData = {
        task,
        outcome: {
          testsPassed: false,
        },
      };

      const result = service.extractKnowledge(data);

      expect(result.tags).toContain('tests-failed');
      expect(result.content).toContain('❌ Failed');
      expect(result.metadata.testsPassed).toBe(false);
    });

    it('should truncate long titles', () => {
      const longTitle = 'A'.repeat(150);
      const task = createMockTask({ title: longTitle });
      const data: TaskCompletionData = { task };

      const result = service.extractKnowledge(data);

      expect(result.title.length).toBeLessThanOrEqual(100);
      expect(result.title).toContain('...');
    });

    it('should include task type in title', () => {
      const task = createMockTask({
        title: 'Fix critical bug',
        type: TaskType.BUG_FIX,
      });

      const data: TaskCompletionData = { task };
      const result = service.extractKnowledge(data);

      expect(result.title).toContain('[bug_fix]');
      expect(result.title).toContain('Fix critical bug');
    });

    it('should handle additional outcome fields in metadata', () => {
      const task = createMockTask({ title: 'Task with custom outcome' });
      const data: TaskCompletionData = {
        task,
        outcome: {
          customMetric: 'value',
          performance: 95,
          output: 'Some output',
        },
      };

      const result = service.extractKnowledge(data);

      expect(result.metadata.customMetric).toBe('value');
      expect(result.metadata.performance).toBe(95);
    });
  });

  describe('extractBulkKnowledge', () => {
    it('should extract knowledge from multiple tasks', () => {
      const tasks = [
        createMockTask({ title: 'Task 1', type: TaskType.IMPLEMENTATION }),
        createMockTask({ title: 'Task 2', type: TaskType.BUG_FIX }),
        createMockTask({ title: 'Task 3', type: TaskType.ANALYSIS }),
      ];

      const dataList: TaskCompletionData[] = tasks.map((task) => ({ task }));
      const results = service.extractBulkKnowledge(dataList);

      expect(results).toHaveLength(3);
      expect(results[0].title).toContain('Task 1');
      expect(results[1].title).toContain('Task 2');
      expect(results[2].title).toContain('Task 3');
      expect(results[0].tags).toContain('implementation');
      expect(results[1].tags).toContain('bug_fix');
      expect(results[2].tags).toContain('analysis');
    });

    it('should handle empty array', () => {
      const results = service.extractBulkKnowledge([]);
      expect(results).toEqual([]);
    });
  });

  describe('canExtractKnowledge', () => {
    it('should return true for valid task with description', () => {
      const task = createMockTask({
        title: 'Valid task',
        description: 'Some description',
      });

      const result = service.canExtractKnowledge({ task });
      expect(result).toBe(true);
    });

    it('should return true for task with outcome', () => {
      const task = createMockTask({ title: 'Task with outcome' });
      const data: TaskCompletionData = {
        task,
        outcome: {
          output: 'Some output',
        },
      };

      const result = service.canExtractKnowledge(data);
      expect(result).toBe(true);
    });

    it('should return true for task with metadata', () => {
      const task = createMockTask({ title: 'Task with metadata' });
      const data: TaskCompletionData = {
        task,
        metadata: { key: 'value' },
      };

      const result = service.canExtractKnowledge(data);
      expect(result).toBe(true);
    });

    it('should return false for task without content', () => {
      const task = createMockTask({ title: 'Minimal task' });
      // No description, outcome, or metadata
      const result = service.canExtractKnowledge({ task });
      expect(result).toBe(false);
    });

    it('should return false for missing task', () => {
      const result = service.canExtractKnowledge({ task: null as any });
      expect(result).toBe(false);
    });

    it('should return false for task without title', () => {
      const task = createMockTask({ title: '' });
      task.title = ''; // Override
      const result = service.canExtractKnowledge({ task });
      expect(result).toBe(false);
    });
  });

  describe('file extension and skill inference', () => {
    it('should infer TypeScript skills from .ts files', () => {
      const task = createMockTask({ title: 'TS task' });
      const data: TaskCompletionData = {
        task,
        outcome: {
          filesChanged: ['src/service.ts'],
        },
      };

      const result = service.extractKnowledge(data);
      expect(result.skills).toContain('typescript');
      expect(result.skills).toContain('javascript');
    });

    it('should infer React skills from .tsx files', () => {
      const task = createMockTask({ title: 'React task' });
      const data: TaskCompletionData = {
        task,
        outcome: {
          filesChanged: ['src/Component.tsx'],
        },
      };

      const result = service.extractKnowledge(data);
      expect(result.skills).toContain('react');
      expect(result.skills).toContain('typescript');
    });

    it('should infer Python skills from .py files', () => {
      const task = createMockTask({ title: 'Python task' });
      const data: TaskCompletionData = {
        task,
        outcome: {
          filesChanged: ['main.py'],
        },
      };

      const result = service.extractKnowledge(data);
      expect(result.skills).toContain('python');
    });

    it('should infer DevOps skills from YAML files', () => {
      const task = createMockTask({ title: 'DevOps task' });
      const data: TaskCompletionData = {
        task,
        outcome: {
          filesChanged: ['.github/workflows/ci.yml'],
        },
      };

      const result = service.extractKnowledge(data);
      expect(result.skills).toContain('devops');
      expect(result.skills).toContain('configuration');
    });

    it('should infer SQL skills from .sql files', () => {
      const task = createMockTask({ title: 'SQL task' });
      const data: TaskCompletionData = {
        task,
        outcome: {
          filesChanged: ['migrations/001_create_users.sql'],
        },
      };

      const result = service.extractKnowledge(data);
      expect(result.skills).toContain('sql');
      expect(result.skills).toContain('database');
    });

    it('should handle files without extensions', () => {
      const task = createMockTask({ title: 'Task' });
      const data: TaskCompletionData = {
        task,
        outcome: {
          filesChanged: ['Dockerfile', 'README'],
        },
      };

      const result = service.extractKnowledge(data);
      // Should not crash, just won't infer skills from these
      expect(result).toBeDefined();
    });

    it('should deduplicate skills and tags', () => {
      const task = createMockTask({
        title: 'Task',
        requiredSkills: ['typescript', 'react'],
        tags: ['feature', 'frontend'],
      });

      const data: TaskCompletionData = {
        task,
        outcome: {
          filesChanged: [
            'src/Component1.tsx',
            'src/Component2.tsx',
            'src/utils.ts',
          ],
        },
      };

      const result = service.extractKnowledge(data);

      // Skills should be unique
      const uniqueSkills = [...new Set(result.skills)];
      expect(result.skills).toEqual(uniqueSkills);

      // Tags should be unique
      const uniqueTags = [...new Set(result.tags)];
      expect(result.tags).toEqual(uniqueTags);
    });
  });

  describe('edge cases', () => {
    it('should handle task with all optional fields empty', () => {
      const task = createMockTask({
        title: 'Minimal task',
        description: 'Minimal description',
      });

      const result = service.extractKnowledge({ task });

      expect(result.title).toBeTruthy();
      expect(result.content).toBeTruthy();
      expect(result.tags).toBeDefined();
      expect(result.skills).toBeDefined();
      expect(result.metadata).toBeDefined();
    });

    it('should handle outcome with only PR URL', () => {
      const task = createMockTask({ title: 'PR task' });
      const data: TaskCompletionData = {
        task,
        outcome: {
          pullRequestUrl: 'https://github.com/org/repo/pull/456',
        },
      };

      const result = service.extractKnowledge(data);

      expect(result.content).toContain('Pull Request');
      expect(result.content).toContain('https://github.com/org/repo/pull/456');
    });

    it('should handle empty arrays in task', () => {
      const task = createMockTask({
        title: 'Task',
        tags: [],
        requiredSkills: [],
      });

      const data: TaskCompletionData = {
        task,
        outcome: {
          filesChanged: [],
          reviewComments: [],
        },
      };

      const result = service.extractKnowledge(data);

      expect(result).toBeDefined();
      expect(result.tags.length).toBeGreaterThan(0); // At least status/priority tags
    });
  });
});

/**
 * Helper function to create a mock Task entity
 */
function createMockTask(overrides: Partial<Task> = {}): Task {
  const task = new Task();
  task.id = overrides.id || 'test-task-id';
  task.title = overrides.title || 'Test Task';
  task.description = overrides.description || null;
  task.type = overrides.type || TaskType.IMPLEMENTATION;
  task.status = overrides.status || TaskStatus.COMPLETED;
  task.priority = overrides.priority || TaskPriority.P3_MEDIUM;
  task.tags = overrides.tags || null;
  task.requiredSkills = overrides.requiredSkills || null;
  task.acceptanceCriteria = overrides.acceptanceCriteria || null;
  task.estimatedComplexity = overrides.estimatedComplexity || null;
  task.organizationId = overrides.organizationId || 'test-org-id';
  task.projectId = overrides.projectId || 'test-project-id';
  task.depth = overrides.depth || 0;

  return task;
}
