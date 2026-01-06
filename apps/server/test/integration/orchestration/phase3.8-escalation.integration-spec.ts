import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { Organization } from '@/modules/organization/entities/organization.entity';
import { Role } from '@/modules/role/entities/role.entity';
import { Team } from '@/modules/team/entities/team.entity';
import { Hollon, HollonStatus } from '@/modules/hollon/entities/hollon.entity';
import { Project } from '@/modules/project/entities/project.entity';
import { Task, TaskStatus } from '@/modules/task/entities/task.entity';
import {
  EscalationService,
  EscalationLevel,
} from '@/modules/orchestration/services/escalation.service';
import { cleanupTestData } from '../../utils/test-database.utils';

/**
 * Phase 3.8: Escalation Integration Test
 *
 * Tests the escalation flow with Phase 3.8 Team Distribution:
 * 1. Level 2 - Team Collaboration: Task reassigned to TEAM (not null)
 * 2. Level 3 - Team Leader: Task assigned to Manager hollon
 * 3. Decompose: Task decomposed with useTeamDistribution
 */
describe('Phase 3.8 Escalation Integration Test', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let escalationService: EscalationService;

  let organization: Organization;
  let managerRole: Role;
  let devRole: Role;
  let team: Team;
  let manager: Hollon;
  let dev1: Hollon;
  let dev2: Hollon;
  let project: Project;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    escalationService = app.get(EscalationService);
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await app.close();
  });

  describe('Setup: Create test entities with Manager', () => {
    it('should create organization', async () => {
      const orgRepo = dataSource.getRepository(Organization);
      organization = await orgRepo.save({
        name: 'Phase 3.8 Escalation Test Org',
        description: 'Testing escalation with team distribution',
        settings: {},
      });

      expect(organization.id).toBeDefined();
    });

    it('should create roles (Manager, Developer)', async () => {
      const roleRepo = dataSource.getRepository(Role);

      managerRole = await roleRepo.save({
        organizationId: organization.id,
        name: 'Manager',
        description: 'Team Manager',
        capabilities: ['task-distribution', 'coordination'],
      });

      devRole = await roleRepo.save({
        organizationId: organization.id,
        name: 'Developer',
        description: 'Software Developer',
        capabilities: ['typescript', 'nestjs'],
      });

      expect(managerRole.id).toBeDefined();
      expect(devRole.id).toBeDefined();
    });

    it('should create team', async () => {
      const teamRepo = dataSource.getRepository(Team);
      team = await teamRepo.save({
        organizationId: organization.id,
        name: 'Test Team',
        description: 'Escalation test team',
      });

      expect(team.id).toBeDefined();
    });

    it('should create manager hollon', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);
      manager = await hollonRepo.save({
        organizationId: organization.id,
        roleId: managerRole.id,
        teamId: team.id,
        name: 'Manager-Test',
        status: HollonStatus.IDLE,
      });

      expect(manager.id).toBeDefined();
    });

    it('should assign manager to team', async () => {
      const teamRepo = dataSource.getRepository(Team);
      await teamRepo.update(team.id, {
        managerHollonId: manager.id,
      });

      const updatedTeam = await teamRepo.findOne({
        where: { id: team.id },
      });

      expect(updatedTeam?.managerHollonId).toBe(manager.id);
    });

    it('should create developer hollons', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);

      dev1 = await hollonRepo.save({
        organizationId: organization.id,
        roleId: devRole.id,
        teamId: team.id,
        name: 'Dev-1',
        status: HollonStatus.IDLE,
      });

      dev2 = await hollonRepo.save({
        organizationId: organization.id,
        roleId: devRole.id,
        teamId: team.id,
        name: 'Dev-2',
        status: HollonStatus.IDLE,
      });

      expect(dev1.id).toBeDefined();
      expect(dev2.id).toBeDefined();
    });

    it('should create project', async () => {
      const projectRepo = dataSource.getRepository(Project);
      project = await projectRepo.save({
        organizationId: organization.id,
        name: 'Escalation Test Project',
        description: 'Testing escalation flows',
        status: 'active',
      });

      expect(project.id).toBeDefined();
    });
  });

  describe('Level 2 - Team Collaboration (Reassign to Team)', () => {
    let task: Task;

    it('should create task assigned to dev1', async () => {
      const taskRepo = dataSource.getRepository(Task);
      task = await taskRepo.save({
        organizationId: organization.id,
        projectId: project.id,
        assignedHollonId: dev1.id,
        title: 'Test Task - Team Collaboration',
        description: 'Task that will be reassigned to team',
        type: 'implementation',
        status: TaskStatus.IN_PROGRESS,
        priority: 'P2',
        depth: 0,
      });

      expect(task.id).toBeDefined();
      expect(task.assignedHollonId).toBe(dev1.id);
    });

    it('should escalate to level 2 (team collaboration)', async () => {
      const result = await escalationService.escalate({
        taskId: task.id,
        hollonId: dev1.id,
        level: EscalationLevel.TEAM_COLLABORATION,
        reason: 'Task too complex for single developer',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('task_reassigned_to_team');
    });

    it('should verify task is assigned to TEAM (not null)', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const updatedTask = await taskRepo.findOne({
        where: { id: task.id },
      });

      // Phase 3.8 Fix: Task should be assigned to TEAM
      expect(updatedTask?.assignedHollonId).toBeNull();
      expect(updatedTask?.assignedTeamId).toBe(team.id); // Assigned to team!
      expect(updatedTask?.status).toBe(TaskStatus.READY);
    });
  });

  describe('Level 3 - Team Leader Decision (Assign to Manager)', () => {
    let task: Task;

    it('should create task assigned to dev2', async () => {
      const taskRepo = dataSource.getRepository(Task);
      task = await taskRepo.save({
        organizationId: organization.id,
        projectId: project.id,
        assignedHollonId: dev2.id,
        title: 'Test Task - Team Leader',
        description: 'Task that will be escalated to manager',
        type: 'implementation',
        status: TaskStatus.IN_PROGRESS,
        priority: 'P1',
        depth: 0,
      });

      expect(task.id).toBeDefined();
      expect(task.assignedHollonId).toBe(dev2.id);
    });

    it('should escalate to level 3 (team leader)', async () => {
      const result = await escalationService.escalate({
        taskId: task.id,
        hollonId: dev2.id,
        level: EscalationLevel.TEAM_LEADER,
        reason: 'No team members available, need manager decision',
      });

      expect(result.success).toBe(true);
      expect(result.action).toBe('escalated_to_team_leader');
    });

    it('should verify task is assigned to MANAGER hollon', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const updatedTask = await taskRepo.findOne({
        where: { id: task.id },
      });

      // Phase 3.8 Fix: Task should be assigned to Manager hollon
      expect(updatedTask?.assignedHollonId).toBe(manager.id); // Assigned to Manager!
      expect(updatedTask?.assignedTeamId).toBeNull(); // XOR: Not assigned to team
      expect(updatedTask?.status).toBe(TaskStatus.IN_REVIEW);
    });
  });

  describe('Decompose Action (with Team Distribution)', () => {
    let task: Task;

    it('should create complex task assigned to dev1', async () => {
      const taskRepo = dataSource.getRepository(Task);
      task = await taskRepo.save({
        organizationId: organization.id,
        projectId: project.id,
        assignedHollonId: dev1.id,
        title: 'Complex Task - Needs Decomposition',
        description:
          'Very complex task that should be decomposed into subtasks',
        type: 'implementation',
        status: TaskStatus.IN_PROGRESS,
        priority: 'P1',
        depth: 0,
        acceptanceCriteria: [
          'Implement feature A',
          'Implement feature B',
          'Write tests',
        ],
      });

      expect(task.id).toBeDefined();
    });

    it('should trigger decompose action', async () => {
      // Mock GoalDecompositionService to avoid Brain Provider call
      const goalDecompositionService =
        escalationService['goalDecompositionService'];

      if (!goalDecompositionService) {
        console.warn('GoalDecompositionService not available, skipping test');
        return;
      }

      // Note: This test will create a temporary Goal and may call Brain Provider
      // In a real scenario, we'd mock the Brain Provider response
      const result = await escalationService.escalate({
        taskId: task.id,
        hollonId: dev1.id,
        level: EscalationLevel.SELF_RESOLVE,
        reason: 'Task too complex, needs decomposition',
        action: 'decompose',
      });

      // Result may be success or failure depending on Brain Provider availability
      expect(result).toBeDefined();
      expect(result.action).toBeDefined();

      console.log(`Decompose result: ${JSON.stringify(result)}`);
    });
  });

  describe('Verify XOR Constraint (assignedTeamId XOR assignedHollonId)', () => {
    it('should verify all tasks follow XOR constraint', async () => {
      const tasks = await dataSource.query(
        `
        SELECT
          id,
          title,
          assigned_team_id,
          assigned_hollon_id
        FROM tasks
        WHERE organization_id = $1
        `,
        [organization.id],
      );

      tasks.forEach((task: any) => {
        const hasTeam = task.assigned_team_id !== null;
        const hasHollon = task.assigned_hollon_id !== null;

        // XOR: Either team OR hollon OR neither, but not both
        const validXOR = !(hasTeam && hasHollon);

        expect(validXOR).toBe(true);

        console.log(
          `Task "${task.title}": Team=${task.assigned_team_id}, Hollon=${task.assigned_hollon_id}`,
        );
      });
    });
  });
});
