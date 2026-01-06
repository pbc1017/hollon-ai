import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RetrospectiveService } from './retrospective.service';
import { MeetingRecord, MeetingType } from '../entities/meeting-record.entity';
import { Cycle, CycleStatus } from '../../project/entities/cycle.entity';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { Repository } from 'typeorm';

describe('RetrospectiveService', () => {
  let service: RetrospectiveService;
  let meetingRepo: jest.Mocked<Repository<MeetingRecord>>;
  let taskRepo: jest.Mocked<Repository<Task>>;
  let hollonRepo: jest.Mocked<Repository<Hollon>>;

  const mockMeetingRepository = {
    save: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockCycleRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockTaskRepository = {
    find: jest.fn(),
  };

  const mockHollonRepository = {
    findOne: jest.fn(),
  };

  const mockCycle: Partial<Cycle> = {
    id: 'cycle-123',
    name: 'Sprint 1',
    number: 1,
    status: CycleStatus.COMPLETED,
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-14'),
    completedAt: new Date('2024-01-14'),
    project: {
      id: 'project-123',
      organizationId: 'org-123',
    } as any,
  };

  const mockTask: Partial<Task> = {
    id: 'task-123',
    title: 'Test Task',
    status: TaskStatus.COMPLETED,
    cycleId: 'cycle-123',
    assignedHollonId: 'hollon-123',
    storyPoints: 3,
    startedAt: new Date('2024-01-01T09:00:00'),
    completedAt: new Date('2024-01-02T15:00:00'),
  };

  const mockHollon: Partial<Hollon> = {
    id: 'hollon-123',
    name: 'Alpha',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetrospectiveService,
        {
          provide: getRepositoryToken(MeetingRecord),
          useValue: mockMeetingRepository,
        },
        {
          provide: getRepositoryToken(Cycle),
          useValue: mockCycleRepository,
        },
        {
          provide: getRepositoryToken(Task),
          useValue: mockTaskRepository,
        },
        {
          provide: getRepositoryToken(Hollon),
          useValue: mockHollonRepository,
        },
      ],
    }).compile();

    service = module.get<RetrospectiveService>(RetrospectiveService);
    meetingRepo = module.get(getRepositoryToken(MeetingRecord));
    taskRepo = module.get(getRepositoryToken(Task));
    hollonRepo = module.get(getRepositoryToken(Hollon));

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runRetrospectiveForCycle', () => {
    it('should successfully run retrospective for a cycle', async () => {
      const tasks: Partial<Task>[] = [
        { ...mockTask, status: TaskStatus.COMPLETED, storyPoints: 3 },
        {
          ...mockTask,
          id: 'task-124',
          status: TaskStatus.IN_PROGRESS,
          storyPoints: 2,
        },
      ];

      taskRepo.find.mockResolvedValue(tasks as Task[]);
      hollonRepo.findOne.mockResolvedValue(mockHollon as Hollon);

      const savedMeeting: Partial<MeetingRecord> = {
        id: 'meeting-123',
        organizationId: 'org-123',
        meetingType: MeetingType.RETROSPECTIVE,
        title: 'Retrospective - Sprint 1 - 2024-01-14',
        completedAt: new Date(),
      };

      meetingRepo.save.mockResolvedValue(savedMeeting as MeetingRecord);

      const result = await service.runRetrospectiveForCycle(mockCycle as Cycle);

      expect(result).toBeDefined();
      expect(result?.id).toBe('meeting-123');
      expect(meetingRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          organizationId: 'org-123',
          meetingType: MeetingType.RETROSPECTIVE,
          teamId: null,
        }),
      );
    });

    it('should handle cycle without tasks', async () => {
      taskRepo.find.mockResolvedValue([]);
      meetingRepo.save.mockResolvedValue({
        id: 'meeting-124',
      } as MeetingRecord);

      const result = await service.runRetrospectiveForCycle(mockCycle as Cycle);

      expect(result).toBeDefined();
      expect(taskRepo.find).toHaveBeenCalledWith({
        where: { cycleId: 'cycle-123' },
      });
    });

    it('should throw error if retrospective fails', async () => {
      taskRepo.find.mockRejectedValue(new Error('Database error'));

      await expect(
        service.runRetrospectiveForCycle(mockCycle as Cycle),
      ).rejects.toThrow('Database error');
    });
  });

  describe('collectCycleMetrics', () => {
    it('should correctly calculate metrics with completed tasks', async () => {
      const tasks: Partial<Task>[] = [
        {
          ...mockTask,
          status: TaskStatus.COMPLETED,
          storyPoints: 5,
          startedAt: new Date('2024-01-01T09:00:00'),
          completedAt: new Date('2024-01-01T17:00:00'), // 8 hours
        },
        {
          ...mockTask,
          id: 'task-124',
          status: TaskStatus.COMPLETED,
          storyPoints: 3,
          startedAt: new Date('2024-01-02T09:00:00'),
          completedAt: new Date('2024-01-02T13:00:00'), // 4 hours
        },
        {
          ...mockTask,
          id: 'task-125',
          status: TaskStatus.IN_PROGRESS,
          storyPoints: 2,
        },
      ];

      taskRepo.find.mockResolvedValue(tasks as Task[]);

      const metrics = await service['collectCycleMetrics'](mockCycle as Cycle);

      expect(metrics.totalTasks).toBe(3);
      expect(metrics.completedTasks).toBe(2);
      expect(metrics.inProgressTasks).toBe(1);
      expect(metrics.blockedTasks).toBe(0);
      expect(metrics.completionRate).toBeCloseTo(0.667, 2);
      expect(metrics.totalStoryPoints).toBe(10);
      expect(metrics.completedStoryPoints).toBe(8);
      expect(metrics.avgLeadTime).toBeCloseTo(6, 0); // (8 + 4) / 2 = 6 hours
    });

    it('should handle tasks without story points', async () => {
      const tasks: Partial<Task>[] = [
        {
          ...mockTask,
          status: TaskStatus.COMPLETED,
          storyPoints: undefined,
        },
        {
          ...mockTask,
          id: 'task-124',
          status: TaskStatus.COMPLETED,
          storyPoints: 0,
        },
      ];

      taskRepo.find.mockResolvedValue(tasks as Task[]);

      const metrics = await service['collectCycleMetrics'](mockCycle as Cycle);

      expect(metrics.totalStoryPoints).toBe(0);
      expect(metrics.completedStoryPoints).toBe(0);
    });
  });

  describe('collectHollonFeedback', () => {
    it('should collect feedback from hollons', async () => {
      const tasks: Partial<Task>[] = [
        {
          ...mockTask,
          status: TaskStatus.COMPLETED,
          storyPoints: 5,
          assignedHollonId: 'hollon-123',
        },
        {
          ...mockTask,
          id: 'task-124',
          status: TaskStatus.BLOCKED,
          storyPoints: 3,
          assignedHollonId: 'hollon-123',
          blockedReason: 'Waiting for API access',
        },
      ];

      taskRepo.find.mockResolvedValue(tasks as Task[]);
      hollonRepo.findOne.mockResolvedValue(mockHollon as Hollon);

      const feedback = await service['collectHollonFeedback'](
        mockCycle as Cycle,
      );

      expect(feedback).toHaveLength(1);
      expect(feedback[0].hollonId).toBe('hollon-123');
      expect(feedback[0].hollonName).toBe('Alpha');
      expect(feedback[0].tasksCompleted).toBe(1);
      expect(feedback[0].storyPointsCompleted).toBe(5);
      expect(feedback[0].blockersFaced).toContain('Waiting for API access');
    });

    it('should handle tasks without assigned hollons', async () => {
      const tasks: Partial<Task>[] = [
        {
          ...mockTask,
          assignedHollonId: null,
        },
      ];

      taskRepo.find.mockResolvedValue(tasks as Task[]);

      const feedback = await service['collectHollonFeedback'](
        mockCycle as Cycle,
      );

      expect(feedback).toHaveLength(0);
    });
  });

  describe('analyzeImprovements', () => {
    it('should identify low completion rate issue', async () => {
      const metrics = {
        cycleId: 'cycle-123',
        cycleName: 'Sprint 1',
        totalTasks: 10,
        completedTasks: 5,
        inProgressTasks: 3,
        blockedTasks: 2,
        completionRate: 0.5,
        avgLeadTime: 24,
        totalStoryPoints: 20,
        completedStoryPoints: 10,
      };

      const improvements = await service['analyzeImprovements'](metrics, []);

      expect(improvements.length).toBeGreaterThan(0);
      expect(
        improvements.some((i) => i.description.includes('Completion rate')),
      ).toBe(true);
      expect(improvements.some((i) => i.description.includes('blocked'))).toBe(
        true,
      );
    });

    it('should identify high lead time issue', async () => {
      const metrics = {
        cycleId: 'cycle-123',
        cycleName: 'Sprint 1',
        totalTasks: 5,
        completedTasks: 5,
        inProgressTasks: 0,
        blockedTasks: 0,
        completionRate: 1.0,
        avgLeadTime: 72, // > 48 hours
        totalStoryPoints: 20,
        completedStoryPoints: 20,
      };

      const improvements = await service['analyzeImprovements'](metrics, []);

      expect(
        improvements.some((i) => i.description.includes('lead time')),
      ).toBe(true);
    });

    it('should return positive note when no issues found', async () => {
      const metrics = {
        cycleId: 'cycle-123',
        cycleName: 'Sprint 1',
        totalTasks: 10,
        completedTasks: 9,
        inProgressTasks: 1,
        blockedTasks: 0,
        completionRate: 0.9,
        avgLeadTime: 24,
        totalStoryPoints: 20,
        completedStoryPoints: 18,
      };

      const improvements = await service['analyzeImprovements'](metrics, []);

      expect(
        improvements.some((i) => i.description.includes('Great work')),
      ).toBe(true);
    });
  });

  describe('formatRetrospectiveDocument', () => {
    it('should format document correctly', () => {
      const metrics = {
        cycleId: 'cycle-123',
        cycleName: 'Sprint 1',
        totalTasks: 10,
        completedTasks: 8,
        inProgressTasks: 1,
        blockedTasks: 1,
        completionRate: 0.8,
        avgLeadTime: 24.5,
        totalStoryPoints: 20,
        completedStoryPoints: 16,
      };

      const feedback = [
        {
          hollonId: 'hollon-123',
          hollonName: 'Alpha',
          tasksCompleted: 5,
          storyPointsCompleted: 10,
          blockersFaced: ['API access'],
          suggestions: [],
        },
      ];

      const improvements = [
        {
          category: 'process' as const,
          description: 'Test improvement',
          priority: 'high' as const,
        },
      ];

      const doc = service['formatRetrospectiveDocument'](
        mockCycle as Cycle,
        metrics,
        feedback,
        improvements,
      );

      expect(doc).toContain('# Retrospective - Sprint 1');
      expect(doc).toContain('Total Tasks: 10');
      expect(doc).toContain('Completed: 8');
      expect(doc).toContain('Completion Rate: 80.0%');
      expect(doc).toContain('Alpha');
      expect(doc).toContain('Tasks Completed: 5');
      expect(doc).toContain('Test improvement');
    });

    it('should handle empty feedback and improvements', () => {
      const metrics = {
        cycleId: 'cycle-123',
        cycleName: 'Sprint 1',
        totalTasks: 5,
        completedTasks: 5,
        inProgressTasks: 0,
        blockedTasks: 0,
        completionRate: 1.0,
        avgLeadTime: 12,
        totalStoryPoints: 10,
        completedStoryPoints: 10,
      };

      const doc = service['formatRetrospectiveDocument'](
        mockCycle as Cycle,
        metrics,
        [],
        [],
      );

      expect(doc).toContain('No hollon feedback available');
      expect(doc).toContain('No improvements identified');
    });
  });
});
