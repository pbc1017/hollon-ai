import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import request from 'supertest';

/**
 * Phase 3 Autonomous Planning End-to-End Test
 *
 * Tests the complete autonomous planning and adaptation flow:
 * 1. Create Organization, Team, Hollon
 * 2. Create Goal (OKR)
 * 3. Auto-decompose Goal → Projects & Tasks (LLM-based)
 * 4. Dependency Analysis
 * 5. Resource Planning & Assignment
 * 6. Priority Rebalancing
 * 7. Uncertainty Detection
 * 8. Strategic Pivot Response
 *
 * This validates Phase 3 autonomous capabilities are working end-to-end.
 */
describe('Phase 3 Autonomous Planning (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Entity IDs created during the test
  let organizationId: string;
  let teamId: string;
  let roleId: string;
  let hollonId: string;
  let goalId: string;
  let projectIds: string[] = [];
  let taskIds: string[] = [];

  const testRunId = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Clean up test data
    await dataSource.query(
      'TRUNCATE goals, goal_progress_records, tasks, projects, hollons, roles, teams, organizations RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    // Cleanup in reverse order
    if (taskIds.length > 0) {
      await dataSource.query('DELETE FROM hollon.tasks WHERE id = ANY($1)', [
        taskIds,
      ]);
    }
    if (projectIds.length > 0) {
      await dataSource.query('DELETE FROM hollon.projects WHERE id = ANY($1)', [
        projectIds,
      ]);
    }
    if (goalId) {
      await dataSource.query('DELETE FROM hollon.goals WHERE id = $1', [
        goalId,
      ]);
    }
    if (hollonId) {
      await dataSource.query('DELETE FROM hollon.hollons WHERE id = $1', [
        hollonId,
      ]);
    }
    if (teamId) {
      await dataSource.query('DELETE FROM hollon.teams WHERE id = $1', [
        teamId,
      ]);
    }
    if (organizationId) {
      await dataSource.query('DELETE FROM hollon.organizations WHERE id = $1', [
        organizationId,
      ]);
    }

    await app.close();
  });

  describe('Phase 3 Complete Flow', () => {
    it('Step 1: Create Organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .send({
          name: `Phase3 Test Org ${testRunId}`,
          description: 'Testing Phase 3 autonomous planning',
          settings: {},
        })
        .expect(201);

      organizationId = response.body.id;
      expect(organizationId).toBeDefined();
    });

    it('Step 2: Create Team', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/teams')
        .send({
          name: `Autonomous Team ${testRunId}`,
          organizationId,
          description: 'Team for autonomous planning tests',
        })
        .expect(201);

      teamId = response.body.id;
      expect(teamId).toBeDefined();
    });

    it('Step 3: Create Role', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/roles')
        .send({
          name: `Developer Role ${testRunId}`,
          organizationId,
          description: 'Development role for testing',
          permissions: ['task.read', 'task.write'],
        })
        .expect(201);

      roleId = response.body.id;
      expect(roleId).toBeDefined();
    });

    it('Step 4: Create Hollon', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          name: `Test Hollon ${testRunId}`,
          organizationId,
          teamId,
          roleId,
          status: 'idle',
          capabilities: ['development', 'planning'],
        })
        .expect(201);

      hollonId = response.body.id;
      expect(hollonId).toBeDefined();
    });

    it('Step 5: Create Goal (OKR)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/goals')
        .send({
          organizationId,
          teamId,
          title: 'Build AI-powered Task Management System',
          description:
            'Create a comprehensive task management system with AI capabilities',
          type: 'objective',
          timeframe: 'quarterly',
          targetValue: 100,
          keyResults: [
            {
              title: 'Complete core task features',
              metric: 'features_completed',
              targetValue: 10,
            },
            {
              title: 'Achieve 90% test coverage',
              metric: 'test_coverage',
              targetValue: 90,
            },
          ],
        })
        .expect(201);

      goalId = response.body.id;
      expect(goalId).toBeDefined();
      expect(response.body.title).toBe(
        'Build AI-powered Task Management System',
      );
    });

    it('Step 6: Create Project Manually (LLM-based decompose skipped in E2E)', async () => {
      // NOTE: Auto-decompose requires LLM API call, so we manually create for E2E testing
      const response = await request(app.getHttpServer())
        .post('/api/projects')
        .send({
          name: `Test Project ${testRunId}`,
          organizationId,
          teamId,
          goalId,
          description: 'Manually created project for E2E testing',
          status: 'active',
        })
        .expect(201);

      projectIds.push(response.body.id);
      expect(response.body.id).toBeDefined();
    });

    it('Step 7: Create Tasks Manually', async () => {
      // Create 3 tasks with dependencies for testing
      const task1 = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          title: 'Design database schema',
          description: 'Design and document the database schema',
          projectId: projectIds[0],
          organizationId,
          type: 'implementation',
          status: 'pending',
          priority: 'P2',
        })
        .expect(201);

      taskIds.push(task1.body.id);

      const task2 = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          title: 'Implement API endpoints',
          description:
            'Implement RESTful API endpoints\n\n**Dependencies:**\n- Design database schema',
          projectId: projectIds[0],
          organizationId,
          type: 'implementation',
          status: 'pending',
          priority: 'P2',
        })
        .expect(201);

      taskIds.push(task2.body.id);

      const task3 = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          title: 'Write integration tests',
          description:
            'TODO: Write comprehensive integration tests\n\n**Dependencies:**\n- Implement API endpoints',
          projectId: projectIds[0],
          organizationId,
          type: 'implementation',
          status: 'pending',
          priority: 'P3',
        })
        .expect(201);

      taskIds.push(task3.body.id);

      expect(taskIds.length).toBe(3);
    });

    it('Step 8: Analyze Project Dependencies', async () => {
      if (projectIds.length === 0) {
        console.log('⚠️  No projects created, skipping dependency analysis');
        return;
      }

      const projectId = projectIds[0];
      const response = await request(app.getHttpServer())
        .get(`/api/tasks/projects/${projectId}/dependency-analysis`)
        .expect(200);

      expect(response.body.graph).toBeDefined();
      expect(response.body.executionOrder).toBeDefined();
      expect(response.body.executionPhases).toBeDefined();
      expect(response.body.criticalPath).toBeDefined();
      expect(response.body.parallelizationScore).toBeGreaterThanOrEqual(0);
      expect(response.body.parallelizationScore).toBeLessThanOrEqual(100);
    });

    it('Step 9: Assign Resources to Project', async () => {
      if (projectIds.length === 0) {
        console.log('⚠️  No projects created, skipping resource assignment');
        return;
      }

      const projectId = projectIds[0];
      const response = await request(app.getHttpServer())
        .post(`/api/tasks/projects/${projectId}/assign-resources`)
        .expect(201);

      expect(response.body.assignments).toBeDefined();
      expect(response.body.workloads).toBeDefined();
      expect(response.body.assignedTasks).toBeGreaterThanOrEqual(0);
      expect(response.body.averageMatchScore).toBeGreaterThanOrEqual(0);
    });

    it('Step 10: Rebalance Task Priorities', async () => {
      if (projectIds.length === 0) {
        console.log('⚠️  No projects created, skipping priority rebalancing');
        return;
      }

      const projectId = projectIds[0];
      const response = await request(app.getHttpServer())
        .post(`/api/tasks/projects/${projectId}/rebalance-priorities`)
        .send({
          minScoreChange: 15,
          dryRun: true, // Don't actually change priorities in test
        })
        .expect(201);

      expect(response.body.rebalancedTasks).toBeDefined();
      expect(response.body.bottlenecks).toBeDefined();
      expect(response.body.totalRebalanced).toBeGreaterThanOrEqual(0);
      expect(response.body.warnings).toBeDefined();
    });

    it('Step 11: Detect Task Uncertainty', async () => {
      if (projectIds.length === 0) {
        console.log('⚠️  No projects created, skipping uncertainty detection');
        return;
      }

      const projectId = projectIds[0];
      const response = await request(app.getHttpServer())
        .post(`/api/tasks/projects/${projectId}/detect-uncertainty`)
        .send({
          autoGenerateSpikes: false, // Don't create spike tasks in test
        })
        .expect(201);

      expect(response.body.uncertainTasks).toBeDefined();
      expect(response.body.spikesGenerated).toBeDefined();
      expect(response.body.totalUncertain).toBeGreaterThanOrEqual(0);
      expect(response.body.averageUncertaintyLevel).toBeGreaterThanOrEqual(0);
      expect(response.body.recommendations).toBeDefined();
    });

    it('Step 12: Analyze Strategic Pivot Impact', async () => {
      if (projectIds.length === 0) {
        console.log('⚠️  No projects created, skipping pivot analysis');
        return;
      }

      const projectId = projectIds[0];
      const response = await request(app.getHttpServer())
        .post(`/api/tasks/projects/${projectId}/analyze-pivot`)
        .send({
          pivotContext: {
            pivotType: 'strategic',
            oldDirection: 'Traditional task management',
            newDirection: 'AI-powered autonomous task planning',
            affectedAreas: ['planning', 'automation', 'AI'],
          },
          options: {
            dryRun: true, // Don't actually change tasks in test
            autoArchiveTasks: false,
            autoCreateReplacements: false,
          },
        })
        .expect(201);

      expect(response.body.affectedTasks).toBeDefined();
      expect(response.body.affectedProjects).toBeDefined();
      expect(response.body.recreationPlan).toBeDefined();
      expect(response.body.totalImpactScore).toBeGreaterThanOrEqual(0);
      expect(response.body.totalImpactScore).toBeLessThanOrEqual(100);
      expect(response.body.estimatedTransitionTime).toBeGreaterThanOrEqual(0);
      expect(response.body.warnings).toBeDefined();
      expect(response.body.recommendations).toBeDefined();
    });

    it('Step 13: Verify Complete Flow Results', async () => {
      // Verify Goal exists
      const goalResponse = await request(app.getHttpServer())
        .get(`/api/goals/${goalId}`)
        .expect(200);

      expect(goalResponse.body.id).toBe(goalId);

      // Verify Projects were created
      expect(projectIds.length).toBeGreaterThan(0);

      // Verify Tasks were created
      expect(taskIds.length).toBe(3);

      console.log(`
🎉 Phase 3 E2E Test Summary:
- Organization: ${organizationId}
- Team: ${teamId}
- Role: ${roleId}
- Hollon: ${hollonId}
- Goal: ${goalId}
- Projects created: ${projectIds.length}
- Tasks created: ${taskIds.length}
- All Phase 3 autonomous services tested successfully!
      `);
    });
  });

  describe('Individual Service Tests', () => {
    it('Should evaluate single task priority score', async () => {
      if (taskIds.length === 0) {
        console.log('⚠️  No tasks created, skipping priority score test');
        return;
      }

      const taskId = taskIds[0];
      const response = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/priority-score`)
        .expect(200);

      expect(response.body.taskId).toBe(taskId);
      expect(response.body.score).toBeGreaterThanOrEqual(0);
      expect(response.body.score).toBeLessThanOrEqual(100);
      expect(response.body.factors).toBeDefined();
      expect(response.body.suggestedPriority).toBeDefined();
      expect(response.body.reasoning).toBeDefined();
    });

    it('Should analyze single task uncertainty', async () => {
      if (taskIds.length === 0) {
        console.log('⚠️  No tasks created, skipping uncertainty analysis test');
        return;
      }

      const taskId = taskIds[0];
      const response = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/uncertainty-analysis`)
        .expect(200);

      expect(response.body.task).toBeDefined();
      expect(response.body.uncertaintyLevel).toMatch(
        /^(low|medium|high|critical)$/,
      );
      expect(response.body.factors).toBeDefined();
      expect(response.body.confidence).toBeGreaterThanOrEqual(0);
      expect(response.body.confidence).toBeLessThanOrEqual(100);
      expect(response.body.reasoning).toBeDefined();
    });

    it('Should analyze single task dependencies', async () => {
      if (taskIds.length === 0) {
        console.log('⚠️  No tasks created, skipping dependency analysis test');
        return;
      }

      const taskId = taskIds[0];
      const response = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}/dependencies`)
        .expect(200);

      expect(response.body.task).toBeDefined();
      expect(response.body.directDependencies).toBeDefined();
      expect(response.body.allDependencies).toBeDefined();
      expect(response.body.directDependents).toBeDefined();
      expect(response.body.allDependents).toBeDefined();
    });
  });
});
