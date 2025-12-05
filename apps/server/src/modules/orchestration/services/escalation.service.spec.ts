import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  EscalationService,
  EscalationLevel,
  EscalationRequest,
} from './escalation.service';
import {
  Task,
  TaskStatus,
  TaskPriority,
} from '../../task/entities/task.entity';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';

describe('EscalationService', () => {
  let service: EscalationService;

  const mockTaskRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    find: jest.fn(),
  };

  const mockHollonRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EscalationService,
        {
          provide: getRepositoryToken(Task),
          useValue: mockTaskRepo,
        },
        {
          provide: getRepositoryToken(Hollon),
          useValue: mockHollonRepo,
        },
      ],
    }).compile();

    service = module.get<EscalationService>(EscalationService);

    // Clear history before each test
    service.clearHistory();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('Level 1: Self Resolve', () => {
    it('should retry task when below retry limit', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-1',
        retryCount: 1,
        status: TaskStatus.FAILED,
      };

      mockTaskRepo.findOne.mockResolvedValue(mockTask);
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      const request: EscalationRequest = {
        taskId: 'task-1',
        hollonId: 'hollon-1',
        reason: 'Execution failed',
        level: EscalationLevel.SELF_RESOLVE,
      };

      const result = await service.escalate(request);

      expect(result.success).toBe(true);
      expect(result.action).toBe('task_retry_scheduled');
      expect(mockTaskRepo.update).toHaveBeenCalledWith('task-1', {
        retryCount: 2,
        status: TaskStatus.READY,
        errorMessage: 'Execution failed',
      });
    });

    it('should escalate to level 2 when max retries exceeded', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-1',
        retryCount: 3, // MAX_RETRIES = 3
        status: TaskStatus.FAILED,
      };

      mockTaskRepo.findOne.mockResolvedValue(mockTask);

      const request: EscalationRequest = {
        taskId: 'task-1',
        hollonId: 'hollon-1',
        reason: 'Execution failed repeatedly',
        level: EscalationLevel.SELF_RESOLVE,
      };

      const result = await service.escalate(request);

      expect(result.success).toBe(false);
      expect(result.action).toBe('max_retries_exceeded');
      expect(result.nextLevel).toBe(EscalationLevel.TEAM_COLLABORATION);
      expect(mockTaskRepo.update).not.toHaveBeenCalled();
    });

    it('should handle task not found', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);

      const request: EscalationRequest = {
        taskId: 'nonexistent',
        hollonId: 'hollon-1',
        reason: 'Test',
        level: EscalationLevel.SELF_RESOLVE,
      };

      const result = await service.escalate(request);

      expect(result.success).toBe(false);
      expect(result.action).toBe('task_not_found');
    });
  });

  describe('Level 2: Team Collaboration', () => {
    it('should reassign task to team when members available', async () => {
      const mockHollon: Partial<Hollon> = {
        id: 'hollon-1',
        name: 'Alpha',
        teamId: 'team-1',
        team: { id: 'team-1', name: 'Dev Team' } as any,
      };

      const mockTeamHollons: Partial<Hollon>[] = [
        { id: 'hollon-1', status: HollonStatus.WORKING },
        { id: 'hollon-2', status: HollonStatus.IDLE },
        { id: 'hollon-3', status: HollonStatus.IDLE },
      ];

      mockHollonRepo.findOne.mockResolvedValue(mockHollon);
      mockHollonRepo.find.mockResolvedValue(mockTeamHollons);
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      const request: EscalationRequest = {
        taskId: 'task-1',
        hollonId: 'hollon-1',
        reason: 'Need team help',
        level: EscalationLevel.TEAM_COLLABORATION,
      };

      const result = await service.escalate(request);

      expect(result.success).toBe(true);
      expect(result.action).toBe('task_reassigned_to_team');
      expect(result.message).toContain('2 team member');
      expect(mockTaskRepo.update).toHaveBeenCalledWith('task-1', {
        assignedHollonId: null,
        status: TaskStatus.READY,
        errorMessage: expect.stringContaining('Reassigned from Alpha'),
      });
    });

    it('should escalate to level 3 when no team members available', async () => {
      const mockHollon: Partial<Hollon> = {
        id: 'hollon-1',
        teamId: 'team-1',
        team: { id: 'team-1', name: 'Dev Team' } as any,
      };

      const mockTeamHollons: Partial<Hollon>[] = [
        { id: 'hollon-1', status: HollonStatus.WORKING },
      ];

      mockHollonRepo.findOne.mockResolvedValue(mockHollon);
      mockHollonRepo.find.mockResolvedValue(mockTeamHollons);

      const request: EscalationRequest = {
        taskId: 'task-1',
        hollonId: 'hollon-1',
        reason: 'Need help',
        level: EscalationLevel.TEAM_COLLABORATION,
      };

      const result = await service.escalate(request);

      expect(result.success).toBe(false);
      expect(result.action).toBe('no_available_team_members');
      expect(result.nextLevel).toBe(EscalationLevel.TEAM_LEADER);
    });

    it('should escalate to level 3 when hollon has no team', async () => {
      const mockHollon: Partial<Hollon> = {
        id: 'hollon-1',
        teamId: null,
        team: undefined,
      };

      mockHollonRepo.findOne.mockResolvedValue(mockHollon);

      const request: EscalationRequest = {
        taskId: 'task-1',
        hollonId: 'hollon-1',
        reason: 'Need help',
        level: EscalationLevel.TEAM_COLLABORATION,
      };

      const result = await service.escalate(request);

      expect(result.success).toBe(false);
      expect(result.action).toBe('no_team');
      expect(result.nextLevel).toBe(EscalationLevel.TEAM_LEADER);
    });
  });

  describe('Level 3: Team Leader Decision', () => {
    it('should mark task for team leader review', async () => {
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      const request: EscalationRequest = {
        taskId: 'task-1',
        hollonId: 'hollon-1',
        reason: 'Requires leadership decision',
        level: EscalationLevel.TEAM_LEADER,
      };

      const result = await service.escalate(request);

      expect(result.success).toBe(true);
      expect(result.action).toBe('escalated_to_team_leader');
      expect(mockTaskRepo.update).toHaveBeenCalledWith('task-1', {
        status: TaskStatus.IN_REVIEW,
        errorMessage: expect.stringContaining('Escalated to team leader'),
      });
    });
  });

  describe('Level 4: Organization Level', () => {
    it('should escalate to organization level', async () => {
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      const request: EscalationRequest = {
        taskId: 'task-1',
        hollonId: 'hollon-1',
        reason: 'Organization-wide issue',
        level: EscalationLevel.ORGANIZATION,
      };

      const result = await service.escalate(request);

      expect(result.success).toBe(true);
      expect(result.action).toBe('escalated_to_organization');
      expect(mockTaskRepo.update).toHaveBeenCalledWith('task-1', {
        status: TaskStatus.BLOCKED,
        errorMessage: expect.stringContaining('Organization escalation'),
      });
    });
  });

  describe('Level 5: Human Intervention', () => {
    it('should mark task for human intervention', async () => {
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      const request: EscalationRequest = {
        taskId: 'task-1',
        hollonId: 'hollon-1',
        reason: 'Critical security issue',
        level: EscalationLevel.HUMAN_INTERVENTION,
      };

      const result = await service.escalate(request);

      expect(result.success).toBe(true);
      expect(result.action).toBe('human_approval_required');
      expect(mockTaskRepo.update).toHaveBeenCalledWith('task-1', {
        status: TaskStatus.BLOCKED,
        errorMessage: expect.stringContaining('Human intervention required'),
      });
    });
  });

  describe('Escalation History', () => {
    it('should record escalation history', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-1',
        retryCount: 0,
        status: TaskStatus.FAILED,
      };

      mockTaskRepo.findOne.mockResolvedValue(mockTask);
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      const request: EscalationRequest = {
        taskId: 'task-1',
        hollonId: 'hollon-1',
        reason: 'First failure',
        level: EscalationLevel.SELF_RESOLVE,
      };

      await service.escalate(request);

      const history = service.getEscalationHistory('task-1');
      expect(history).toHaveLength(1);
      expect(history[0]).toMatchObject({
        taskId: 'task-1',
        hollonId: 'hollon-1',
        level: EscalationLevel.SELF_RESOLVE,
        reason: 'First failure',
      });
    });

    it('should maintain multiple escalation records', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-1',
        retryCount: 0,
        status: TaskStatus.FAILED,
      };

      mockTaskRepo.findOne.mockResolvedValue(mockTask);
      mockTaskRepo.update.mockResolvedValue({ affected: 1 });

      // First escalation
      await service.escalate({
        taskId: 'task-1',
        hollonId: 'hollon-1',
        reason: 'First failure',
        level: EscalationLevel.SELF_RESOLVE,
      });

      // Second escalation
      await service.escalate({
        taskId: 'task-1',
        hollonId: 'hollon-1',
        reason: 'Second failure',
        level: EscalationLevel.SELF_RESOLVE,
      });

      const history = service.getEscalationHistory('task-1');
      expect(history).toHaveLength(2);
    });
  });

  describe('Determine Escalation Level', () => {
    it('should return SELF_RESOLVE for tasks with low retry count', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-1',
        retryCount: 1,
        priority: TaskPriority.P3_MEDIUM,
      };

      mockTaskRepo.findOne.mockResolvedValue(mockTask);

      const level = await service.determineEscalationLevel(
        'task-1',
        'hollon-1',
        'error',
      );

      expect(level).toBe(EscalationLevel.SELF_RESOLVE);
    });

    it('should return ORGANIZATION for P1 tasks', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-1',
        retryCount: 5,
        priority: TaskPriority.P1_CRITICAL,
      };

      mockTaskRepo.findOne.mockResolvedValue(mockTask);

      const level = await service.determineEscalationLevel(
        'task-1',
        'hollon-1',
        'error',
      );

      expect(level).toBe(EscalationLevel.ORGANIZATION);
    });

    it('should return TEAM_COLLABORATION for tasks exceeding retries', async () => {
      const mockTask: Partial<Task> = {
        id: 'task-1',
        retryCount: 4,
        priority: TaskPriority.P2_HIGH,
      };

      mockTaskRepo.findOne.mockResolvedValue(mockTask);

      const level = await service.determineEscalationLevel(
        'task-1',
        'hollon-1',
        'error',
      );

      expect(level).toBe(EscalationLevel.TEAM_COLLABORATION);
    });

    it('should return HUMAN_INTERVENTION for nonexistent tasks', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);

      const level = await service.determineEscalationLevel(
        'nonexistent',
        'hollon-1',
        'error',
      );

      expect(level).toBe(EscalationLevel.HUMAN_INTERVENTION);
    });
  });
});
