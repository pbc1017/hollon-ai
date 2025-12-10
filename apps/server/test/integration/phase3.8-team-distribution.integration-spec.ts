import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GoalDecompositionService } from '../../src/modules/goal/services/goal-decomposition.service';
import { TeamTaskDistributionService } from '../../src/modules/orchestration/services/team-task-distribution.service';
import { Goal } from '../../src/modules/goal/entities/goal.entity';
import {
  Task,
  TaskStatus,
  TaskType,
} from '../../src/modules/task/entities/task.entity';
import { Team } from '../../src/modules/team/entities/team.entity';
import {
  Hollon,
  HollonStatus,
} from '../../src/modules/hollon/entities/hollon.entity';
import { Role } from '../../src/modules/role/entities/role.entity';
import { Organization } from '../../src/modules/organization/entities/organization.entity';
import { Project } from '../../src/modules/project/entities/project.entity';
import { BrainProviderModule } from '../../src/modules/brain-provider/brain-provider.module';
import { BrainProviderService } from '../../src/modules/brain-provider/brain-provider.service';
import { SubtaskCreationService } from '../../src/modules/orchestration/services/subtask-creation.service';
import { GoalService } from '../../src/modules/goal/goal.service';
import { ResourcePlannerService } from '../../src/modules/task/services/resource-planner.service';

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
  let module: TestingModule;
  let goalDecompositionService: GoalDecompositionService;
  let teamTaskDistributionService: TeamTaskDistributionService;
  let brainProvider: BrainProviderService;
  let dataSource: DataSource;

  let organization: Organization;
  let team: Team;
  let managerRole: Role;
  let devRole: Role;
  let manager: Hollon;
  let dev1: Hollon;
  let dev2: Hollon;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST || 'localhost',
          port: parseInt(process.env.DB_PORT || '5432'),
          username: process.env.DB_USERNAME || 'hollon_dev',
          password: process.env.DB_PASSWORD || 'hollon_dev_password',
          database: process.env.DB_DATABASE || 'hollon_dev',
          schema: process.env.DB_SCHEMA || 'hollon_test_worker_1',
          entities: [Goal, Task, Team, Hollon, Role, Organization, Project],
          synchronize: false,
          logging: false,
        }),
        TypeOrmModule.forFeature([
          Goal,
          Task,
          Team,
          Hollon,
          Role,
          Organization,
          Project,
        ]),
        BrainProviderModule,
      ],
      providers: [
        GoalDecompositionService,
        TeamTaskDistributionService,
        SubtaskCreationService,
        // Add missing dependencies
        {
          provide: GoalService,
          useValue: {
            // Mock GoalService - not needed for this test
          },
        },
        {
          provide: ResourcePlannerService,
          useValue: {
            // Mock ResourcePlannerService - not needed for this test
          },
        },
      ],
    }).compile();

    goalDecompositionService = module.get<GoalDecompositionService>(
      GoalDecompositionService,
    );
    teamTaskDistributionService = module.get<TeamTaskDistributionService>(
      TeamTaskDistributionService,
    );
    brainProvider = module.get<BrainProviderService>(BrainProviderService);
    dataSource = module.get<DataSource>(DataSource);

    // Clean up
    await dataSource.query('TRUNCATE tasks CASCADE');
    await dataSource.query('TRUNCATE hollons CASCADE');
    await dataSource.query('TRUNCATE teams CASCADE');
    await dataSource.query('TRUNCATE roles CASCADE');
    await dataSource.query('TRUNCATE organizations CASCADE');
    await dataSource.query('TRUNCATE goals CASCADE');
    await dataSource.query('TRUNCATE projects CASCADE');
  });

  afterAll(async () => {
    await dataSource.query('TRUNCATE tasks CASCADE');
    await dataSource.query('TRUNCATE hollons CASCADE');
    await dataSource.query('TRUNCATE teams CASCADE');
    await dataSource.query('TRUNCATE roles CASCADE');
    await dataSource.query('TRUNCATE organizations CASCADE');
    await dataSource.query('TRUNCATE goals CASCADE');
    await dataSource.query('TRUNCATE projects CASCADE');

    await module.close();
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

    it('Step 2: Mock Brain Provider for Goal Decomposition', () => {
      // Mock Goal Decomposition response (Team Tasks)
      jest.spyOn(brainProvider, 'executeWithTracking').mockResolvedValueOnce({
        output: JSON.stringify({
          projects: [
            {
              name: 'Phase 3.8 Test Project',
              description: 'Team distribution test',
              tasks: [
                {
                  title: 'Implement Service A',
                  description: 'Backend service implementation',
                  type: 'implementation',
                  priority: 'P1',
                  estimatedComplexity: 'medium',
                  requiredSkills: ['typescript', 'nestjs'],
                },
                {
                  title: 'Implement Service B',
                  description: 'Data processing service',
                  type: 'implementation',
                  priority: 'P2',
                  estimatedComplexity: 'high',
                  requiredSkills: ['backend', 'database'],
                },
              ],
            },
          ],
          reasoning: 'Test decomposition',
        }),
        success: true,
        duration: 1000,
        cost: {
          inputTokens: 100,
          outputTokens: 200,
          totalCostCents: 1,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);
    });

    it('Step 3: Goal Decomposition with useTeamDistribution', async () => {
      const goalRepo = dataSource.getRepository(Goal);

      // Create Goal
      const goal = await goalRepo.save({
        organizationId: organization.id,
        title: 'Phase 3.8 Test Goal',
        description: 'Test team-based distribution',
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        goalType: 'project' as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        priority: 'high' as any,
        targetDate: new Date('2025-12-31'),
      });

      // Decompose with useTeamDistribution

      const result = await goalDecompositionService.decomposeGoal(goal.id, {
        maxTasks: 10,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        preferredComplexity: 'medium' as any,
        useTeamDistribution: true, // Phase 3.8!
      });

      expect(result.success).toBe(true);
      expect(result.projects.length).toBe(1);
      expect(result.tasks.length).toBeGreaterThan(0);

      // Verify Team Tasks created
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
