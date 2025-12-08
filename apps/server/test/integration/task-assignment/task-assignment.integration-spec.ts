import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TaskService } from '../../../src/modules/task/task.service';
import { HollonService } from '../../../src/modules/hollon/hollon.service';
import {
  Task,
  TaskStatus,
  TaskPriority,
} from '../../../src/modules/task/entities/task.entity';
import {
  Hollon,
  HollonStatus,
  HollonLifecycle,
} from '../../../src/modules/hollon/entities/hollon.entity';
import {
  Project,
  ProjectStatus,
} from '../../../src/modules/project/entities/project.entity';
import { Organization } from '../../../src/modules/organization/entities/organization.entity';
import { Role } from '../../../src/modules/role/entities/role.entity';
import { Team } from '../../../src/modules/team/entities/team.entity';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ApprovalService } from '../../../src/modules/approval/approval.service';
import { ApprovalRequest } from '../../../src/modules/approval/entities/approval-request.entity';
import { RoleService } from '../../../src/modules/role/role.service';
import { TeamService } from '../../../src/modules/team/team.service';
import { OrganizationService } from '../../../src/modules/organization/organization.service';

describe('Task Assignment Integration Tests', () => {
  let module: TestingModule;
  let taskService: TaskService;
  let hollonService: HollonService;
  let taskRepo: Repository<Task>;
  let hollonRepo: Repository<Hollon>;
  let projectRepo: Repository<Project>;
  let orgRepo: Repository<Organization>;
  let roleRepo: Repository<Role>;
  let teamRepo: Repository<Team>;

  let testOrg: Organization;
  let testTeam: Team;
  let testRole: Role;
  let testProject: Project;
  let testHollon1: Hollon;
  let testHollon2: Hollon;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          envFilePath: [
            '../../../../.env.test',
            '../../../../.env.local',
            '../../../../.env',
          ],
        }),
        TypeOrmModule.forRootAsync({
          inject: [ConfigService],
          useFactory: (configService: ConfigService) => ({
            type: 'postgres',
            host: configService.get<string>('DB_HOST'),
            port: configService.get<number>('DB_PORT'),
            username: configService.get<string>('DB_USER'),
            password: configService.get<string>('DB_PASSWORD'),
            database: configService.get<string>('DB_NAME'),
            schema: configService.get<string>('DB_SCHEMA'),
            entities: [__dirname + '/../../../src/**/*.entity{.ts,.js}'],
            synchronize: false,
          }),
        }),
        TypeOrmModule.forFeature([
          Task,
          Hollon,
          Project,
          Organization,
          Role,
          Team,
          ApprovalRequest,
        ]),
      ],
      providers: [
        TaskService,
        HollonService,
        {
          provide: ApprovalService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: RoleService,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: TeamService,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: OrganizationService,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    taskService = module.get<TaskService>(TaskService);
    hollonService = module.get<HollonService>(HollonService);
    taskRepo = module.get<Repository<Task>>(getRepositoryToken(Task));
    hollonRepo = module.get<Repository<Hollon>>(getRepositoryToken(Hollon));
    projectRepo = module.get<Repository<Project>>(getRepositoryToken(Project));
    orgRepo = module.get<Repository<Organization>>(
      getRepositoryToken(Organization),
    );
    roleRepo = module.get<Repository<Role>>(getRepositoryToken(Role));
    teamRepo = module.get<Repository<Team>>(getRepositoryToken(Team));
  });

  beforeEach(async () => {
    // Create test organization
    testOrg = orgRepo.create({
      name: 'Test Org',
      description: 'Test Organization',
      settings: {
        costLimitDailyCents: 10000,
        costLimitMonthlyCents: 100000,
        maxHollonsPerTeam: 10,
        defaultTaskPriority: 'medium',
      },
    });
    await orgRepo.save(testOrg);

    // Create test role
    testRole = roleRepo.create({
      organizationId: testOrg.id,
      name: 'TestEngineer',
      description: 'Test role',
      systemPrompt: 'You are a test engineer',
      capabilities: ['typescript', 'testing'],
    });
    await roleRepo.save(testRole);

    // Create test team
    testTeam = teamRepo.create({
      organizationId: testOrg.id,
      name: 'Test Team',
      description: 'Test team',
    });
    await teamRepo.save(testTeam);

    // Create test project
    testProject = projectRepo.create({
      organizationId: testOrg.id,
      name: 'Test Project',
      description: 'Test project for integration tests',
      status: ProjectStatus.ACTIVE,
    });
    await projectRepo.save(testProject);

    // Create test hollons
    testHollon1 = hollonRepo.create({
      name: 'TestHollon1',
      organizationId: testOrg.id,
      teamId: testTeam.id,
      roleId: testRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      lifecycle: HollonLifecycle.PERMANENT,
      maxConcurrentTasks: 1,
    });

    testHollon2 = hollonRepo.create({
      name: 'TestHollon2',
      organizationId: testOrg.id,
      teamId: testTeam.id,
      roleId: testRole.id,
      brainProviderId: 'claude_code',
      status: HollonStatus.IDLE,
      lifecycle: HollonLifecycle.PERMANENT,
      maxConcurrentTasks: 1,
    });

    await hollonRepo.save([testHollon1, testHollon2]);
  });

  afterEach(async () => {
    // Cleanup in reverse dependency order (with null checks)
    if (testProject?.id) {
      await taskRepo.delete({ projectId: testProject.id });
      await projectRepo.delete({ id: testProject.id });
    }
    if (testHollon1?.id) {
      await hollonRepo.delete({ id: testHollon1.id });
    }
    if (testHollon2?.id) {
      await hollonRepo.delete({ id: testHollon2.id });
    }
    if (testTeam?.id) {
      await teamRepo.delete({ id: testTeam.id });
    }
    if (testRole?.id) {
      await roleRepo.delete({ id: testRole.id });
    }
    if (testOrg?.id) {
      await orgRepo.delete({ id: testOrg.id });
    }
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Task Assignment Flow', () => {
    it('should assign ready task to idle hollon', async () => {
      // Create a ready task
      const task = await taskService.create({
        organizationId: testOrg.id,
        title: 'Test Task',
        description: 'Test task for assignment',
        projectId: testProject.id,
        priority: TaskPriority.P3_MEDIUM,
      });

      expect(task.status).toBe(TaskStatus.PENDING);
      expect(task.assignedHollonId).toBeNull();

      // Assign task to hollon
      await taskService.assignToHollon(task.id, testHollon1.id);

      // Reload task from DB to verify assignment
      const assignedTask = await taskService.findOne(task.id);
      expect(assignedTask.assignedHollonId).toBe(testHollon1.id);
      expect(assignedTask.status).toBe(TaskStatus.IN_PROGRESS);
      expect(assignedTask.startedAt).toBeDefined();

      // Update hollon status (in real flow, orchestrator would do this)
      await hollonService.updateStatus(testHollon1.id, HollonStatus.WORKING);

      // Verify hollon status updated
      const hollon = await hollonService.findOne(testHollon1.id);
      expect(hollon.status).toBe(HollonStatus.WORKING);
      expect(hollon.lastActiveAt).toBeDefined();
    });

    it('should find only unassigned ready tasks', async () => {
      // Create tasks
      const task1 = await taskService.create({
        organizationId: testOrg.id,
        title: 'Unassigned Task 1',
        description: 'Test',
        projectId: testProject.id,
        priority: TaskPriority.P2_HIGH,
      });

      const task2 = await taskService.create({
        organizationId: testOrg.id,
        title: 'Unassigned Task 2',
        description: 'Test',
        projectId: testProject.id,
        priority: TaskPriority.P3_MEDIUM,
      });

      const task3 = await taskService.create({
        organizationId: testOrg.id,
        title: 'Assigned Task',
        description: 'Test',
        projectId: testProject.id,
        priority: TaskPriority.P1_CRITICAL,
      });

      // Assign task3
      await taskService.assignToHollon(task3.id, testHollon1.id);

      // Find ready tasks
      const readyTasks = await taskService.findReadyTasks(testProject.id);

      expect(readyTasks).toHaveLength(2);
      expect(readyTasks.find((t) => t.id === task1.id)).toBeDefined();
      expect(readyTasks.find((t) => t.id === task2.id)).toBeDefined();
      expect(readyTasks.find((t) => t.id === task3.id)).toBeUndefined();

      // Verify priority ordering (P2 before P3)
      expect(readyTasks[0].priority).toBe(TaskPriority.P2_HIGH);
      expect(readyTasks[1].priority).toBe(TaskPriority.P3_MEDIUM);
    });

    it('should complete task and update hollon status', async () => {
      // Create and assign task
      const task = await taskService.create({
        organizationId: testOrg.id,
        title: 'Test Task',
        description: 'Test',
        projectId: testProject.id,
        priority: TaskPriority.P3_MEDIUM,
      });

      await taskService.assignToHollon(task.id, testHollon1.id);
      await hollonService.updateStatus(testHollon1.id, HollonStatus.WORKING);

      // Verify initial state
      let hollon = await hollonService.findOne(testHollon1.id);
      expect(hollon.status).toBe(HollonStatus.WORKING);

      // Complete task
      const completedTask = await taskService.complete(task.id);

      expect(completedTask.status).toBe(TaskStatus.COMPLETED);
      expect(completedTask.completedAt).toBeDefined();

      // Update hollon back to IDLE
      await hollonService.updateStatus(testHollon1.id, HollonStatus.IDLE);

      hollon = await hollonService.findOne(testHollon1.id);
      expect(hollon.status).toBe(HollonStatus.IDLE);
    });

    it('should handle task failure and retry', async () => {
      // Create and assign task
      const task = await taskService.create({
        organizationId: testOrg.id,
        title: 'Failing Task',
        description: 'Test',
        projectId: testProject.id,
        priority: TaskPriority.P3_MEDIUM,
      });

      await taskService.assignToHollon(task.id, testHollon1.id);

      // Fail task
      const failedTask = await taskService.fail(task.id, 'Test error occurred');

      expect(failedTask.status).toBe(TaskStatus.FAILED);
      expect(failedTask.errorMessage).toBe('Test error occurred');
      expect(failedTask.retryCount).toBe(1);

      // Retry by assigning to another hollon
      // First, manually reset status to PENDING for retry
      await taskRepo.update(task.id, {
        status: TaskStatus.PENDING,
        assignedHollonId: null,
      });

      await taskService.assignToHollon(task.id, testHollon2.id);

      // Reload to verify
      const retriedTask = await taskService.findOne(task.id);
      expect(retriedTask.assignedHollonId).toBe(testHollon2.id);
      expect(retriedTask.status).toBe(TaskStatus.IN_PROGRESS);
      expect(retriedTask.retryCount).toBe(1); // Preserved from previous attempt
    });

    it('should handle multiple hollons pulling tasks simultaneously', async () => {
      // Create multiple tasks
      const _tasks = await Promise.all([
        taskService.create({
          organizationId: testOrg.id,
          title: 'Task 1',
          description: 'Test',
          projectId: testProject.id,
          priority: TaskPriority.P3_MEDIUM,
        }),
        taskService.create({
          organizationId: testOrg.id,
          title: 'Task 2',
          description: 'Test',
          projectId: testProject.id,
          priority: TaskPriority.P3_MEDIUM,
        }),
      ]);

      // Find ready tasks for both hollons
      const readyTasks1 = await taskService.findReadyTasks(testProject.id);
      const readyTasks2 = await taskService.findReadyTasks(testProject.id);

      expect(readyTasks1).toHaveLength(2);
      expect(readyTasks2).toHaveLength(2);

      // Assign different tasks to different hollons
      await taskService.assignToHollon(readyTasks1[0].id, testHollon1.id);
      await taskService.assignToHollon(readyTasks2[1].id, testHollon2.id);

      // Update hollon statuses
      await hollonService.updateStatus(testHollon1.id, HollonStatus.WORKING);
      await hollonService.updateStatus(testHollon2.id, HollonStatus.WORKING);

      // Verify both hollons are working
      const hollon1 = await hollonService.findOne(testHollon1.id);
      const hollon2 = await hollonService.findOne(testHollon2.id);

      // Reload tasks to verify
      const assignedTask1 = await taskService.findOne(readyTasks1[0].id);
      const assignedTask2 = await taskService.findOne(readyTasks2[1].id);

      expect(hollon1.status).toBe(HollonStatus.WORKING);
      expect(hollon2.status).toBe(HollonStatus.WORKING);
      expect(assignedTask1.assignedHollonId).toBe(testHollon1.id);
      expect(assignedTask2.assignedHollonId).toBe(testHollon2.id);

      // Verify no tasks are left unassigned
      const remainingTasks = await taskService.findReadyTasks(testProject.id);
      expect(remainingTasks).toHaveLength(0);
    });

    it('should handle subtask creation and assignment', async () => {
      // Create parent task
      const parentTask = await taskService.create({
        organizationId: testOrg.id,
        title: 'Parent Task',
        description: 'Test parent',
        projectId: testProject.id,
        priority: TaskPriority.P2_HIGH,
      });

      // Assign to hollon
      await taskService.assignToHollon(parentTask.id, testHollon1.id);

      // Create subtask
      const subtask = await taskService.create({
        organizationId: testOrg.id,
        title: 'Subtask',
        description: 'Test subtask',
        projectId: testProject.id,
        parentTaskId: parentTask.id,
        priority: TaskPriority.P3_MEDIUM,
      });

      expect(subtask.depth).toBe(1);
      expect(subtask.parentTaskId).toBe(parentTask.id);
      expect(subtask.status).toBe(TaskStatus.PENDING);

      // Subtask can be assigned independently
      await taskService.assignToHollon(subtask.id, testHollon2.id);

      // Reload to verify
      const assignedSubtask = await taskService.findOne(subtask.id);
      expect(assignedSubtask.assignedHollonId).toBe(testHollon2.id);
      expect(assignedSubtask.status).toBe(TaskStatus.IN_PROGRESS);
    });
  });

  describe('Hollon Task Pulling Workflow', () => {
    it('should simulate hollon autonomous task pulling', async () => {
      // Create multiple tasks with different priorities
      await Promise.all([
        taskService.create({
          organizationId: testOrg.id,
          title: 'Critical Bug',
          description: 'Fix production issue',
          projectId: testProject.id,
          priority: TaskPriority.P1_CRITICAL,
        }),
        taskService.create({
          organizationId: testOrg.id,
          title: 'Feature Implementation',
          description: 'Add new feature',
          projectId: testProject.id,
          priority: TaskPriority.P3_MEDIUM,
        }),
        taskService.create({
          organizationId: testOrg.id,
          title: 'Code Review',
          description: 'Review PR',
          projectId: testProject.id,
          priority: TaskPriority.P4_LOW,
        }),
      ]);

      // Hollon 1: Pull highest priority task
      const idleHollons = await hollonService.findIdleHollons(testOrg.id);
      expect(idleHollons.length).toBeGreaterThanOrEqual(1);

      const availableTasks = await taskService.findReadyTasks(testProject.id);
      expect(availableTasks).toHaveLength(3);

      // Highest priority should be first
      const taskToPull = availableTasks[0];
      expect(taskToPull.priority).toBe(TaskPriority.P1_CRITICAL);

      // Assign task
      await taskService.assignToHollon(taskToPull.id, testHollon1.id);
      await hollonService.updateStatus(testHollon1.id, HollonStatus.WORKING);

      // Verify hollon is no longer idle
      const updatedIdleHollons = await hollonService.findIdleHollons(
        testOrg.id,
      );
      expect(
        updatedIdleHollons.find((h) => h.id === testHollon1.id),
      ).toBeUndefined();

      // Complete task
      await taskService.complete(taskToPull.id);
      await hollonService.updateStatus(testHollon1.id, HollonStatus.IDLE);

      // Hollon should be idle again
      const finalIdleHollons = await hollonService.findIdleHollons(testOrg.id);
      expect(
        finalIdleHollons.find((h) => h.id === testHollon1.id),
      ).toBeDefined();
    });
  });
});
