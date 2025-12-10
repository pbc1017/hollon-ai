/**
 * Phase 3.9: Multi-Turn Delegation Integration Tests
 *
 * Tests SSOT-compliant multi-turn behavior:
 * - Parent hollon delegates complex task to sub-hollons
 * - Parent task status becomes IN_PROGRESS (prevents duplicate pulling)
 * - Parent hollon returns to IDLE (can take new tasks - parallel execution)
 * - Sub-hollons execute independently with dependency management
 * - Parent task completes when all subtasks complete
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
} from '@/modules/task/entities/task.entity';
import {
  Hollon,
  HollonStatus,
  HollonLifecycle,
} from '@/modules/hollon/entities/hollon.entity';
import { Organization } from '@/modules/organization/entities/organization.entity';
import { Team } from '@/modules/team/entities/team.entity';
import { Role } from '@/modules/role/entities/role.entity';
import { Project } from '@/modules/project/entities/project.entity';
import { HollonOrchestratorService } from '@/modules/orchestration/services/hollon-orchestrator.service';
import { TaskPoolService } from '@/modules/orchestration/services/task-pool.service';
import { BrainProviderService } from '@/modules/brain-provider/brain-provider.service';
import { SubtaskCreationService } from '@/modules/orchestration/services/subtask-creation.service';
import { cleanupTestData } from '../../utils/test-database.utils';

describe('Phase 3.9: Multi-Turn Delegation (SSOT)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orchestrator: HollonOrchestratorService;
  let taskPool: TaskPoolService;
  let brainProvider: BrainProviderService;
  let subtaskService: SubtaskCreationService;

  // Test entities
  let organization: Organization;
  let team: Team;
  let project: Project;
  let developerRole: Role;
  let plannerRole: Role;
  let parentHollon: Hollon;
  let complexTask: Task;
  let simpleTask: Task;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    orchestrator = app.get(HollonOrchestratorService);
    taskPool = app.get(TaskPoolService);
    brainProvider = app.get(BrainProviderService);
    subtaskService = app.get(SubtaskCreationService);

    // Setup test data
    const orgRepo = dataSource.getRepository(Organization);
    organization = await orgRepo.save({
      name: 'Multi-Turn Test Org',
      settings: {},
    });

    const teamRepo = dataSource.getRepository(Team);
    team = await teamRepo.save({
      name: 'Multi-Turn Team',
      organizationId: organization.id,
    });

    const projectRepo = dataSource.getRepository(Project);
    project = await projectRepo.save({
      name: 'Multi-Turn Project',
      organizationId: organization.id,
    });

    const roleRepo = dataSource.getRepository(Role);
    developerRole = await roleRepo.save({
      name: 'Developer',
      organizationId: organization.id,
      capabilities: ['typescript', 'nestjs'],
      availableForTemporaryHollon: false,
    });

    plannerRole = await roleRepo.save({
      name: 'Planner',
      organizationId: organization.id,
      capabilities: ['planning', 'analysis'],
      availableForTemporaryHollon: true,
    });

    const hollonRepo = dataSource.getRepository(Hollon);
    parentHollon = await hollonRepo.save({
      name: 'ParentHollon',
      organizationId: organization.id,
      teamId: team.id,
      roleId: developerRole.id,
      status: HollonStatus.IDLE,
      lifecycle: HollonLifecycle.PERMANENT,
      depth: 0,
      brainProviderId: 'claude_code',
    });

    // Create complex task (will trigger sub-hollon delegation)
    const taskRepo = dataSource.getRepository(Task);
    complexTask = await taskRepo.save({
      title: 'Complex Feature Implementation',
      description:
        'This is a very long and complex task description. ' + 'X'.repeat(500),
      organizationId: organization.id,
      projectId: project.id,
      type: TaskType.IMPLEMENTATION,
      status: TaskStatus.READY,
      priority: TaskPriority.P1_CRITICAL,
      assignedHollonId: parentHollon.id,
      depth: 0,
      estimatedComplexity: 'high',
      storyPoints: 13, // > 8 triggers complexity check
    });

    // Create simple task (for parallel execution test)
    simpleTask = await taskRepo.save({
      title: 'Simple Bug Fix',
      description: 'Quick fix',
      organizationId: organization.id,
      projectId: project.id,
      type: TaskType.BUG_FIX,
      status: TaskStatus.READY,
      priority: TaskPriority.P2_HIGH,
      assignedHollonId: parentHollon.id,
      depth: 0,
      estimatedComplexity: 'low',
    });
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await app.close();
  });

  describe('SSOT: Parent Task Status Management', () => {
    it('should update parent task to IN_PROGRESS after delegation', async () => {
      const taskRepo = dataSource.getRepository(Task);

      // Reset tasks to READY state (ensure clean state)
      await taskRepo.update(complexTask.id, { status: TaskStatus.READY });
      await taskRepo.update(simpleTask.id, { status: TaskStatus.READY });
      await taskRepo.delete({ parentTaskId: complexTask.id });

      // Mock brain provider to return valid decomposition
      jest.spyOn(brainProvider, 'executeWithTracking').mockResolvedValue({
        output: JSON.stringify({
          subtasks: [
            {
              title: 'Subtask A',
              description: 'First subtask',
              type: 'implementation',
              roleId: plannerRole.id,
              dependencies: [],
              priority: 'P1',
            },
            {
              title: 'Subtask B',
              description: 'Second subtask',
              type: 'review',
              roleId: plannerRole.id,
              dependencies: ['Subtask A'],
              priority: 'P1',
            },
          ],
          reasoning: 'Test decomposition',
        }),
        success: true,
        duration: 100,
        cost: {
          inputTokens: 100,
          outputTokens: 50,
          totalCostCents: 1,
        },
      } as unknown);

      // Initial state
      expect(complexTask.status).toBe(TaskStatus.READY);

      // Turn 1: Parent hollon executes complex task → delegates to sub-hollons
      const result = await orchestrator.runCycle(parentHollon.id);

      expect(result.success).toBe(true);
      expect(result.output).toBe('Task delegated to Sub-Hollons');

      // Verify parent task status changed to IN_PROGRESS
      const updatedTask = await taskRepo.findOne({
        where: { id: complexTask.id },
      });
      expect(updatedTask!.status).toBe(TaskStatus.IN_PROGRESS);

      // Verify subtasks were created
      const subtasks = await taskRepo.find({
        where: { parentTaskId: complexTask.id },
      });
      expect(subtasks.length).toBe(2);
      expect(subtasks[0].status).toBe(TaskStatus.READY); // No deps
      expect(subtasks[1].status).toBe(TaskStatus.BLOCKED); // Has deps
    });
  });

  describe('SSOT: Duplicate Task Prevention', () => {
    it('should NOT pull the same task twice', async () => {
      const taskRepo = dataSource.getRepository(Task);

      // Reset tasks to READY state (in case previous tests modified them)
      await taskRepo.update(complexTask.id, { status: TaskStatus.READY });
      await taskRepo.update(simpleTask.id, { status: TaskStatus.READY });

      // Turn 1: Pull next task (should be complex task due to P1 priority)
      const pull1 = await taskPool.pullNextTask(parentHollon.id);
      expect(pull1.task).toBeDefined();

      const firstTaskId = pull1.task!.id;

      // Simulate task being delegated (status → IN_PROGRESS)
      await taskRepo.update(firstTaskId, {
        status: TaskStatus.IN_PROGRESS,
      });

      // Turn 2: Try to pull again - should get different task or null
      const pull2 = await taskPool.pullNextTask(parentHollon.id);

      if (pull2.task) {
        // If got a task, it should be different from first task
        expect(pull2.task.id).not.toBe(firstTaskId);
      } else {
        // Or no task available (both tasks taken)
        expect(pull2.task).toBeNull();
      }

      // Reset for other tests
      await taskRepo.update(complexTask.id, { status: TaskStatus.READY });
      await taskRepo.update(simpleTask.id, { status: TaskStatus.READY });
    });
  });

  describe('SSOT: Parallel Execution', () => {
    it('should allow parent hollon to take new tasks while subtasks execute', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const hollonRepo = dataSource.getRepository(Hollon);

      // Reset tasks to READY state
      await taskRepo.update(complexTask.id, { status: TaskStatus.READY });
      await taskRepo.update(simpleTask.id, { status: TaskStatus.READY });

      // Clear any subtasks from previous tests
      await taskRepo.delete({ parentTaskId: complexTask.id });

      // Mock brain provider
      jest.spyOn(brainProvider, 'executeWithTracking').mockResolvedValue({
        output: JSON.stringify({
          subtasks: [
            {
              title: 'Parallel Subtask A',
              description: 'First',
              type: 'implementation',
              roleId: plannerRole.id,
              dependencies: [],
              priority: 'P1',
            },
          ],
          reasoning: 'Parallel test',
        }),
        success: true,
        duration: 100,
        cost: { inputTokens: 100, outputTokens: 50, totalCostCents: 1 },
      } as unknown);

      // Turn 1: Delegate complex task
      await orchestrator.runCycle(parentHollon.id);

      // Verify parent hollon is IDLE (can take new tasks)
      const hollon = await hollonRepo.findOne({
        where: { id: parentHollon.id },
      });
      expect(hollon!.status).toBe(HollonStatus.IDLE);

      // Verify complex task is IN_PROGRESS
      let task1 = await taskRepo.findOne({ where: { id: complexTask.id } });
      expect(task1!.status).toBe(TaskStatus.IN_PROGRESS);

      // Turn 2: Parent hollon can pull simpleTask (parallel execution)
      const pull2 = await taskPool.pullNextTask(parentHollon.id);
      expect(pull2.task).toBeDefined();
      expect(pull2.task!.id).toBe(simpleTask.id);
      expect(pull2.reason).toContain('Directly assigned');

      // Clean up
      await taskRepo.delete({ parentTaskId: complexTask.id });
      await taskRepo.update(complexTask.id, { status: TaskStatus.READY });
      await taskRepo.update(simpleTask.id, { status: TaskStatus.READY });
    });
  });

  describe('SSOT: Subtask Completion Updates Parent', () => {
    it('should update parent task to COMPLETED when all subtasks complete', async () => {
      const taskRepo = dataSource.getRepository(Task);

      // Setup: Create parent task with subtasks
      const parentTask = await taskRepo.save({
        title: 'Parent Task',
        description: 'Test parent',
        organizationId: organization.id,
        projectId: project.id,
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.IN_PROGRESS,
        assignedHollonId: parentHollon.id,
        depth: 0,
      });

      await taskRepo.save({
        title: 'Subtask 1',
        description: 'First',
        organizationId: organization.id,
        projectId: project.id,
        parentTaskId: parentTask.id,
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.COMPLETED,
        depth: 1,
      });

      const subtask2 = await taskRepo.save({
        title: 'Subtask 2',
        description: 'Second',
        organizationId: organization.id,
        projectId: project.id,
        parentTaskId: parentTask.id,
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.IN_PROGRESS,
        depth: 1,
      });

      // Complete the last subtask
      await taskRepo.update(subtask2.id, {
        status: TaskStatus.COMPLETED,
      });

      // Trigger parent task status update
      await subtaskService.updateParentTaskStatus(parentTask.id);

      // Verify parent task is now COMPLETED
      const updatedParent = await taskRepo.findOne({
        where: { id: parentTask.id },
      });
      expect(updatedParent!.status).toBe(TaskStatus.COMPLETED);
    });
  });

  describe('SSOT: State Consistency', () => {
    it('should maintain consistent state across Task and Hollon entities', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const hollonRepo = dataSource.getRepository(Hollon);

      // Verify Task entity is SSOT for task state
      const task = await taskRepo.findOne({ where: { id: complexTask.id } });
      expect(task).toBeDefined();
      expect(task!.status).toBeDefined();

      // Verify Hollon entity is SSOT for hollon state (independent)
      const hollon = await hollonRepo.findOne({
        where: { id: parentHollon.id },
      });
      expect(hollon).toBeDefined();
      expect(hollon!.status).toBeDefined();

      // States are independent:
      // - Task can be IN_PROGRESS while Hollon is IDLE (parallel execution)
      // - Task can be READY while Hollon is WORKING (hollon working on other task)
      // This is SSOT principle: each entity owns its own state
    });
  });
});
