import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TeamTaskDistributionService } from './team-task-distribution.service';
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
} from '../../task/entities/task.entity';
import { BrainProviderService } from '../../brain-provider/brain-provider.service';
import { SubtaskCreationService } from './subtask-creation.service';
import { HollonStatus } from '../../hollon/entities/hollon.entity';
import type { Team } from '../../team/entities/team.entity';
import type { Organization } from '../../organization/entities/organization.entity';
import type { Project } from '../../project/entities/project.entity';
import type { Cycle } from '../../project/entities/cycle.entity';
import type { Hollon } from '../../hollon/entities/hollon.entity';
import { NotFoundException } from '@nestjs/common';

describe('TeamTaskDistributionService', () => {
  let service: TeamTaskDistributionService;

  const mockTask = (overrides: Partial<Task> = {}): Task => ({
    id: 'task-1',
    title: 'Knowledge System Implementation',
    description: 'Build knowledge extraction and learning system',
    type: TaskType.TEAM_EPIC,
    status: TaskStatus.PENDING,
    priority: TaskPriority.P1_CRITICAL,
    organizationId: 'org-1',
    projectId: 'project-1',
    cycleId: null,
    assignedTeamId: 'team-1',
    assignedHollonId: null,
    parentTaskId: null,
    creatorHollonId: null,
    depth: 0,
    affectedFiles: [],
    acceptanceCriteria: ['Build KnowledgeExtraction', 'Build VectorSearch'],
    estimatedComplexity: 'high',
    tags: [],
    retryCount: 0,
    errorMessage: null,
    storyPoints: 8,
    blockedReason: null,
    startedAt: null,
    completedAt: null,
    dueDate: null,
    requiredSkills: ['typescript', 'ai'],
    needsHumanApproval: false,
    consecutiveFailures: 0,
    lastFailedAt: null,
    blockedUntil: null,
    reviewCount: 0, // Phase 3.10
    lastReviewedAt: null, // Phase 3.10
    createdAt: new Date(),
    updatedAt: new Date(),
    organization: undefined as unknown as Organization,
    project: undefined as unknown as Project,
    cycle: undefined as unknown as Cycle,
    assignedTeam: {
      id: 'team-1',
      name: 'Knowledge Team',
      description: 'AI/ML team',
      organizationId: 'org-1',
      parentTeamId: null,
      leaderHollonId: null,
      managerHollonId: 'manager-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      organization: undefined as unknown as Organization,
      parentTeam: null,
      childTeams: [],
      leader: null,
      manager: {
        id: 'manager-1',
        name: 'Manager-AI',
        organizationId: 'org-1',
        teamId: 'team-1',
        roleId: 'role-manager',
        status: HollonStatus.IDLE,
        personality: 'Strategic thinker',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Partial<Hollon> as Hollon,
      hollons: [
        {
          id: 'dev-1',
          name: 'DevBot-AI',
          organizationId: 'org-1',
          teamId: 'team-1',
          roleId: 'role-dev',
          role: {
            id: 'role-dev',
            name: 'Developer',
            capabilities: ['typescript', 'ai'],
          } as unknown as Hollon,
        } as unknown as Hollon,
        {
          id: 'dev-2',
          name: 'DevBot-Data',
          organizationId: 'org-1',
          teamId: 'team-1',
          roleId: 'role-dev',
          role: {
            id: 'role-dev',
            name: 'Developer',
            capabilities: ['python', 'data'],
          } as unknown as Hollon,
        } as unknown as Hollon,
      ],
      assignedTasks: [],
    },
    assignedHollon: undefined as unknown as Hollon,
    parentTask: undefined as unknown as Task,
    subtasks: [],
    creatorHollon: undefined as unknown as Hollon,
    dependencies: [],
    dependentTasks: [],
    ...overrides,
  });

  const mockTaskRepo = {
    findOne: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
    find: jest.fn(),
    save: jest.fn(),
  };

  const mockBrainProvider = {
    executeWithTracking: jest.fn(),
  };

  const mockSubtaskService = {
    createSubtasks: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TeamTaskDistributionService,
        {
          provide: getRepositoryToken(Task),
          useValue: mockTaskRepo,
        },
        {
          provide: BrainProviderService,
          useValue: mockBrainProvider,
        },
        {
          provide: SubtaskCreationService,
          useValue: mockSubtaskService,
        },
      ],
    }).compile();

    service = module.get<TeamTaskDistributionService>(
      TeamTaskDistributionService,
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('distributeToTeam', () => {
    it('should throw NotFoundException if team task not found', async () => {
      mockTaskRepo.findOne.mockResolvedValue(null);

      await expect(service.distributeToTeam('task-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if task has no assigned team', async () => {
      const task = mockTask({
        assignedTeam: undefined as unknown as Team,
      });
      mockTaskRepo.findOne.mockResolvedValue(task);

      await expect(service.distributeToTeam('task-1')).rejects.toThrow(
        'Team task task-1 is not assigned to a team',
      );
    });

    it('should throw NotFoundException if team has no manager', async () => {
      const task = mockTask();
      task.assignedTeam!.manager = null;
      mockTaskRepo.findOne.mockResolvedValue(task);

      await expect(service.distributeToTeam('task-1')).rejects.toThrow(
        'Team Knowledge Team does not have a manager hollon',
      );
    });

    it('should successfully distribute team task to team members', async () => {
      const task = mockTask();
      mockTaskRepo.findOne.mockResolvedValue(task);
      mockTaskRepo.count.mockResolvedValue(2); // Current workload for each member

      // Mock Brain Provider response
      mockBrainProvider.executeWithTracking.mockResolvedValue({
        output: JSON.stringify({
          subtasks: [
            {
              title: 'KnowledgeExtractionService',
              description: 'Build knowledge extraction',
              assignedTo: 'DevBot-AI',
              type: 'implementation',
              priority: 'P1',
              estimatedComplexity: 'high',
              dependencies: [],
            },
            {
              title: 'VectorSearchService',
              description: 'Build vector search',
              assignedTo: 'DevBot-Data',
              type: 'implementation',
              priority: 'P2',
              estimatedComplexity: 'medium',
              dependencies: ['KnowledgeExtractionService'],
            },
          ],
          reasoning: 'Distributed based on expertise',
        }),
        success: true,
        duration: 1500,
        cost: {
          inputTokens: 500,
          outputTokens: 200,
          totalCostCents: 1,
        },
      });

      // Mock subtask creation
      mockSubtaskService.createSubtasks.mockResolvedValue({
        createdSubtasks: [
          {
            id: 'subtask-1',
            title: 'KnowledgeExtractionService',
            depth: 1,
          },
          {
            id: 'subtask-2',
            title: 'VectorSearchService',
            depth: 1,
          },
        ],
        parentTask: task,
      });

      mockTaskRepo.update.mockResolvedValue({ affected: 1 });
      mockTaskRepo.find.mockResolvedValue([
        { id: 'subtask-1', title: 'KnowledgeExtractionService' },
        { id: 'subtask-2', title: 'VectorSearchService' },
      ]);

      const result = await service.distributeToTeam('task-1');

      expect(result).toBeDefined();
      expect(result.length).toBe(2);
      expect(mockBrainProvider.executeWithTracking).toHaveBeenCalled();
      expect(mockSubtaskService.createSubtasks).toHaveBeenCalled();
      expect(mockTaskRepo.update).toHaveBeenCalledWith('task-1', {
        status: TaskStatus.IN_PROGRESS,
      });
    });
  });

  describe('parseDistributionPlan', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        subtasks: [
          {
            title: 'Task 1',
            description: 'Description 1',
            assignedTo: 'DevBot-1',
            type: 'implementation',
            priority: 'P1',
            estimatedComplexity: 'high',
            dependencies: [],
          },
        ],
        reasoning: 'Test reasoning',
      });

      const plan = (
        service as unknown as {
          parseDistributionPlan: (response: string) => {
            subtasks: unknown[];
            reasoning: string;
          };
        }
      ).parseDistributionPlan(response);

      expect(plan).toBeDefined();
      expect(plan.subtasks).toHaveLength(1);
      expect((plan.subtasks[0] as { title: string }).title).toBe('Task 1');
      expect(plan.reasoning).toBe('Test reasoning');
    });

    it('should parse JSON wrapped in markdown code blocks', () => {
      const response = '```json\n{"subtasks": [], "reasoning": "test"}\n```';

      const plan = (
        service as unknown as {
          parseDistributionPlan: (response: string) => {
            subtasks: unknown[];
            reasoning: string;
          };
        }
      ).parseDistributionPlan(response);

      expect(plan).toBeDefined();
      expect(plan.subtasks).toHaveLength(0);
    });

    it('should throw error for invalid JSON', () => {
      const response = 'invalid json';

      expect(() =>
        (
          service as unknown as {
            parseDistributionPlan: (response: string) => unknown;
          }
        ).parseDistributionPlan(response),
      ).toThrow();
    });
  });

  describe('hasCircularDependency', () => {
    it('should detect circular dependency', () => {
      const graph = new Map<string, string[]>();
      graph.set('A', ['B']);
      graph.set('B', ['C']);
      graph.set('C', ['A']); // Circular: A → B → C → A

      const result = (
        service as unknown as {
          hasCircularDependency: (graph: Map<string, string[]>) => boolean;
        }
      ).hasCircularDependency(graph);

      expect(result).toBe(true);
    });

    it('should return false for acyclic graph', () => {
      const graph = new Map<string, string[]>();
      graph.set('A', ['B']);
      graph.set('B', ['C']);
      graph.set('C', []);

      const result = (
        service as unknown as {
          hasCircularDependency: (graph: Map<string, string[]>) => boolean;
        }
      ).hasCircularDependency(graph);

      expect(result).toBe(false);
    });

    it('should handle empty graph', () => {
      const graph = new Map<string, string[]>();

      const result = (
        service as unknown as {
          hasCircularDependency: (graph: Map<string, string[]>) => boolean;
        }
      ).hasCircularDependency(graph);

      expect(result).toBe(false);
    });

    it('should detect self-referencing node', () => {
      const graph = new Map<string, string[]>();
      graph.set('A', ['A']); // Self-reference

      const result = (
        service as unknown as {
          hasCircularDependency: (graph: Map<string, string[]>) => boolean;
        }
      ).hasCircularDependency(graph);

      expect(result).toBe(true);
    });
  });

  describe('validatePlan', () => {
    it('should throw error for invalid assignee', async () => {
      const plan = {
        subtasks: [
          {
            title: 'Task 1',
            description: 'Desc',
            assignedTo: 'NonExistentBot',
            type: TaskType.IMPLEMENTATION,
            priority: 'P1',
            estimatedComplexity: 'high' as const,
            dependencies: [],
          },
        ],
        reasoning: 'Test',
      };

      const team = {
        id: 'team-1',
        name: 'Test Team',
        hollons: [{ name: 'DevBot-1' }, { name: 'DevBot-2' }],
      } as Partial<Team> as Team;

      await expect(
        (
          service as unknown as {
            validatePlan: (plan: unknown, team: Team) => Promise<void>;
          }
        ).validatePlan(plan, team),
      ).rejects.toThrow(
        'Invalid assignee "NonExistentBot" - not a member of team Test Team',
      );
    });

    it('should throw error for circular dependencies in plan', async () => {
      const plan = {
        subtasks: [
          {
            title: 'Task A',
            description: 'Desc',
            assignedTo: 'DevBot-1',
            type: TaskType.IMPLEMENTATION,
            priority: 'P1',
            estimatedComplexity: 'high' as const,
            dependencies: ['Task B'],
          },
          {
            title: 'Task B',
            description: 'Desc',
            assignedTo: 'DevBot-2',
            type: TaskType.IMPLEMENTATION,
            priority: 'P1',
            estimatedComplexity: 'high' as const,
            dependencies: ['Task A'],
          },
        ],
        reasoning: 'Test',
      };

      const team = {
        id: 'team-1',
        name: 'Test Team',
        hollons: [{ name: 'DevBot-1' }, { name: 'DevBot-2' }],
      } as Partial<Team> as Team;

      await expect(
        (
          service as unknown as {
            validatePlan: (plan: unknown, team: Team) => Promise<void>;
          }
        ).validatePlan(plan, team),
      ).rejects.toThrow('Circular dependency detected in distribution plan');
    });

    it('should pass validation for valid plan', async () => {
      const plan = {
        subtasks: [
          {
            title: 'Task A',
            description: 'Desc',
            assignedTo: 'DevBot-1',
            type: TaskType.IMPLEMENTATION,
            priority: 'P1',
            estimatedComplexity: 'high' as const,
            dependencies: [],
          },
          {
            title: 'Task B',
            description: 'Desc',
            assignedTo: 'DevBot-2',
            type: TaskType.IMPLEMENTATION,
            priority: 'P1',
            estimatedComplexity: 'high' as const,
            dependencies: ['Task A'],
          },
        ],
        reasoning: 'Test',
      };

      const team = {
        id: 'team-1',
        name: 'Test Team',
        hollons: [{ name: 'DevBot-1' }, { name: 'DevBot-2' }],
      } as Partial<Team> as Team;

      await expect(
        (
          service as unknown as {
            validatePlan: (plan: unknown, team: Team) => Promise<void>;
          }
        ).validatePlan(plan, team),
      ).resolves.not.toThrow();
    });
  });
});
