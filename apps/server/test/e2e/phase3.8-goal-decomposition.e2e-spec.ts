import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { BrainProviderService } from '../../src/modules/brain-provider/brain-provider.service';

/**
 * Phase 3.8 Goal Decomposition End-to-End Test
 *
 * Tests the complete Goal → Team Task decomposition flow:
 * 1. Create Organization, Team with Manager, Hollons
 * 2. Create Goal
 * 3. Decompose Goal with useTeamDistribution: true
 * 4. Verify Team Tasks (TEAM_EPIC) are created with correct assignments
 * 5. Verify hierarchical structure (depth = 0, assignedTeamId set)
 * 6. (Optional) Trigger Manager distribution to create Hollon Tasks
 *
 * This validates the automatic Goal → Team Task flow works end-to-end.
 */
describe('Phase 3.8 Goal Decomposition with Team Distribution (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let brainProvider: BrainProviderService;

  // Entity IDs
  let organizationId: string;
  let teamId: string;
  let managerRoleId: string;
  let developerRoleId: string;
  let managerHollonId: string;
  let devHollon1Id: string;
  let devHollon2Id: string;
  let goalId: string;
  let projectId: string;
  let teamTaskIds: string[] = [];

  const testRunId = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    brainProvider =
      moduleFixture.get<BrainProviderService>(BrainProviderService);

    // Clean up test data
    await dataSource.query(
      'TRUNCATE goals, tasks, projects, hollons, roles, teams, organizations RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Goal Decomposition Complete Flow', () => {
    it('Step 1: Create Organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .send({
          name: `Phase3.8 Goal Decomposition Test ${testRunId}`,
          description: 'Testing Goal → Team Task decomposition',
          settings: {
            autonomousExecutionEnabled: true,
            maxConcurrentHolons: 10,
          },
        })
        .expect(201);

      organizationId = response.body.id;
      expect(organizationId).toBeDefined();
      console.log(`✅ Organization created: ${organizationId}`);
    });

    it('Step 2: Create Roles (Manager, Developer)', async () => {
      // Manager Role
      const managerResponse = await request(app.getHttpServer())
        .post('/api/roles')
        .send({
          name: 'Manager',
          description: 'Team manager for task distribution',
          organizationId,
          capabilities: [
            'task-distribution',
            'team-coordination',
            'decision-making',
          ],
        })
        .expect(201);

      managerRoleId = managerResponse.body.id;

      // Developer Role
      const devResponse = await request(app.getHttpServer())
        .post('/api/roles')
        .send({
          name: 'Developer',
          description: 'Software developer',
          organizationId,
          capabilities: ['typescript', 'nestjs', 'postgresql', 'ai'],
        })
        .expect(201);

      developerRoleId = devResponse.body.id;

      expect(managerRoleId).toBeDefined();
      expect(developerRoleId).toBeDefined();
      console.log(`✅ Roles created: Manager, Developer`);
    });

    it('Step 3: Create Team', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/teams')
        .send({
          name: 'Phase 4 Implementation Team',
          description: 'Team for Phase 4 knowledge system implementation',
          organizationId,
        })
        .expect(201);

      teamId = response.body.id;
      expect(teamId).toBeDefined();
      console.log(`✅ Team created: ${teamId}`);
    });

    it('Step 4: Create Manager Hollon', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          name: 'Manager-Phase4',
          organizationId,
          teamId,
          roleId: managerRoleId,
          personality:
            'Strategic leader focused on efficient task distribution',
        })
        .expect(201);

      managerHollonId = response.body.id;
      expect(managerHollonId).toBeDefined();
      console.log(`✅ Manager Hollon created: ${managerHollonId}`);
    });

    it('Step 5: Assign Manager to Team', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/teams/${teamId}`)
        .send({
          managerHollonId,
        })
        .expect(200);

      expect(response.body.managerHollonId).toBe(managerHollonId);
      console.log(`✅ Manager assigned to team`);
    });

    it('Step 6: Create Developer Hollons', async () => {
      // Developer 1
      const dev1Response = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          name: 'DevBot-AI',
          organizationId,
          teamId,
          roleId: developerRoleId,
          personality: 'AI/ML specialist with expertise in knowledge systems',
        })
        .expect(201);

      devHollon1Id = dev1Response.body.id;

      // Developer 2
      const dev2Response = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          name: 'DevBot-Backend',
          organizationId,
          teamId,
          roleId: developerRoleId,
          personality: 'Backend specialist focused on data processing',
        })
        .expect(201);

      devHollon2Id = dev2Response.body.id;

      expect(devHollon1Id).toBeDefined();
      expect(devHollon2Id).toBeDefined();
      console.log(`✅ Developer Hollons created: DevBot-AI, DevBot-Backend`);
    });

    it('Step 7: Create Goal', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/goals')
        .send({
          title: 'Phase 4: Knowledge System Implementation',
          description:
            'Build autonomous knowledge extraction, vector search, and learning capabilities for Hollon AI system',
          organizationId,
          teamId,
          goalType: 'objective', // GoalType.OBJECTIVE
          priority: 'high',
          targetDate: new Date(
            Date.now() + 60 * 24 * 60 * 60 * 1000,
          ).toISOString(), // 60 days
        })
        .expect(201);

      goalId = response.body.id;
      expect(goalId).toBeDefined();
      console.log(`✅ Goal created: ${goalId}`);
    });

    it('Step 8: Mock Brain Provider for Goal Decomposition', () => {
      // Mock Brain Provider to avoid external API call
      jest.spyOn(brainProvider, 'executeWithTracking').mockResolvedValueOnce({
        output: JSON.stringify({
          projects: [
            {
              name: 'Phase 4 Knowledge System',
              description: 'Knowledge extraction and learning capabilities',
              tasks: [
                {
                  title: 'Knowledge Extraction Service',
                  description: 'Extract knowledge from task execution history',
                  type: 'implementation',
                  priority: 'P1',
                  estimatedComplexity: 'high',
                  acceptanceCriteria: [
                    'Service extracts patterns from completed tasks',
                    'Knowledge stored in vector database',
                  ],
                },
                {
                  title: 'Vector Search Engine',
                  description: 'Semantic search for knowledge retrieval',
                  type: 'implementation',
                  priority: 'P1',
                  estimatedComplexity: 'medium',
                  acceptanceCriteria: [
                    'Vector embeddings generated',
                    'Similarity search functional',
                  ],
                },
                {
                  title: 'Learning Analytics Dashboard',
                  description: 'Visualize learning progress and insights',
                  type: 'implementation',
                  priority: 'P2',
                  estimatedComplexity: 'medium',
                  acceptanceCriteria: [
                    'Dashboard displays metrics',
                    'Real-time updates',
                  ],
                },
              ],
            },
          ],
        }),
        success: true,
        duration: 2000,
        cost: {
          inputTokens: 500,
          outputTokens: 300,
          totalCostCents: 5,
        },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      console.log('✅ Brain Provider mocked for Goal Decomposition');
    });

    it('Step 9: Decompose Goal with useTeamDistribution', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/goals/${goalId}/decompose`)
        .send({
          strategy: 'task_based',
          useTeamDistribution: true, // Phase 3.8: Enable Team Distribution
          autoAssign: false, // Don't auto-assign to hollons
          maxDepth: 1,
          createDependencies: false,
        })
        .expect(201);

      // Verify response structure
      expect(response.body.projects).toBeDefined();
      expect(response.body.tasks).toBeDefined();
      expect(response.body.projects.length).toBeGreaterThan(0);
      expect(response.body.tasks.length).toBeGreaterThan(0);

      projectId = response.body.projects[0].id;

      // Filter for Team Tasks (TEAM_EPIC type)
      const teamTasks = response.body.tasks.filter(
        (task: any) => task.type === 'team_epic',
      );

      expect(teamTasks.length).toBeGreaterThan(0);
      teamTaskIds = teamTasks.map((t: any) => t.id);

      console.log(`✅ Goal decomposed:`);
      console.log(`   Projects created: ${response.body.projects.length}`);
      console.log(`   Total tasks created: ${response.body.tasks.length}`);
      console.log(`   Team Tasks (TEAM_EPIC): ${teamTasks.length}`);
      console.log(
        `   Titles: ${teamTasks.map((t: any) => t.title.substring(0, 50)).join(', ')}...`,
      );
    });

    it('Step 10: Verify Team Task Properties', async () => {
      expect(teamTaskIds.length).toBeGreaterThan(0);

      for (const teamTaskId of teamTaskIds) {
        const response = await request(app.getHttpServer())
          .get(`/api/tasks/${teamTaskId}`)
          .expect(200);

        const teamTask = response.body;

        // Verify Team Task properties (Phase 3.8)
        expect(teamTask.type).toBe('team_epic'); // TaskType.TEAM_EPIC
        expect(teamTask.depth).toBe(0); // Level 0 (Team Task)
        expect(teamTask.assignedTeamId).toBe(teamId); // Assigned to team
        expect(teamTask.assignedHollonId).toBeNull(); // NOT assigned to individual hollon
        expect(teamTask.status).toBe('pending'); // Waiting for Manager distribution

        console.log(`   ✓ Team Task: "${teamTask.title}"`);
        console.log(`     - Type: ${teamTask.type}`);
        console.log(`     - Depth: ${teamTask.depth}`);
        console.log(`     - Assigned Team: ${teamTask.assignedTeamId}`);
        console.log(`     - Status: ${teamTask.status}`);
      }

      console.log(`✅ All ${teamTaskIds.length} Team Tasks verified`);
    });

    it('Step 11: Verify Goal Metadata Updated', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/goals/${goalId}`)
        .expect(200);

      const goal = response.body;

      expect(goal.autoDecomposed).toBe(true);
      expect(goal.decompositionStrategy).toBe('task_based');

      console.log('✅ Goal metadata updated (autoDecomposed: true)');
    });

    it('Step 12: Verify XOR Constraint (assignedTeamId XOR assignedHollonId)', async () => {
      const allTasks = await dataSource.query(
        `
        SELECT
          id,
          title,
          type,
          assigned_team_id,
          assigned_hollon_id
        FROM tasks
        WHERE project_id = $1
        `,
        [projectId],
      );

      allTasks.forEach((task: any) => {
        const hasTeam = task.assigned_team_id !== null;
        const hasHollon = task.assigned_hollon_id !== null;

        // XOR: Either team OR hollon, but not both
        const validXOR = (hasTeam && !hasHollon) || (!hasTeam && hasHollon);

        expect(validXOR).toBe(true);
      });

      console.log('✅ XOR constraint verified for all tasks');
    });

    it('Step 11: Verify Goal Metadata Updated', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/goals/${goalId}`)
        .expect(200);

      const goal = response.body;

      expect(goal.autoDecomposed).toBe(true);
      expect(goal.decompositionStrategy).toBe('task_based');

      console.log('✅ Goal metadata updated (autoDecomposed: true)');
    });

    it('Step 12: Summary - Goal Decomposition Complete', () => {
      console.log('\n=== Phase 3.8 Goal Decomposition Summary ===');
      console.log(`✅ Organization: ${organizationId}`);
      console.log(`✅ Team: ${teamId}`);
      console.log(`✅ Manager: ${managerHollonId}`);
      console.log(`✅ Developers: ${devHollon1Id}, ${devHollon2Id}`);
      console.log(`✅ Goal: ${goalId}`);
      console.log(`✅ Project: ${projectId}`);
      console.log(`✅ Team Tasks Created: ${teamTaskIds.length}`);
      console.log('\n📋 Team Tasks (Level 0):');
      console.log(`   - All tasks have type = 'team_epic'`);
      console.log(`   - All tasks have depth = 0`);
      console.log(`   - All tasks assigned to team (assignedTeamId set)`);
      console.log(`   - All tasks have status = 'pending'`);
      console.log('\n🎯 Next Step:');
      console.log(
        '   TeamTaskDistributionService will distribute these Team Tasks to Hollons',
      );
      console.log(
        '   (Tested separately in phase3.8-hierarchical-distribution.e2e-spec.ts)',
      );
    });
  });
});
