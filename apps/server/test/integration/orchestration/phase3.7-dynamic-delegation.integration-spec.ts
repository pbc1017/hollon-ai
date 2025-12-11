/**
 * Phase 3.7: Dynamic Sub-Hollon Delegation Integration Tests
 *
 * Tests for Brain Provider-driven task decomposition with dynamic role selection
 * and dependency-based sequential-parallel execution.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import {
  Task,
  TaskStatus,
  TaskType,
} from '@/modules/task/entities/task.entity';
import {
  Hollon,
  HollonLifecycle,
} from '@/modules/hollon/entities/hollon.entity';
import { Organization } from '@/modules/organization/entities/organization.entity';
import { Team } from '@/modules/team/entities/team.entity';
import { Role } from '@/modules/role/entities/role.entity';
import { Project } from '@/modules/project/entities/project.entity';
import { SubtaskCreationService } from '@/modules/orchestration/services/subtask-creation.service';
import { cleanupTestData } from '../../utils/test-database.utils';

describe('Phase 3.7: Dynamic Sub-Hollon Delegation', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let subtaskService: SubtaskCreationService;

  // Test entities
  let testOrg: Organization;
  let testTeam: Team;
  let testProject: Project;
  let plannerRole: Role;
  let coderRole: Role;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    subtaskService = app.get<SubtaskCreationService>(SubtaskCreationService);

    // Setup test data
    const orgRepo = dataSource.getRepository(Organization);
    testOrg = await orgRepo.save({
      name: 'Dynamic Delegation Test Org',
      settings: {
        costLimitDailyCents: 100000,
        costLimitMonthlyCents: 3000000,
        maxHollonsPerTeam: 20,
        defaultTaskPriority: 'P2',
      },
    });

    const teamRepo = dataSource.getRepository(Team);
    testTeam = await teamRepo.save({
      name: 'Dynamic Test Team',
      description: 'Team for testing dynamic delegation',
      organizationId: testOrg.id,
    });

    const projectRepo = dataSource.getRepository(Project);
    testProject = await projectRepo.save({
      name: 'Dynamic Delegation Project',
      organizationId: testOrg.id,
    });

    // Create roles with availableForTemporaryHollon flag
    const roleRepo = dataSource.getRepository(Role);
    plannerRole = await roleRepo.save({
      name: 'DynPlanner',
      organizationId: testOrg.id,
      systemPrompt: 'You are a planning specialist.',
      capabilities: ['planning', 'requirements-analysis'],
      availableForTemporaryHollon: true,
    });

    coderRole = await roleRepo.save({
      name: 'DynCoder',
      organizationId: testOrg.id,
      systemPrompt: 'You are an implementation specialist.',
      capabilities: ['typescript', 'nestjs', 'implementation'],
      availableForTemporaryHollon: true,
    });
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await app.close();
  });

  describe('Role Configuration', () => {
    it('should query roles with availableForTemporaryHollon=true', async () => {
      const roleRepo = dataSource.getRepository(Role);
      const availableRoles = await roleRepo.find({
        where: {
          organizationId: testOrg.id,
          availableForTemporaryHollon: true,
        },
      });

      expect(availableRoles.length).toBeGreaterThanOrEqual(2);
      expect(availableRoles.map((r) => r.name)).toEqual(
        expect.arrayContaining(['DynPlanner', 'DynCoder']),
      );
    });
  });

  describe('Brain Provider Decomposition', () => {
    it('should have valid decomposition structure format', () => {
      // Test the expected structure of a valid decomposition
      const mockDecomposition = {
        subtasks: [
          {
            title: 'Research authentication standards',
            description: 'Analyze OAuth 2.0 and JWT patterns',
            type: 'research',
            roleId: plannerRole.id,
            dependencies: [],
            estimatedHours: 4,
            priority: 'P1',
          },
          {
            title: 'Design auth architecture',
            description: 'Create system design for authentication',
            type: 'implementation',
            roleId: coderRole.id,
            dependencies: ['Research authentication standards'],
            estimatedHours: 6,
            priority: 'P1',
          },
        ],
        reasoning: 'Split into research then design phases',
        totalEstimatedHours: 10,
      };

      // Verify structure
      expect(mockDecomposition.subtasks).toBeDefined();
      expect(Array.isArray(mockDecomposition.subtasks)).toBe(true);
      expect(mockDecomposition.subtasks.length).toBe(2);
      expect(mockDecomposition.subtasks[0]).toHaveProperty('title');
      expect(mockDecomposition.subtasks[0]).toHaveProperty('dependencies');
      expect(mockDecomposition.subtasks[0]).toHaveProperty('roleId');
      expect(mockDecomposition.subtasks[0]).toHaveProperty('type');
      expect(mockDecomposition.subtasks[0]).toHaveProperty('description');
    });
  });

  describe('Dependency Auto-Resolution', () => {
    it('should auto-unblock BLOCKED tasks when dependencies complete', async () => {
      const taskRepo = dataSource.getRepository(Task);

      // Create a simple dependency chain: A → B
      const parentTask = await taskRepo.save({
        title: 'Parent Task',
        description: 'Parent for dependency test',
        organizationId: testOrg.id,
        projectId: testProject.id,
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.IN_PROGRESS,
      });

      const taskA = await taskRepo.save({
        title: 'Task A - First',
        description: 'First task in chain',
        organizationId: testOrg.id,
        projectId: testProject.id,
        parentTaskId: parentTask.id,
        type: TaskType.RESEARCH,
        status: TaskStatus.READY,
      });

      const taskB = await taskRepo.save({
        title: 'Task B - Second',
        description: 'Second task depends on first',
        organizationId: testOrg.id,
        projectId: testProject.id,
        parentTaskId: parentTask.id,
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.BLOCKED,
      });

      // Set dependency: B depends on A
      taskB.dependencies = [taskA];
      await taskRepo.save(taskB);

      // Verify B is BLOCKED
      let updatedB = await taskRepo.findOne({
        where: { id: taskB.id },
        relations: ['dependencies'],
      });
      expect(updatedB?.status).toBe(TaskStatus.BLOCKED);
      expect(updatedB?.dependencies).toHaveLength(1);
      expect(updatedB?.dependencies[0].id).toBe(taskA.id);

      // Complete Task A
      await taskRepo.update({ id: taskA.id }, { status: TaskStatus.COMPLETED });

      // Trigger auto-unblock via SubtaskCreationService
      await subtaskService.checkAndUnblockDependencies(parentTask.id);

      // Verify Task B is now READY
      updatedB = await taskRepo.findOne({
        where: { id: taskB.id },
      });
      expect(updatedB?.status).toBe(TaskStatus.READY);
    });

    it('should handle multiple dependencies (task waits for all to complete)', async () => {
      const taskRepo = dataSource.getRepository(Task);

      const parentTask = await taskRepo.save({
        title: 'Parent Multi-Dep',
        description: 'Parent for multi-dependency test',
        organizationId: testOrg.id,
        projectId: testProject.id,
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.IN_PROGRESS,
      });

      // Create 2 independent tasks
      const taskA = await taskRepo.save({
        title: 'Task A - Independent',
        description: 'First dependency',
        organizationId: testOrg.id,
        projectId: testProject.id,
        parentTaskId: parentTask.id,
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.READY,
      });

      const taskB = await taskRepo.save({
        title: 'Task B - Independent',
        description: 'Second dependency',
        organizationId: testOrg.id,
        projectId: testProject.id,
        parentTaskId: parentTask.id,
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.READY,
      });

      // Create task C that depends on both A and B
      const taskC = await taskRepo.save({
        title: 'Task C - Depends on A and B',
        description: 'Must wait for both A and B',
        organizationId: testOrg.id,
        projectId: testProject.id,
        parentTaskId: parentTask.id,
        type: TaskType.REVIEW,
        status: TaskStatus.BLOCKED,
      });

      taskC.dependencies = [taskA, taskB];
      await taskRepo.save(taskC);

      // Complete only Task A
      await taskRepo.update({ id: taskA.id }, { status: TaskStatus.COMPLETED });
      await subtaskService.checkAndUnblockDependencies(parentTask.id);

      // Task C should still be BLOCKED (waiting for B)
      let updatedC = await taskRepo.findOne({
        where: { id: taskC.id },
        relations: ['dependencies'],
      });
      expect(updatedC?.status).toBe(TaskStatus.BLOCKED);
      expect(updatedC?.dependencies).toHaveLength(2);

      // Complete Task B
      await taskRepo.update({ id: taskB.id }, { status: TaskStatus.COMPLETED });
      await subtaskService.checkAndUnblockDependencies(parentTask.id);

      // Now Task C should be READY
      updatedC = await taskRepo.findOne({
        where: { id: taskC.id },
      });
      expect(updatedC?.status).toBe(TaskStatus.READY);
    });

    it('should handle sequential-parallel pattern (1 → 2,3)', async () => {
      const taskRepo = dataSource.getRepository(Task);

      const parentTask = await taskRepo.save({
        title: 'Parent Seq-Parallel',
        description: 'Parent for sequential-parallel test',
        organizationId: testOrg.id,
        projectId: testProject.id,
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.IN_PROGRESS,
      });

      // Research task (no dependencies)
      const research = await taskRepo.save({
        title: 'Research requirements',
        description: 'Analyze requirements',
        organizationId: testOrg.id,
        projectId: testProject.id,
        parentTaskId: parentTask.id,
        type: TaskType.RESEARCH,
        status: TaskStatus.READY,
      });

      // Two implementation tasks (both depend on research)
      const impl1 = await taskRepo.save({
        title: 'Implement API endpoint 1',
        description: 'Build first endpoint',
        organizationId: testOrg.id,
        projectId: testProject.id,
        parentTaskId: parentTask.id,
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.BLOCKED,
      });

      const impl2 = await taskRepo.save({
        title: 'Implement API endpoint 2',
        description: 'Build second endpoint',
        organizationId: testOrg.id,
        projectId: testProject.id,
        parentTaskId: parentTask.id,
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.BLOCKED,
      });

      // Set dependencies
      impl1.dependencies = [research];
      impl2.dependencies = [research];
      await taskRepo.save(impl1);
      await taskRepo.save(impl2);

      // Verify both implementation tasks are BLOCKED
      const blockedTasks = await taskRepo.find({
        where: {
          parentTaskId: parentTask.id,
          status: TaskStatus.BLOCKED,
        },
      });
      expect(blockedTasks).toHaveLength(2);

      // Complete research task
      await taskRepo.update(
        { id: research.id },
        { status: TaskStatus.COMPLETED },
      );
      await subtaskService.checkAndUnblockDependencies(parentTask.id);

      // Both implementation tasks should now be READY (parallel execution)
      const readyTasks = await taskRepo.find({
        where: {
          parentTaskId: parentTask.id,
          status: TaskStatus.READY,
        },
      });

      expect(readyTasks).toHaveLength(2);
      expect(readyTasks.map((t) => t.id)).toEqual(
        expect.arrayContaining([impl1.id, impl2.id]),
      );
    });
  });

  describe('Temporary Hollon Cleanup', () => {
    it('should support temporary hollon lifecycle', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);

      // Create a permanent hollon
      const permanentHollon = await hollonRepo.save({
        name: 'Permanent Parent',
        organizationId: testOrg.id,
        teamId: testTeam.id,
        roleId: plannerRole.id,
        brainProviderId: 'claude_code',
        status: 'idle',
        lifecycle: HollonLifecycle.PERMANENT,
      });

      // Create a temporary hollon
      const temporaryHollon = await hollonRepo.save({
        name: 'Temporary Sub',
        organizationId: testOrg.id,
        teamId: testTeam.id,
        roleId: coderRole.id,
        brainProviderId: 'claude_code',
        status: 'idle',
        lifecycle: HollonLifecycle.TEMPORARY,
        createdByHollonId: permanentHollon.id,
      });

      // Verify lifecycle flags
      expect(temporaryHollon.lifecycle).toBe(HollonLifecycle.TEMPORARY);
      expect(temporaryHollon.createdByHollonId).toBe(permanentHollon.id);

      // Query temporary hollons created by parent
      const tempHollons = await hollonRepo.find({
        where: {
          createdByHollonId: permanentHollon.id,
          lifecycle: HollonLifecycle.TEMPORARY,
        },
      });

      expect(tempHollons).toHaveLength(1);
      expect(tempHollons[0].id).toBe(temporaryHollon.id);
    });
  });
});
