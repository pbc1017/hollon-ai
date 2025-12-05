import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { HollonOrchestratorService } from '../../src/modules/orchestration/services/hollon-orchestrator.service';
import { Organization } from '../../src/modules/organization/entities/organization.entity';
import { Team } from '../../src/modules/team/entities/team.entity';
import { Role } from '../../src/modules/role/entities/role.entity';
import { Hollon } from '../../src/modules/hollon/entities/hollon.entity';
import { Project } from '../../src/modules/project/entities/project.entity';
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
} from '../../../src/modules/task/entities/task.entity';
import { BrainProviderConfig } from '../../src/modules/brain-provider/entities/brain-provider-config.entity';

/**
 * Concurrent Hollons E2E Test
 * 
 * Tests that multiple hollons can work simultaneously without conflicts:
 * 1. File conflict prevention - hollons don't work on same files
 * 2. Atomic task assignment - no race conditions
 * 3. Efficient task distribution
 * 4. Priority ordering maintained
 * 
 * This validates Phase 1 completion criterion:
 * "2개 홀론 동시 운영 스모크 테스트 통과"
 */
describe('Concurrent Hollons E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orchestrator: HollonOrchestratorService;

  let organization: Organization;
  let team: Team;
  let role: Role;
  let hollon1: Hollon;
  let hollon2: Hollon;
  let project: Project;
  let brainConfig: BrainProviderConfig;

  let testRunId: number;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    orchestrator = moduleFixture.get<HollonOrchestratorService>(
      HollonOrchestratorService,
    );

    // Clean database
    await dataSource.query(
      'TRUNCATE tasks, documents, cost_records, projects, hollons, roles, teams, brain_provider_configs, organizations RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Generate unique ID for each test
    testRunId = Date.now() + Math.random();
    
    // Create test organization
    const orgRepo = dataSource.getRepository(Organization);
    organization = await orgRepo.save({
      name: `Test Org ${testRunId}`,
      description: 'Test organization',
      settings: {
        costLimitDailyCents: 50000, // Higher limit for concurrent tests
        costLimitMonthlyCents: 500000,
        maxHollonsPerTeam: 10,
        defaultTaskPriority: 'medium',
      },
    });

    // Create brain provider config
    const configRepo = dataSource.getRepository(BrainProviderConfig);
    brainConfig = await configRepo.save({
      organizationId: organization.id,
      providerId: 'claude_code',
      displayName: 'Claude Code',
      config: {},
      costPerInputTokenCents: 0.0003,
      costPerOutputTokenCents: 0.0015,
      enabled: true,
      timeoutSeconds: 120,
    });

    // Create team
    const teamRepo = dataSource.getRepository(Team);
    team = await teamRepo.save({
      organizationId: organization.id,
      name: `Test Team ${testRunId}`,
      description: 'Test team',
    });

    // Create role
    const roleRepo = dataSource.getRepository(Role);
    role = await roleRepo.save({
      organizationId: organization.id,
      name: `Test Developer ${testRunId}`,
      description: 'Test developer role',
      systemPrompt: 'You are a helpful software developer.',
      capabilities: ['typescript'],
    });

    // Create 2 hollons
    const hollonRepo = dataSource.getRepository(Hollon);
    hollon1 = await hollonRepo.save({
      organizationId: organization.id,
      teamId: team.id,
      roleId: role.id,
      name: `Hollon 1 ${testRunId}`,
      status: 'idle',
    });

    hollon2 = await hollonRepo.save({
      organizationId: organization.id,
      teamId: team.id,
      roleId: role.id,
      name: `Hollon 2 ${testRunId}`,
      status: 'idle',
    });

    // Create project
    const projectRepo = dataSource.getRepository(Project);
    project = await projectRepo.save({
      organizationId: organization.id,
      name: `Test Project ${testRunId}`,
      description: 'Test project',
      workingDirectory: process.cwd(),
    });
  });

  describe('No File Conflict Scenario', () => {
    it('should process 2 tasks simultaneously without conflict', async () => {
      const taskRepo = dataSource.getRepository(Task);

      // Create 2 tasks with different files
      const task1 = await taskRepo.save({
        projectId: project.id,
        title: 'Task 1 - Calculate 10+5',
        description: 'Calculate 10 + 5 and return only the number',
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.READY,
        priority: TaskPriority.P2,
        affectedFiles: ['src/calc1.ts'],
      });

      const task2 = await taskRepo.save({
        projectId: project.id,
        title: 'Task 2 - Calculate 20+7',
        description: 'Calculate 20 + 7 and return only the number',
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.READY,
        priority: TaskPriority.P2,
        affectedFiles: ['src/calc2.ts'],
      });

      // Run both hollons simultaneously
      const [result1, result2] = await Promise.all([
        orchestrator.runCycle(hollon1.id),
        orchestrator.runCycle(hollon2.id),
      ]);

      // Both should succeed
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);

      // Each should have processed a different task
      expect(result1.taskId).toBeDefined();
      expect(result2.taskId).toBeDefined();
      expect(result1.taskId).not.toBe(result2.taskId);

      // Verify both tasks assigned to different hollons
      const taskIds = [result1.taskId, result2.taskId].sort();
      const expectedIds = [task1.id, task2.id].sort();
      expect(taskIds).toEqual(expectedIds);

      // Verify both tasks completed
      const completedTasks = await taskRepo.find({
        where: { projectId: project.id, status: TaskStatus.COMPLETED },
      });
      expect(completedTasks.length).toBe(2);
    }, 240000); // 4 minute timeout for 2 concurrent API calls
  });

  describe('File Conflict Prevention', () => {
    it('should prevent concurrent processing of same file', async () => {
      const taskRepo = dataSource.getRepository(Task);

      // Create 2 tasks with overlapping files
      const task1 = await taskRepo.save({
        projectId: project.id,
        title: 'Task 1 - Modify shared.ts',
        description: 'Add function foo() to shared.ts that returns "foo"',
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.READY,
        priority: TaskPriority.P1,
        affectedFiles: ['src/shared.ts'],
      });

      const task2 = await taskRepo.save({
        projectId: project.id,
        title: 'Task 2 - Modify shared.ts',
        description: 'Add function bar() to shared.ts that returns "bar"',
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.READY,
        priority: TaskPriority.P1,
        affectedFiles: ['src/shared.ts'],
      });

      // Run both hollons simultaneously
      const [result1, result2] = await Promise.all([
        orchestrator.runCycle(hollon1.id),
        orchestrator.runCycle(hollon2.id),
      ]);

      // One should succeed, one should find no available task due to conflict
      const successCount = [result1, result2].filter(
        (r) => r.success && r.taskId,
      ).length;
      expect(successCount).toBe(1);

      // One should have no task available due to file conflict
      const noTaskCount = [result1, result2].filter(
        (r) => r.noTaskAvailable,
      ).length;
      expect(noTaskCount).toBe(1);

      // Verify only one task was claimed
      const inProgressTasks = await taskRepo.find({
        where: { projectId: project.id, status: TaskStatus.IN_PROGRESS },
      });
      expect(inProgressTasks.length).toBe(1);

      // Verify the other task is still ready
      const readyTasks = await taskRepo.find({
        where: { projectId: project.id, status: TaskStatus.READY },
      });
      expect(readyTasks.length).toBe(1);
    }, 240000);
  });

  describe('Multiple Cycles with File Distribution', () => {
    it('should efficiently distribute 5 tasks across 2 hollons', async () => {
      const taskRepo = dataSource.getRepository(Task);

      // Create 5 tasks with different files
      const tasks = await Promise.all([
        taskRepo.save({
          projectId: project.id,
          title: 'Task 1',
          description: 'Return "One"',
          type: TaskType.IMPLEMENTATION,
          status: TaskStatus.READY,
          priority: TaskPriority.P2,
          affectedFiles: ['file1.ts'],
        }),
        taskRepo.save({
          projectId: project.id,
          title: 'Task 2',
          description: 'Return "Two"',
          type: TaskType.IMPLEMENTATION,
          status: TaskStatus.READY,
          priority: TaskPriority.P2,
          affectedFiles: ['file2.ts'],
        }),
        taskRepo.save({
          projectId: project.id,
          title: 'Task 3',
          description: 'Return "Three"',
          type: TaskType.IMPLEMENTATION,
          status: TaskStatus.READY,
          priority: TaskPriority.P2,
          affectedFiles: ['file3.ts'],
        }),
        taskRepo.save({
          projectId: project.id,
          title: 'Task 4',
          description: 'Return "Four"',
          type: TaskType.IMPLEMENTATION,
          status: TaskStatus.READY,
          priority: TaskPriority.P2,
          affectedFiles: ['file4.ts'],
        }),
        taskRepo.save({
          projectId: project.id,
          title: 'Task 5',
          description: 'Return "Five"',
          type: TaskType.IMPLEMENTATION,
          status: TaskStatus.READY,
          priority: TaskPriority.P2,
          affectedFiles: ['file5.ts'],
        }),
      ]);

      // Run 3 cycles per hollon (total 6 cycles, 5 tasks)
      const cycles = [];
      for (let i = 0; i < 3; i++) {
        cycles.push(
          orchestrator.runCycle(hollon1.id),
          orchestrator.runCycle(hollon2.id),
        );
      }

      const results = await Promise.all(cycles);

      // Count successful completions
      const completedTasks = results.filter((r) => r.success && r.taskId);
      expect(completedTasks.length).toBe(5);

      // Verify all tasks are completed
      const allTasks = await taskRepo.find({
        where: { projectId: project.id },
      });
      const completedCount = allTasks.filter(
        (t) => t.status === TaskStatus.COMPLETED,
      ).length;
      expect(completedCount).toBe(5);

      // Verify tasks distributed across both hollons
      const hollon1Tasks = allTasks.filter(
        (t) => t.assignedHollonId === hollon1.id,
      );
      const hollon2Tasks = allTasks.filter(
        (t) => t.assignedHollonId === hollon2.id,
      );

      // Both hollons should have worked on at least 1 task
      expect(hollon1Tasks.length).toBeGreaterThan(0);
      expect(hollon2Tasks.length).toBeGreaterThan(0);

      // Total should be 5
      expect(hollon1Tasks.length + hollon2Tasks.length).toBe(5);
    }, 720000); // 12 minute timeout for 6 cycles
  });

  describe('Priority Ordering with Concurrency', () => {
    it('should maintain priority order even with concurrent execution', async () => {
      const taskRepo = dataSource.getRepository(Task);

      // Create tasks with different priorities
      const p1Task = await taskRepo.save({
        projectId: project.id,
        title: 'P1 Task',
        description: 'High priority - return "urgent"',
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.READY,
        priority: TaskPriority.P1,
        affectedFiles: ['p1.ts'],
      });

      const p3Task = await taskRepo.save({
        projectId: project.id,
        title: 'P3 Task',
        description: 'Low priority - return "later"',
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.READY,
        priority: TaskPriority.P3,
        affectedFiles: ['p3.ts'],
      });

      // Both hollons pull at the same time
      const [result1, result2] = await Promise.all([
        orchestrator.runCycle(hollon1.id),
        orchestrator.runCycle(hollon2.id),
      ]);

      // P1 should be picked first
      const firstResult = [result1, result2].find((r) => r.taskId === p1Task.id);
      expect(firstResult).toBeDefined();
      expect(firstResult.success).toBe(true);

      // P3 should be picked second
      const secondResult = [result1, result2].find((r) => r.taskId === p3Task.id);
      expect(secondResult).toBeDefined();
      expect(secondResult.success).toBe(true);
    }, 240000);
  });

  describe('Atomic Task Assignment', () => {
    it('should prevent race conditions in task assignment', async () => {
      const taskRepo = dataSource.getRepository(Task);

      // Create single task
      const task = await taskRepo.save({
        projectId: project.id,
        title: 'Single Task',
        description: 'Return "one"',
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.READY,
        priority: TaskPriority.P2,
      });

      // Both hollons try to claim simultaneously
      const [result1, result2] = await Promise.all([
        orchestrator.runCycle(hollon1.id),
        orchestrator.runCycle(hollon2.id),
      ]);

      // Exactly one should succeed
      const successCount = [result1, result2].filter(
        (r) => r.success && r.taskId,
      ).length;
      expect(successCount).toBe(1);

      // The other should have no task available
      const noTaskCount = [result1, result2].filter(
        (r) => r.noTaskAvailable,
      ).length;
      expect(noTaskCount).toBe(1);

      // Verify task assigned to exactly one hollon
      const updatedTask = await taskRepo.findOne({
        where: { id: task.id },
      });
      expect(updatedTask.assignedHollonId).toBeDefined();
      expect(updatedTask.status).toBe(TaskStatus.IN_PROGRESS);
    }, 240000);
  });
});
