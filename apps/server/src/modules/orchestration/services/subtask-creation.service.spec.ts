import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  SubtaskCreationService,
  SubtaskDefinition,
} from './subtask-creation.service';
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
} from '../../task/entities/task.entity';

describe('SubtaskCreationService', () => {
  let service: SubtaskCreationService;
  let module: TestingModule;

  const mockTaskRepo = {
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        SubtaskCreationService,
        {
          provide: getRepositoryToken(Task),
          useValue: mockTaskRepo,
        },
      ],
    }).compile();

    service = module.get<SubtaskCreationService>(SubtaskCreationService);
  });

  afterEach(async () => {
    jest.clearAllMocks();
    if (module) {
      await module.close();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createSubtasks', () => {
    const mockParentTask: Partial<Task> = {
      id: 'parent-1',
      title: 'Parent Task',
      projectId: 'project-1',
      status: TaskStatus.IN_PROGRESS,
      subtasks: [],
    };

    const subtaskDefinitions: SubtaskDefinition[] = [
      {
        title: 'Subtask 1',
        description: 'First subtask',
        type: TaskType.IMPLEMENTATION,
        priority: TaskPriority.P2_HIGH,
      },
      {
        title: 'Subtask 2',
        description: 'Second subtask',
        type: TaskType.IMPLEMENTATION,
        priority: TaskPriority.P2_HIGH,
      },
    ];

    it('should create subtasks successfully', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce(mockParentTask); // Parent task lookup
      mockTaskRepo.findOne.mockResolvedValueOnce(mockParentTask); // Depth calculation
      mockTaskRepo.create.mockImplementation((task) => task); // Mock create to return the task object
      mockTaskRepo.save.mockImplementation((task) =>
        Promise.resolve({ ...task, id: `subtask-${Math.random()}` }),
      );
      mockTaskRepo.find.mockResolvedValue([]);
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.createSubtasks(
        'parent-1',
        subtaskDefinitions,
      );

      expect(result.success).toBe(true);
      expect(result.createdSubtasks).toHaveLength(2);
      expect(result.createdSubtasks[0].title).toBe('Subtask 1');
      expect(result.createdSubtasks[1].title).toBe('Subtask 2');
      expect(mockTaskRepo.save).toHaveBeenCalledTimes(2);
    });

    it('should fail if parent task not found', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);

      const result = await service.createSubtasks(
        'nonexistent',
        subtaskDefinitions,
      );

      expect(result.success).toBe(false);
      expect(result.createdSubtasks).toHaveLength(0);
      expect(result.errors).toContain('Parent task nonexistent not found');
    });

    it('should enforce max depth limit', async () => {
      // Create a task at depth 3 (max depth reached)
      const deepTask: Partial<Task> = {
        id: 'deep-task',
        parentTaskId: 'level-2',
        projectId: 'project-1',
        subtasks: [],
      };

      // Mock depth calculation to return 3
      mockTaskRepo.findOne
        .mockResolvedValueOnce(deepTask) // Initial parent lookup
        .mockResolvedValueOnce(deepTask) // Depth calc: deep-task
        .mockResolvedValueOnce({ id: 'level-2', parentTaskId: 'level-1' }) // Depth calc: level-2
        .mockResolvedValueOnce({ id: 'level-1', parentTaskId: 'root' }) // Depth calc: level-1
        .mockResolvedValueOnce({ id: 'root', parentTaskId: null }); // Depth calc: root

      const result = await service.createSubtasks(
        'deep-task',
        subtaskDefinitions,
      );

      expect(result.success).toBe(false);
      expect(result.createdSubtasks).toHaveLength(0);
      expect(result.errors?.[0]).toContain('Maximum subtask depth');
    });

    it('should enforce max subtask count limit', async () => {
      const taskWithManySubtasks: Partial<Task> = {
        id: 'parent-1',
        projectId: 'project-1',
        subtasks: new Array(10).fill({ id: 'existing' }) as Task[], // Already at max
      };

      mockTaskRepo.findOne.mockResolvedValue(taskWithManySubtasks);

      const result = await service.createSubtasks('parent-1', [
        subtaskDefinitions[0],
      ]);

      expect(result.success).toBe(false);
      expect(result.createdSubtasks).toHaveLength(0);
      expect(result.errors?.[0]).toContain('Maximum subtask count');
    });

    it('should allow creating subtasks up to the limit', async () => {
      const taskWith8Subtasks: Partial<Task> = {
        id: 'parent-1',
        projectId: 'project-1',
        subtasks: new Array(8).fill({ id: 'existing' }) as Task[],
      };

      mockTaskRepo.findOne.mockResolvedValueOnce(taskWith8Subtasks); // Parent lookup
      mockTaskRepo.findOne.mockResolvedValueOnce(taskWith8Subtasks); // Depth calc
      mockTaskRepo.create.mockImplementation((task) => task);
      mockTaskRepo.save.mockImplementation((task) =>
        Promise.resolve({ ...task, id: `subtask-${Math.random()}` }),
      );
      mockTaskRepo.find.mockResolvedValue([]);
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      // Try to add 2 more (should succeed, total = 10)
      const result = await service.createSubtasks(
        'parent-1',
        subtaskDefinitions,
      );

      expect(result.success).toBe(true);
      expect(result.createdSubtasks).toHaveLength(2);
    });

    it('should handle partial failures when creating subtasks', async () => {
      mockTaskRepo.findOne.mockResolvedValueOnce(mockParentTask); // Parent lookup
      mockTaskRepo.findOne.mockResolvedValueOnce(mockParentTask); // Depth calc
      mockTaskRepo.create.mockImplementation((task) => task);
      mockTaskRepo.save
        .mockResolvedValueOnce({ ...subtaskDefinitions[0], id: 'subtask-1' })
        .mockRejectedValueOnce(new Error('Database error'));
      mockTaskRepo.find.mockResolvedValue([]);
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.createSubtasks(
        'parent-1',
        subtaskDefinitions,
      );

      expect(result.success).toBe(false);
      expect(result.createdSubtasks).toHaveLength(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors?.[0]).toContain('Failed to create subtask');
    });

    it('should skip validation when options are disabled', async () => {
      const deepTask: Partial<Task> = {
        id: 'deep-task',
        projectId: 'project-1',
        subtasks: [],
      };

      mockTaskRepo.findOne.mockResolvedValue(deepTask);
      mockTaskRepo.create.mockImplementation((task) => task);
      mockTaskRepo.save.mockImplementation((task) =>
        Promise.resolve({ ...task, id: `subtask-${Math.random()}` }),
      );
      mockTaskRepo.find.mockResolvedValue([]);
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      const result = await service.createSubtasks(
        'deep-task',
        subtaskDefinitions,
        {
          validateDepth: false,
          validateCount: false,
        },
      );

      expect(result.success).toBe(true);
      expect(result.createdSubtasks).toHaveLength(2);
    });
  });

  describe('calculateTaskDepth', () => {
    it('should return 0 for root task', async () => {
      mockTaskRepo.findOne.mockResolvedValue({
        id: 'root',
        parentTaskId: null,
      });

      const depth = await service.calculateTaskDepth('root');
      expect(depth).toBe(0);
    });

    it('should return 1 for direct child', async () => {
      mockTaskRepo.findOne
        .mockResolvedValueOnce({ id: 'child', parentTaskId: 'root' })
        .mockResolvedValueOnce({ id: 'root', parentTaskId: null });

      const depth = await service.calculateTaskDepth('child');
      expect(depth).toBe(1);
    });

    it('should return 2 for grandchild', async () => {
      mockTaskRepo.findOne
        .mockResolvedValueOnce({ id: 'grandchild', parentTaskId: 'child' })
        .mockResolvedValueOnce({ id: 'child', parentTaskId: 'root' })
        .mockResolvedValueOnce({ id: 'root', parentTaskId: null });

      const depth = await service.calculateTaskDepth('grandchild');
      expect(depth).toBe(2);
    });

    it('should handle nonexistent task', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);

      const depth = await service.calculateTaskDepth('nonexistent');
      expect(depth).toBe(0);
    });
  });

  describe('updateParentTaskStatus', () => {
    it('should mark parent as COMPLETED when all subtasks completed', async () => {
      const parentWithCompletedSubtasks: Partial<Task> = {
        id: 'parent-1',
        status: TaskStatus.IN_PROGRESS,
        subtasks: [
          { id: 'sub-1', status: TaskStatus.COMPLETED } as Task,
          { id: 'sub-2', status: TaskStatus.COMPLETED } as Task,
        ],
      };

      mockTaskRepo.findOne.mockResolvedValue(parentWithCompletedSubtasks);
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      await service.updateParentTaskStatus('parent-1');

      expect(mockTaskRepo.update).toHaveBeenCalledWith('parent-1', {
        status: TaskStatus.COMPLETED,
      });
    });

    it('should mark parent as BLOCKED when any subtask failed', async () => {
      const parentWithFailedSubtask: Partial<Task> = {
        id: 'parent-1',
        status: TaskStatus.IN_PROGRESS,
        subtasks: [
          { id: 'sub-1', status: TaskStatus.COMPLETED } as Task,
          { id: 'sub-2', status: TaskStatus.FAILED } as Task,
        ],
      };

      mockTaskRepo.findOne.mockResolvedValue(parentWithFailedSubtask);
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      await service.updateParentTaskStatus('parent-1');

      expect(mockTaskRepo.update).toHaveBeenCalledWith('parent-1', {
        status: TaskStatus.BLOCKED,
      });
    });

    it('should mark parent as BLOCKED when any subtask blocked', async () => {
      const parentWithBlockedSubtask: Partial<Task> = {
        id: 'parent-1',
        status: TaskStatus.IN_PROGRESS,
        subtasks: [
          { id: 'sub-1', status: TaskStatus.COMPLETED } as Task,
          { id: 'sub-2', status: TaskStatus.BLOCKED } as Task,
        ],
      };

      mockTaskRepo.findOne.mockResolvedValue(parentWithBlockedSubtask);
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      await service.updateParentTaskStatus('parent-1');

      expect(mockTaskRepo.update).toHaveBeenCalledWith('parent-1', {
        status: TaskStatus.BLOCKED,
      });
    });

    it('should mark parent as IN_PROGRESS when any subtask in progress', async () => {
      const parentWithInProgressSubtask: Partial<Task> = {
        id: 'parent-1',
        status: TaskStatus.READY,
        subtasks: [
          { id: 'sub-1', status: TaskStatus.COMPLETED } as Task,
          { id: 'sub-2', status: TaskStatus.IN_PROGRESS } as Task,
        ],
      };

      mockTaskRepo.findOne.mockResolvedValue(parentWithInProgressSubtask);
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      await service.updateParentTaskStatus('parent-1');

      expect(mockTaskRepo.update).toHaveBeenCalledWith('parent-1', {
        status: TaskStatus.IN_PROGRESS,
      });
    });

    it('should not update if already in correct status', async () => {
      const parentAlreadyInProgress: Partial<Task> = {
        id: 'parent-1',
        status: TaskStatus.IN_PROGRESS,
        subtasks: [{ id: 'sub-1', status: TaskStatus.IN_PROGRESS } as Task],
      };

      mockTaskRepo.findOne.mockResolvedValue(parentAlreadyInProgress);

      await service.updateParentTaskStatus('parent-1');

      expect(mockTaskRepo.update).not.toHaveBeenCalled();
    });

    it('should handle parent without subtasks', async () => {
      mockTaskRepo.findOne.mockResolvedValue({
        id: 'parent-1',
        subtasks: [],
      });

      await service.updateParentTaskStatus('parent-1');

      expect(mockTaskRepo.update).not.toHaveBeenCalled();
    });
  });

  describe('validateSubtaskCount', () => {
    it('should validate count within limit', () => {
      expect(service.validateSubtaskCount(1)).toBe(true);
      expect(service.validateSubtaskCount(5)).toBe(true);
      expect(service.validateSubtaskCount(10)).toBe(true);
    });

    it('should reject count exceeding limit', () => {
      expect(service.validateSubtaskCount(11)).toBe(false);
      expect(service.validateSubtaskCount(100)).toBe(false);
    });

    it('should reject count of 0 or negative', () => {
      expect(service.validateSubtaskCount(0)).toBe(false);
      expect(service.validateSubtaskCount(-1)).toBe(false);
    });
  });

  describe('getSubtasks', () => {
    it('should return all direct subtasks', async () => {
      const subtasks = [
        { id: 'sub-1', parentTaskId: 'parent-1' },
        { id: 'sub-2', parentTaskId: 'parent-1' },
      ];

      mockTaskRepo.find.mockResolvedValue(subtasks);

      const result = await service.getSubtasks('parent-1');

      expect(result).toEqual(subtasks);
      expect(mockTaskRepo.find).toHaveBeenCalledWith({
        where: { parentTaskId: 'parent-1' },
        order: { createdAt: 'ASC' },
      });
    });
  });

  describe('getSubtaskTree', () => {
    it('should return all descendants', async () => {
      // Setup task tree:
      // parent
      //   ├─ child1
      //   │   └─ grandchild1
      //   └─ child2

      mockTaskRepo.find
        .mockResolvedValueOnce([
          { id: 'child1', parentTaskId: 'parent' } as Task,
          { id: 'child2', parentTaskId: 'parent' } as Task,
        ])
        .mockResolvedValueOnce([
          { id: 'grandchild1', parentTaskId: 'child1' } as Task,
        ])
        .mockResolvedValueOnce([]);

      const result = await service.getSubtaskTree('parent');

      expect(result).toHaveLength(3);
      expect(result.map((t) => t.id)).toEqual([
        'child1',
        'child2',
        'grandchild1',
      ]);
    });

    it('should handle task with no subtasks', async () => {
      mockTaskRepo.find.mockResolvedValue([]);

      const result = await service.getSubtaskTree('leaf-task');

      expect(result).toHaveLength(0);
    });
  });

  describe('canCreateMoreSubtasks', () => {
    it('should allow creation when within limits', async () => {
      mockTaskRepo.findOne
        .mockResolvedValueOnce({ id: 'task', parentTaskId: null })
        .mockResolvedValueOnce({ id: 'task', parentTaskId: null });
      mockTaskRepo.find.mockResolvedValue([
        { id: 'sub-1' } as Task,
        { id: 'sub-2' } as Task,
      ]);

      const result = await service.canCreateMoreSubtasks('task');

      expect(result.canCreate).toBe(true);
      expect(result.currentCount).toBe(2);
      expect(result.currentDepth).toBe(0);
    });

    it('should deny when at max depth', async () => {
      // Mock depth 3
      mockTaskRepo.findOne
        .mockResolvedValueOnce({ id: 'deep', parentTaskId: 'level2' })
        .mockResolvedValueOnce({ id: 'level2', parentTaskId: 'level1' })
        .mockResolvedValueOnce({ id: 'level1', parentTaskId: 'root' })
        .mockResolvedValueOnce({ id: 'root', parentTaskId: null });

      const result = await service.canCreateMoreSubtasks('deep');

      expect(result.canCreate).toBe(false);
      expect(result.reason).toContain('Maximum depth');
      expect(result.currentDepth).toBe(3);
    });

    it('should deny when at max count', async () => {
      mockTaskRepo.findOne
        .mockResolvedValueOnce({ id: 'task', parentTaskId: null })
        .mockResolvedValueOnce({ id: 'task', parentTaskId: null });
      mockTaskRepo.find.mockResolvedValue(new Array(10).fill({ id: 'sub' }));

      const result = await service.canCreateMoreSubtasks('task');

      expect(result.canCreate).toBe(false);
      expect(result.reason).toContain('Maximum subtask count');
      expect(result.currentCount).toBe(10);
    });
  });

  describe('getLimits', () => {
    it('should return configuration limits', () => {
      const limits = service.getLimits();

      expect(limits).toEqual({
        maxDepth: 3,
        maxSubtasksPerParent: 10,
      });
    });
  });
});
