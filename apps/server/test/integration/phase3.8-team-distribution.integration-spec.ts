import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { TeamTaskDistributionService } from '@/modules/orchestration/services/team-task-distribution.service';
import { BrainProviderService } from '@/modules/brain-provider/brain-provider.service';
import {
  Task,
  TaskStatus,
  TaskType,
} from '@/modules/task/entities/task.entity';
import { Team } from '@/modules/team/entities/team.entity';
import { Hollon, HollonStatus } from '@/modules/hollon/entities/hollon.entity';
import { Role } from '@/modules/role/entities/role.entity';
import { Organization } from '@/modules/organization/entities/organization.entity';
import { cleanupTestData } from '../utils/test-database.utils';

/**
 * Phase 3.8: Team Distribution Integration Test
 *
 * Tests the complete flow:
 * 1. Goal Decomposition with useTeamDistribution
 * 2. Team Task creation (Level 0)
 * 3. TeamTaskDistribution service
 * 4. Manager-driven distribution (Level 0 → Level 1)
 */
describe('Phase 3.8 Team Distribution Integration Test', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let teamTaskDistributionService: TeamTaskDistributionService;
  let brainProvider: BrainProviderService;

  let organization: Organization;
  let team: Team;
  let managerRole: Role;
  let devRole: Role;
  let manager: Hollon;
  let dev1: Hollon;
  let dev2: Hollon;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    teamTaskDistributionService = app.get(TeamTaskDistributionService);
    brainProvider = app.get(BrainProviderService);
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await app.close();
  });

  describe('Complete Team Distribution Flow', () => {
    it('Step 1: Setup test data (Manager + Team + Members)', async () => {
      const orgRepo = dataSource.getRepository(Organization);
      const teamRepo = dataSource.getRepository(Team);
      const roleRepo = dataSource.getRepository(Role);
      const hollonRepo = dataSource.getRepository(Hollon);

      // Create Organization
      organization = await orgRepo.save({
        name: 'Test Org',
        description: 'Phase 3.8 Integration Test',
        settings: {},
      });

      // Create Roles
      managerRole = await roleRepo.save({
        name: 'Manager',
        description: 'Team Manager',
        organizationId: organization.id,
        capabilities: ['task-distribution', 'coordination'],
      });

      devRole = await roleRepo.save({
        name: 'Developer',
        description: 'Backend Developer',
        organizationId: organization.id,
        capabilities: ['typescript', 'nestjs', 'backend'],
      });

      // Create Team
      team = await teamRepo.save({
        name: 'Test Team',
        description: 'Integration test team',
        organizationId: organization.id,
      });

      // Create Manager
      manager = await hollonRepo.save({
        name: 'Manager-Test',
        organizationId: organization.id,
        teamId: team.id,
        roleId: managerRole.id,
        status: HollonStatus.IDLE,
      });

      // Assign Manager to Team
      await teamRepo.update(team.id, { managerHollonId: manager.id });

      // Create Developers
      dev1 = await hollonRepo.save({
        name: 'Dev-1',
        organizationId: organization.id,
        teamId: team.id,
        roleId: devRole.id,
        status: HollonStatus.IDLE,
      });

      dev2 = await hollonRepo.save({
        name: 'Dev-2',
        organizationId: organization.id,
        teamId: team.id,
        roleId: devRole.id,
        status: HollonStatus.IDLE,
      });

      expect(organization.id).toBeDefined();
      expect(team.id).toBeDefined();
      expect(manager.id).toBeDefined();
      expect(dev1.id).toBeDefined();
      expect(dev2.id).toBeDefined();
    });

    it('Step 2: Create Team Tasks manually (skip Goal Decomposition)', async () => {
      // Create Project manually
      const projectRepo = dataSource.getRepository('Project');
      const project = await projectRepo.save({
        name: 'Phase 3.8 Test Project',
        description: 'Team distribution test',
        organizationId: organization.id,
        status: 'active',
      });

      // Create Team Task (Level 0) manually
      const taskRepo = dataSource.getRepository(Task);
      const teamTask = await taskRepo.save({
        title: 'Knowledge System Implementation',
        description: 'Build knowledge extraction and learning capabilities',
        type: TaskType.TEAM_EPIC,
        status: TaskStatus.PENDING,
        priority: 'P1',
        organizationId: organization.id,
        projectId: project.id,
        assignedTeamId: team.id,
        assignedHollonId: null,
        depth: 0,
        requiredSkills: ['ai', 'ml', 'typescript'],
        acceptanceCriteria: [
          'KnowledgeExtraction service implemented',
          'VectorSearch service implemented',
          'Integration tests passing',
        ],
      });

      expect(teamTask.id).toBeDefined();
      expect(teamTask.assignedTeamId).toBe(team.id);
      expect(teamTask.depth).toBe(0);
    });

    it('Step 3: Verify Team Task created', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const teamTasks = await taskRepo.find({
        where: { type: TaskType.TEAM_EPIC },
      });

      expect(teamTasks.length).toBeGreaterThan(0);
      teamTasks.forEach((task) => {
        expect(task.assignedTeamId).toBe(team.id);
        expect(task.assignedHollonId).toBeNull();
        expect(task.depth).toBe(0); // Level 0
      });
    });

    it('Step 4: Mock Brain Provider for Manager Distribution', () => {
      // Mock Manager Distribution response
      jest.spyOn(brainProvider, 'executeWithTracking').mockResolvedValueOnce({
        output: JSON.stringify({
          subtasks: [
            {
              title: 'Backend Implementation',
              description: 'Service A implementation',
              assignedTo: 'Dev-1',
              type: 'implementation',
              priority: 'P1',
              estimatedComplexity: 'medium',
              dependencies: [],
            },
            {
              title: 'Data Processing',
              description: 'Service B implementation',
              assignedTo: 'Dev-2',
              type: 'implementation',
              priority: 'P2',
              estimatedComplexity: 'high',
              dependencies: ['Backend Implementation'],
            },
          ],
          reasoning: 'Distributed based on skills',
        }),
        success: true,
        duration: 1500,
        cost: {
          inputTokens: 300,
          outputTokens: 200,
          totalCostCents: 2,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    });

    it('Step 5: TeamTaskDistributionService distributes Team Tasks', async () => {
      // Get Team Tasks
      const taskRepo = dataSource.getRepository(Task);
      const teamTasks = await taskRepo.find({
        where: { type: TaskType.TEAM_EPIC },
      });

      expect(teamTasks.length).toBeGreaterThan(0);

      // Trigger distribution for the first Team Task
      await teamTaskDistributionService.distributeToTeam(teamTasks[0].id);

      // Verify Hollon Tasks created
      const hollonTasks = await taskRepo.find({
        where: { depth: 1 },
        relations: ['assignedHollon', 'parentTask'],
      });

      expect(hollonTasks.length).toBeGreaterThan(0);

      hollonTasks.forEach((task) => {
        expect(task.assignedHollonId).toBeDefined();
        expect(task.assignedTeamId).toBeNull();
        expect(task.depth).toBe(1); // Level 1
        expect(task.parentTask).toBeDefined();
        expect(task.parentTask?.type).toBe(TaskType.TEAM_EPIC);
      });

      // Verify Team Task status updated
      const updatedTeamTasks = await taskRepo.find({
        where: { type: TaskType.TEAM_EPIC },
      });

      updatedTeamTasks.forEach((task) => {
        expect(task.status).toBe(TaskStatus.IN_PROGRESS);
      });

      console.log('\n✅ Team Distribution Flow Complete!');
      console.log(`   Level 0 (Team Tasks): ${updatedTeamTasks.length}`);
      console.log(`   Level 1 (Hollon Tasks): ${hollonTasks.length}`);
    });

    it('Step 6: Verify hierarchical structure', async () => {
      const taskRepo = dataSource.getRepository(Task);

      const allTasks = await taskRepo.find({
        where: { organizationId: organization.id },
        order: { depth: 'ASC' },
      });

      const level0 = allTasks.filter((t) => t.depth === 0);
      const level1 = allTasks.filter((t) => t.depth === 1);

      // Verify Level 0 (Team Tasks)
      level0.forEach((task) => {
        expect(task.type).toBe(TaskType.TEAM_EPIC);
        expect(task.assignedTeamId).toBe(team.id);
        expect(task.assignedHollonId).toBeNull();
      });

      // Verify Level 1 (Hollon Tasks)
      level1.forEach((task) => {
        expect(task.assignedHollonId).toBeDefined();
        expect(task.assignedTeamId).toBeNull();
        expect([dev1.id, dev2.id]).toContain(task.assignedHollonId);
      });

      console.log('\n✅ Hierarchical Structure Verified!');
    });
  });
});
