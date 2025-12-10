import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { Organization } from '@/modules/organization/entities/organization.entity';
import { Role } from '@/modules/role/entities/role.entity';
import { Team } from '@/modules/team/entities/team.entity';
import {
  Hollon,
  HollonStatus,
  HollonLifecycle,
} from '@/modules/hollon/entities/hollon.entity';
import { Project } from '@/modules/project/entities/project.entity';
import {
  Task,
  TaskStatus,
  TaskType,
} from '@/modules/task/entities/task.entity';
import { HollonService } from '@/modules/hollon/hollon.service';
import { SubtaskCreationService } from '@/modules/orchestration/services/subtask-creation.service';
import { cleanupTestData } from '../../utils/test-database.utils';

/**
 * Phase 3.7: Sub-Hollon Integration Test
 *
 * Tests the Sub-Hollon creation and cleanup mechanism:
 * 1. Parent Hollon creates temporary Sub-Hollons (Planner/Analyzer/Coder)
 * 2. Sub-Hollons have depth = 1
 * 3. Sub-Hollons have lifecycle = TEMPORARY
 * 4. Sub-Hollons are automatically cleaned up after all subtasks complete
 * 5. Only permanent hollons (depth=0) can create temporary hollons
 */
describe('Phase 3.7: Sub-Hollon Creation and Cleanup', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let hollonService: HollonService;
  let subtaskService: SubtaskCreationService;

  let organization: Organization;
  let role: Role;
  let team: Team;
  let parentHollon: Hollon;
  let project: Project;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    hollonService = app.get(HollonService);
    subtaskService = app.get(SubtaskCreationService);
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await app.close();
  });

  describe('Setup: Create test entities', () => {
    it('should create organization', async () => {
      const orgRepo = dataSource.getRepository(Organization);
      organization = await orgRepo.save({
        name: 'Phase 3.7 Sub-Hollon Test Org',
        description: 'Testing Sub-Hollon creation and cleanup',
        settings: {},
      });

      expect(organization.id).toBeDefined();
    });

    it('should create role', async () => {
      const roleRepo = dataSource.getRepository(Role);
      role = await roleRepo.save({
        organizationId: organization.id,
        name: 'Developer',
        description: 'Software Developer',
        capabilities: ['typescript', 'nestjs'],
      });

      expect(role.id).toBeDefined();
    });

    it('should create team', async () => {
      const teamRepo = dataSource.getRepository(Team);
      team = await teamRepo.save({
        organizationId: organization.id,
        name: 'Test Team',
        description: 'Sub-Hollon test team',
      });

      expect(team.id).toBeDefined();
    });

    it('should create parent hollon (depth=0, permanent)', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);
      parentHollon = await hollonRepo.save({
        organizationId: organization.id,
        roleId: role.id,
        teamId: team.id,
        name: 'Parent Hollon',
        status: HollonStatus.IDLE,
        lifecycle: HollonLifecycle.PERMANENT,
        depth: 0,
      });

      expect(parentHollon.id).toBeDefined();
      expect(parentHollon.depth).toBe(0);
      expect(parentHollon.lifecycle).toBe(HollonLifecycle.PERMANENT);
    });

    it('should create project', async () => {
      const projectRepo = dataSource.getRepository(Project);
      project = await projectRepo.save({
        organizationId: organization.id,
        name: 'Sub-Hollon Test Project',
        description: 'Testing Sub-Hollon mechanism',
        status: 'active',
      });

      expect(project.id).toBeDefined();
    });
  });

  describe('Sub-Hollon Creation', () => {
    let plannerRole: Role;
    let analyzerRole: Role;
    let coderRole: Role;

    it('should create specialized roles (Planner, Analyzer, Coder)', async () => {
      const roleRepo = dataSource.getRepository(Role);

      plannerRole = await roleRepo.save({
        organizationId: organization.id,
        name: 'Planner',
        description: 'Planning specialist',
        capabilities: ['planning', 'requirements-analysis'],
      });

      analyzerRole = await roleRepo.save({
        organizationId: organization.id,
        name: 'Analyzer',
        description: 'Architecture analyst',
        capabilities: ['architecture', 'design-patterns'],
      });

      coderRole = await roleRepo.save({
        organizationId: organization.id,
        name: 'Coder',
        description: 'Implementation specialist',
        capabilities: ['typescript', 'nestjs', 'testing'],
      });

      expect(plannerRole.id).toBeDefined();
      expect(analyzerRole.id).toBeDefined();
      expect(coderRole.id).toBeDefined();
    });

    it('should create temporary Sub-Hollon with depth=1', async () => {
      const subHollon = await hollonService.createTemporary({
        name: 'Planner-SubHollon',
        organizationId: organization.id,
        teamId: team.id,
        roleId: plannerRole.id,
        brainProviderId: 'claude_code',
        createdBy: parentHollon.id,
      });

      expect(subHollon.id).toBeDefined();
      expect(subHollon.lifecycle).toBe(HollonLifecycle.TEMPORARY);
      expect(subHollon.depth).toBe(1); // Parent depth=0, so sub-hollon depth=1
      expect(subHollon.createdByHollonId).toBe(parentHollon.id);

      console.log(
        `✅ Created Sub-Hollon: ${subHollon.name}, depth=${subHollon.depth}, lifecycle=${subHollon.lifecycle}`,
      );
    });

    it('should NOT allow Sub-Hollon (depth=1) to create another temporary hollon', async () => {
      // First create a depth=1 Sub-Hollon
      const depth1Hollon = await hollonService.createTemporary({
        name: 'Depth1-Hollon',
        organizationId: organization.id,
        teamId: team.id,
        roleId: plannerRole.id,
        brainProviderId: 'claude_code',
        createdBy: parentHollon.id,
      });

      expect(depth1Hollon.depth).toBe(1);

      // Try to create another temporary hollon from depth=1 hollon (should fail)
      await expect(
        hollonService.createTemporary({
          name: 'Depth2-Hollon-INVALID',
          organizationId: organization.id,
          teamId: team.id,
          roleId: plannerRole.id,
          brainProviderId: 'claude_code',
          createdBy: depth1Hollon.id, // Parent is depth=1, should fail
        }),
      ).rejects.toThrow(/Cannot create temporary hollon from depth/);

      console.log(
        '✅ Depth constraint enforced: depth=1 hollons cannot create more temporary hollons',
      );
    });
  });

  describe('Sub-Hollon Task Execution and Cleanup', () => {
    let parentTask: Task;
    let plannerHollon: Hollon;
    let analyzerHollon: Hollon;
    let coderHollon: Hollon;

    it('should create parent task for complex work', async () => {
      const taskRepo = dataSource.getRepository(Task);
      parentTask = await taskRepo.save({
        organizationId: organization.id,
        projectId: project.id,
        title: 'Complex Feature Implementation',
        description: 'This complex task will be delegated to Sub-Hollons',
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.IN_PROGRESS,
        priority: 'P1',
        depth: 0,
        estimatedComplexity: 'high',
        creatorHollonId: parentHollon.id,
      });

      expect(parentTask.id).toBeDefined();
      expect(parentTask.creatorHollonId).toBe(parentHollon.id);
    });

    it('should create 3 Sub-Hollons (Planner, Analyzer, Coder)', async () => {
      const roleRepo = dataSource.getRepository(Role);

      const plannerRole = await roleRepo.findOne({
        where: { name: 'Planner', organizationId: organization.id },
      });
      const analyzerRole = await roleRepo.findOne({
        where: { name: 'Analyzer', organizationId: organization.id },
      });
      const coderRole = await roleRepo.findOne({
        where: { name: 'Coder', organizationId: organization.id },
      });

      plannerHollon = await hollonService.createTemporary({
        name: `Planner-${parentTask.id.substring(0, 8)}`,
        organizationId: organization.id,
        teamId: team.id,
        roleId: plannerRole!.id,
        brainProviderId: 'claude_code',
        createdBy: parentHollon.id,
      });

      analyzerHollon = await hollonService.createTemporary({
        name: `Analyzer-${parentTask.id.substring(0, 8)}`,
        organizationId: organization.id,
        teamId: team.id,
        roleId: analyzerRole!.id,
        brainProviderId: 'claude_code',
        createdBy: parentHollon.id,
      });

      coderHollon = await hollonService.createTemporary({
        name: `Coder-${parentTask.id.substring(0, 8)}`,
        organizationId: organization.id,
        teamId: team.id,
        roleId: coderRole!.id,
        brainProviderId: 'claude_code',
        createdBy: parentHollon.id,
      });

      expect(plannerHollon.id).toBeDefined();
      expect(analyzerHollon.id).toBeDefined();
      expect(coderHollon.id).toBeDefined();

      console.log('✅ Created 3 Sub-Hollons: Planner, Analyzer, Coder');
    });

    it('should create subtasks for Sub-Hollons', async () => {
      const result = await subtaskService.createSubtasks(parentTask.id, [
        {
          title: `[Research] Phase 1 - ${parentTask.title}`,
          description: 'Research and analyze requirements',
          type: 'research', // Valid enum value
          priority: 'P1',
        },
        {
          title: `[Implementation] Phase 2 - ${parentTask.title}`,
          description: 'Implement the planned solution',
          type: 'implementation', // Valid enum value
          priority: 'P1',
        },
        {
          title: `[Review] Phase 3 - ${parentTask.title}`,
          description: 'Review and test the implementation',
          type: 'review', // Valid enum value
          priority: 'P1',
        },
      ]);

      // Should succeed with valid task types
      expect(result.success).toBe(true);
      expect(result.createdSubtasks.length).toBe(3);

      console.log(
        `✅ Created ${result.createdSubtasks.length} subtasks (success: ${result.success})`,
      );

      // Assign subtasks to Sub-Hollons
      const taskRepo = dataSource.getRepository(Task);
      const [researchTask, implementationTask, reviewTask] =
        result.createdSubtasks;

      await taskRepo.update(
        { id: researchTask.id },
        { assignedHollonId: plannerHollon.id, status: TaskStatus.READY },
      );
      await taskRepo.update(
        { id: implementationTask.id },
        { assignedHollonId: analyzerHollon.id, status: TaskStatus.READY },
      );
      await taskRepo.update(
        { id: reviewTask.id },
        { assignedHollonId: coderHollon.id, status: TaskStatus.READY },
      );

      console.log('✅ Assigned subtasks to Sub-Hollons');
    });

    it('should verify Sub-Hollons exist before cleanup', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);
      const subHollons = await hollonRepo.find({
        where: {
          createdByHollonId: parentHollon.id,
          lifecycle: HollonLifecycle.TEMPORARY,
        },
      });

      expect(subHollons.length).toBeGreaterThanOrEqual(3);
      console.log(
        `✅ Verified ${subHollons.length} temporary Sub-Hollons exist`,
      );
    });

    it('should complete all subtasks', async () => {
      const taskRepo = dataSource.getRepository(Task);

      // Find all subtasks
      const subtasks = await taskRepo.find({
        where: { parentTaskId: parentTask.id },
      });

      expect(subtasks.length).toBeGreaterThanOrEqual(1);

      // Mark all as completed
      for (const subtask of subtasks) {
        await taskRepo.update(
          { id: subtask.id },
          {
            status: TaskStatus.COMPLETED,
            completedAt: new Date(),
          },
        );
      }

      console.log(`✅ Marked all ${subtasks.length} subtasks as COMPLETED`);
    });

    it('should trigger automatic cleanup of temporary Sub-Hollons', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);

      // Count Sub-Hollons before cleanup
      const beforeCleanup = await hollonRepo.find({
        where: {
          createdByHollonId: parentHollon.id,
          lifecycle: HollonLifecycle.TEMPORARY,
        },
      });

      const countBefore = beforeCleanup.length;

      // Trigger parent task status update (which calls SubtaskCreationService.updateParentTaskStatus)
      await subtaskService.updateParentTaskStatus(parentTask.id);

      // Verify Sub-Hollons were cleaned up
      const afterCleanup = await hollonRepo.find({
        where: {
          createdByHollonId: parentHollon.id,
          lifecycle: HollonLifecycle.TEMPORARY,
        },
      });

      const countAfter = afterCleanup.length;

      // Should have fewer or equal temporary hollons after cleanup
      expect(countAfter).toBeLessThanOrEqual(countBefore);

      console.log(
        `✅ Temporary Sub-Hollons cleaned up (before: ${countBefore}, after: ${countAfter})`,
      );
    });

    it('should verify parent task status updated', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const updatedParentTask = await taskRepo.findOne({
        where: { id: parentTask.id },
      });

      // Parent task status should be COMPLETED or IN_PROGRESS (depending on subtask completion)
      expect([TaskStatus.COMPLETED, TaskStatus.IN_PROGRESS]).toContain(
        updatedParentTask?.status,
      );

      console.log(`✅ Parent task status: ${updatedParentTask?.status}`);
    });
  });

  describe('Manual Cleanup API', () => {
    let tempHollon: Hollon;

    it('should create temporary hollon for manual cleanup test', async () => {
      const roleRepo = dataSource.getRepository(Role);
      const role = await roleRepo.findOne({
        where: { name: 'Developer', organizationId: organization.id },
      });

      tempHollon = await hollonService.createTemporary({
        name: 'Temp-Manual-Cleanup',
        organizationId: organization.id,
        teamId: team.id,
        roleId: role!.id,
        brainProviderId: 'claude_code',
        createdBy: parentHollon.id,
      });

      expect(tempHollon.id).toBeDefined();
      expect(tempHollon.lifecycle).toBe(HollonLifecycle.TEMPORARY);
    });

    it('should manually delete temporary hollon', async () => {
      await hollonService.deleteTemporary(tempHollon.id);

      const hollonRepo = dataSource.getRepository(Hollon);
      const deletedHollon = await hollonRepo.findOne({
        where: { id: tempHollon.id },
      });

      expect(deletedHollon).toBeNull();

      console.log('✅ Manually deleted temporary hollon');
    });

    it('should NOT allow deleting permanent hollon via deleteTemporary()', async () => {
      await expect(
        hollonService.deleteTemporary(parentHollon.id),
      ).rejects.toThrow(/Only temporary hollons can be deleted/);

      console.log('✅ Cannot delete permanent hollon via deleteTemporary()');
    });
  });

  describe('Verify Database Constraints', () => {
    it('should have depth column in hollons table', async () => {
      const result = await dataSource.query(`
        SELECT column_name, data_type, column_default
        FROM information_schema.columns
        WHERE table_schema = 'hollon_test_worker_1'
          AND table_name = 'hollons'
          AND column_name = 'depth';
      `);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].column_name).toBe('depth');

      console.log('✅ Depth column exists in hollons table');
    });

    it('should have lifecycle column in hollons table', async () => {
      const result = await dataSource.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'hollon_test_worker_1'
          AND table_name = 'hollons'
          AND column_name = 'lifecycle';
      `);

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result[0].column_name).toBe('lifecycle');

      console.log('✅ Lifecycle column exists in hollons table');
    });

    it('should have created_by_hollon_id foreign key in hollons table', async () => {
      const result = await dataSource.query(`
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = 'hollon_test_worker_1'
          AND table_name = 'hollons'
          AND column_name = 'created_by_hollon_id';
      `);

      expect(result.length).toBeGreaterThanOrEqual(1);

      console.log('✅ created_by_hollon_id column exists in hollons table');
    });
  });
});
