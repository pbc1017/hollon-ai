import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { TeamTaskDistributionService } from '@/modules/orchestration/services/team-task-distribution.service';
import {
  Task,
  TaskStatus,
  TaskType,
} from '@/modules/task/entities/task.entity';
import { Team } from '@/modules/team/entities/team.entity';
import { Hollon, HollonStatus } from '@/modules/hollon/entities/hollon.entity';
import { Role } from '@/modules/role/entities/role.entity';
import { Organization } from '@/modules/organization/entities/organization.entity';
import { BrainProviderService } from '@/modules/brain-provider/brain-provider.service';
import { cleanupTestData } from '../utils/test-database.utils';

/**
 * Integration Test for TeamTaskDistributionService
 *
 * Tests hierarchical task distribution with real database
 */
describe('TeamTaskDistributionService Integration Test', () => {
  let app: INestApplication;
  let service: TeamTaskDistributionService;
  let brainProvider: BrainProviderService;
  let dataSource: DataSource;

  let organization: Organization;
  let team: Team;
  let managerRole: Role;
  let devRole: Role;
  let manager: Hollon;
  let dev1: Hollon;
  let dev2: Hollon;
  let teamTask: Task;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    service = app.get(TeamTaskDistributionService);
    brainProvider = app.get(BrainProviderService);
    dataSource = app.get(DataSource);

    // Clean up before tests
    await cleanupTestData(dataSource);
  });

  afterAll(async () => {
    // Clean up after tests
    await cleanupTestData(dataSource);
    await app.close();
  });

  describe('Hierarchical Distribution Flow', () => {
    it('Step 1: Setup test data', async () => {
      const orgRepo = dataSource.getRepository(Organization);
      const teamRepo = dataSource.getRepository(Team);
      const roleRepo = dataSource.getRepository(Role);
      const hollonRepo = dataSource.getRepository(Hollon);
      const taskRepo = dataSource.getRepository(Task);

      // Create Organization
      organization = await orgRepo.save({
        name: 'Test Org',
        description: 'Integration test org',
        settings: {},
      });

      // Create Roles
      managerRole = await roleRepo.save({
        name: 'Manager',
        description: 'Team manager',
        organizationId: organization.id,
        capabilities: ['task-distribution', 'coordination'],
      });

      devRole = await roleRepo.save({
        name: 'Developer',
        description: 'Software developer',
        organizationId: organization.id,
        capabilities: ['typescript', 'nestjs'],
      });

      // Create Team
      team = await teamRepo.save({
        name: 'Knowledge Team',
        description: 'AI/ML team',
        organizationId: organization.id,
      });

      // Create Manager Hollon
      manager = await hollonRepo.save({
        name: 'Manager-AI',
        organizationId: organization.id,
        teamId: team.id,
        roleId: managerRole.id,
        status: HollonStatus.IDLE,
        personality: 'Strategic thinker',
      });

      // Create Developer Hollons
      dev1 = await hollonRepo.save({
        name: 'DevBot-AI',
        organizationId: organization.id,
        teamId: team.id,
        roleId: devRole.id,
        status: HollonStatus.IDLE,
        personality: 'AI specialist',
      });

      dev2 = await hollonRepo.save({
        name: 'DevBot-Data',
        organizationId: organization.id,
        teamId: team.id,
        roleId: devRole.id,
        status: HollonStatus.IDLE,
        personality: 'Data engineer',
      });

      // Assign manager to team
      await teamRepo.update(team.id, { managerHollonId: manager.id });

      // Create Team Task (TEAM_EPIC)
      teamTask = await taskRepo.save({
        title: 'Knowledge System Implementation',
        description: 'Build knowledge extraction and learning capabilities',
        type: TaskType.TEAM_EPIC,
        status: TaskStatus.PENDING,
        priority: 'P1' as any,
        organizationId: organization.id,
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

      expect(organization.id).toBeDefined();
      expect(team.id).toBeDefined();
      expect(manager.id).toBeDefined();
      expect(dev1.id).toBeDefined();
      expect(dev2.id).toBeDefined();
      expect(teamTask.id).toBeDefined();
    });

    it('Step 2: Mock Brain Provider response', () => {
      // Mock the Brain Provider to return a valid distribution plan
      jest.spyOn(brainProvider, 'executeWithTracking').mockResolvedValue({
        output: JSON.stringify({
          subtasks: [
            {
              title: 'KnowledgeExtractionService',
              description: 'Implement knowledge extraction from code',
              assignedTo: 'DevBot-AI',
              type: 'implementation',
              priority: 'P1',
              estimatedComplexity: 'high',
              dependencies: [],
            },
            {
              title: 'VectorSearchService',
              description: 'Implement vector similarity search',
              assignedTo: 'DevBot-Data',
              type: 'implementation',
              priority: 'P2',
              estimatedComplexity: 'medium',
              dependencies: ['KnowledgeExtractionService'],
            },
            {
              title: 'IntegrationTests',
              description: 'Write integration tests for knowledge system',
              assignedTo: 'DevBot-AI',
              type: 'review',
              priority: 'P3',
              estimatedComplexity: 'low',
              dependencies: ['VectorSearchService'],
            },
          ],
          reasoning:
            'Distributed based on expertise: AI specialist for extraction, Data engineer for search',
        }),
        success: true,
        duration: 1500,
        cost: {
          inputTokens: 500,
          outputTokens: 300,
          totalCostCents: 2,
        },
      } as any);
    });

    it('Step 3: Distribute Team Task via Manager', async () => {
      const subtasks = await service.distributeToTeam(teamTask.id);

      expect(subtasks).toBeDefined();
      expect(subtasks.length).toBe(3);

      // Verify subtask structure
      const taskRepo = dataSource.getRepository(Task);

      for (const subtask of subtasks) {
        expect(subtask.depth).toBe(1); // Level 1 (Hollon Task)
        expect(subtask.parentTaskId).toBe(teamTask.id);
        expect(subtask.assignedHollonId).toBeDefined();
        expect(subtask.assignedTeamId).toBeNull();
        expect(subtask.status).toBe(TaskStatus.READY);
      }

      // Verify Team Task status updated
      const updatedTeamTask = await taskRepo.findOne({
        where: { id: teamTask.id },
      });
      expect(updatedTeamTask!.status).toBe(TaskStatus.IN_PROGRESS);

      console.log('\n=== Distribution Result ===');
      subtasks.forEach((st) => {
        console.log(
          `  - ${st.title} → Hollon ${st.assignedHollonId} (${st.status})`,
        );
      });
    });

    it('Step 4: Verify hierarchical structure in database', async () => {
      const taskRepo = dataSource.getRepository(Task);

      // Get all tasks
      const allTasks = await taskRepo.find({
        where: { organizationId: organization.id },
        order: { depth: 'ASC', createdAt: 'ASC' },
      });

      const level0Tasks = allTasks.filter((t) => t.depth === 0);
      const level1Tasks = allTasks.filter((t) => t.depth === 1);

      expect(level0Tasks.length).toBe(1); // Team Task
      expect(level1Tasks.length).toBe(3); // Hollon Tasks

      // Verify Level 0 (Team Task)
      expect(level0Tasks[0].type).toBe(TaskType.TEAM_EPIC);
      expect(level0Tasks[0].assignedTeamId).toBe(team.id);
      expect(level0Tasks[0].assignedHollonId).toBeNull();

      // Verify Level 1 (Hollon Tasks)
      level1Tasks.forEach((task) => {
        expect(task.parentTaskId).toBe(teamTask.id);
        expect(task.assignedHollonId).toBeDefined();
        expect(task.assignedTeamId).toBeNull();
        expect([dev1.id, dev2.id]).toContain(task.assignedHollonId);
      });

      console.log('\n=== Hierarchical Structure ===');
      console.log(`Level 0 (Team Tasks): ${level0Tasks.length}`);
      level0Tasks.forEach((t) => {
        console.log(`  - ${t.title} (${t.type}) → Team ${t.assignedTeamId}`);
      });

      console.log(`Level 1 (Hollon Tasks): ${level1Tasks.length}`);
      level1Tasks.forEach((t) => {
        console.log(
          `  - ${t.title} (${t.type}) → Hollon ${t.assignedHollonId}`,
        );
      });
    });

    it('Step 5: Verify XOR constraint (assignedTeamId XOR assignedHollonId)', async () => {
      const taskRepo = dataSource.getRepository(Task);

      const allTasks = await taskRepo.find({
        where: { organizationId: organization.id },
      });

      allTasks.forEach((task) => {
        const hasTeam = task.assignedTeamId !== null;
        const hasHollon = task.assignedHollonId !== null;

        // XOR: exactly one must be set
        const validXOR = (hasTeam && !hasHollon) || (!hasTeam && hasHollon);

        expect(validXOR).toBe(true);
      });

      console.log('✅ XOR constraint verified for all tasks');
    });
  });
});
