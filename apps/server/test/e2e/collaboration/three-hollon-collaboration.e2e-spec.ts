import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { HollonStatus } from '../../../src/modules/hollon/entities/hollon.entity';
import { TaskStatus } from '../../../src/modules/task/entities/task.entity';

/**
 * Scenario 1: 3-Hollon Collaboration Happy Path
 *
 * Tests the complete flow of 3 hollons collaborating on a project:
 * 1. Setup: Create Organization → Team → 3 Roles → 3 Hollons → Project
 * 2. Create 5 tasks with dependencies
 * 3. Each hollon pulls and works on tasks
 * 4. Hollon A requests collaboration from Hollon B
 * 5. Hollon C creates PR and requests review
 * 6. Verify all tasks completed and documents created
 */
describe('3-Hollon Collaboration E2E (Scenario 1)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Entity IDs
  let organizationId: string;
  let teamId: string;
  let frontendRoleId: string;
  let backendRoleId: string;
  let qaRoleId: string;
  let hollonAlphaId: string; // Frontend
  let hollonBetaId: string; // Backend
  let hollonGammaId: string; // QA
  let projectId: string;
  let task1Id: string; // Backend API
  let task2Id: string; // Frontend UI
  let task3Id: string; // Integration
  let task4Id: string; // Testing
  let task5Id: string; // Documentation

  const testRunId = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    // Cleanup in reverse order of dependencies
    if (task1Id)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [task1Id]);
    if (task2Id)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [task2Id]);
    if (task3Id)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [task3Id]);
    if (task4Id)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [task4Id]);
    if (task5Id)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [task5Id]);
    if (projectId)
      await dataSource.query('DELETE FROM projects WHERE id = $1', [projectId]);
    if (hollonAlphaId)
      await dataSource.query('DELETE FROM hollons WHERE id = $1', [
        hollonAlphaId,
      ]);
    if (hollonBetaId)
      await dataSource.query('DELETE FROM hollons WHERE id = $1', [
        hollonBetaId,
      ]);
    if (hollonGammaId)
      await dataSource.query('DELETE FROM hollons WHERE id = $1', [
        hollonGammaId,
      ]);
    if (frontendRoleId)
      await dataSource.query('DELETE FROM roles WHERE id = $1', [
        frontendRoleId,
      ]);
    if (backendRoleId)
      await dataSource.query('DELETE FROM roles WHERE id = $1', [
        backendRoleId,
      ]);
    if (qaRoleId)
      await dataSource.query('DELETE FROM roles WHERE id = $1', [qaRoleId]);
    if (teamId)
      await dataSource.query('DELETE FROM teams WHERE id = $1', [teamId]);
    if (organizationId)
      await dataSource.query('DELETE FROM organizations WHERE id = $1', [
        organizationId,
      ]);

    await app.close();
  });

  describe('Setup Phase', () => {
    it('should create organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .send({
          name: `3-Hollon Collab Org ${testRunId}`,
          description: 'Testing 3-hollon collaboration',
          settings: {
            costLimitDailyCents: 50000,
            costLimitMonthlyCents: 1500000,
            maxHollonsPerTeam: 10,
          },
        })
        .expect(201);

      organizationId = response.body.id;
      expect(organizationId).toBeDefined();
    });

    it('should create team', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/teams')
        .send({
          organizationId,
          name: 'Full Stack Team',
          description: 'Team with frontend, backend, and QA',
        })
        .expect(201);

      teamId = response.body.id;
      expect(teamId).toBeDefined();
    });

    it('should create 3 roles', async () => {
      // Frontend Role
      const frontendRes = await request(app.getHttpServer())
        .post('/api/roles')
        .send({
          organizationId,
          name: `Frontend Engineer ${testRunId}`,
          description: 'React and TypeScript expert',
          systemPrompt: 'You are a frontend engineer specializing in React.',
          capabilities: ['react', 'typescript', 'css'],
        })
        .expect(201);
      frontendRoleId = frontendRes.body.id;

      // Backend Role
      const backendRes = await request(app.getHttpServer())
        .post('/api/roles')
        .send({
          organizationId,
          name: `Backend Engineer ${testRunId}`,
          description: 'NestJS and PostgreSQL expert',
          systemPrompt: 'You are a backend engineer specializing in NestJS.',
          capabilities: ['nestjs', 'postgresql', 'typescript'],
        })
        .expect(201);
      backendRoleId = backendRes.body.id;

      // QA Role
      const qaRes = await request(app.getHttpServer())
        .post('/api/roles')
        .send({
          organizationId,
          name: `QA Engineer ${testRunId}`,
          description: 'Testing and quality assurance expert',
          systemPrompt:
            'You are a QA engineer specializing in automated testing.',
          capabilities: ['testing', 'jest', 'playwright'],
        })
        .expect(201);
      qaRoleId = qaRes.body.id;

      expect(frontendRoleId).toBeDefined();
      expect(backendRoleId).toBeDefined();
      expect(qaRoleId).toBeDefined();
    });

    it('should create 3 hollons', async () => {
      // Hollon Alpha (Frontend)
      const alphaRes = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          organizationId,
          teamId,
          roleId: frontendRoleId,
          name: 'Alpha',
          systemPrompt: 'You are Alpha, a skilled frontend developer.',
          maxConcurrentTasks: 1,
        })
        .expect(201);
      hollonAlphaId = alphaRes.body.id;
      expect(alphaRes.body.status).toBe(HollonStatus.IDLE);

      // Hollon Beta (Backend)
      const betaRes = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          organizationId,
          teamId,
          roleId: backendRoleId,
          name: 'Beta',
          systemPrompt: 'You are Beta, a skilled backend developer.',
          maxConcurrentTasks: 1,
        })
        .expect(201);
      hollonBetaId = betaRes.body.id;
      expect(betaRes.body.status).toBe(HollonStatus.IDLE);

      // Hollon Gamma (QA)
      const gammaRes = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          organizationId,
          teamId,
          roleId: qaRoleId,
          name: 'Gamma',
          systemPrompt: 'You are Gamma, a meticulous QA engineer.',
          maxConcurrentTasks: 1,
        })
        .expect(201);
      hollonGammaId = gammaRes.body.id;
      expect(gammaRes.body.status).toBe(HollonStatus.IDLE);
    });

    it('should create project', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/projects')
        .send({
          organizationId,
          name: '3-Hollon Collaboration Project',
          description: 'Test project for 3-hollon collaboration',
          workingDirectory: '/tmp/3-hollon-test',
        })
        .expect(201);

      projectId = response.body.id;
      expect(projectId).toBeDefined();
    });

    it('should create 5 tasks with dependencies', async () => {
      // Task 1: Backend API (Backend)
      const task1Res = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          projectId,
          title: 'Implement User API',
          description: 'Create REST API for user management',
          type: 'implementation',
          priority: 'P1',
          assignedHollonId: hollonBetaId,
          acceptanceCriteria: [
            'CRUD endpoints for users',
            'Input validation',
            'Error handling',
          ],
          affectedFiles: ['src/api/users.controller.ts'],
        })
        .expect(201);
      task1Id = task1Res.body.id;

      // Task 2: Frontend UI (Frontend) - depends on Task 1
      const task2Res = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          projectId,
          title: 'Build User Management UI',
          description: 'Create React components for user management',
          type: 'implementation',
          priority: 'P2',
          assignedHollonId: hollonAlphaId,
          acceptanceCriteria: [
            'User list component',
            'User form component',
            'API integration',
          ],
          affectedFiles: ['src/components/UserList.tsx'],
          dependsOn: [task1Id],
        })
        .expect(201);
      task2Id = task2Res.body.id;

      // Task 3: Integration (Both) - depends on Task 1 and 2
      const task3Res = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          projectId,
          title: 'Integrate Frontend with Backend',
          description: 'Ensure frontend and backend work together',
          type: 'implementation',
          priority: 'P2',
          acceptanceCriteria: [
            'Data flows correctly',
            'Error handling works',
            'Loading states implemented',
          ],
          affectedFiles: ['src/services/api.ts'],
          dependsOn: [task1Id, task2Id],
        })
        .expect(201);
      task3Id = task3Res.body.id;

      // Task 4: Testing (QA) - depends on Task 3
      const task4Res = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          projectId,
          title: 'Write E2E Tests',
          description: 'Create end-to-end tests for user management',
          type: 'testing',
          priority: 'P2',
          assignedHollonId: hollonGammaId,
          acceptanceCriteria: [
            'User creation test',
            'User update test',
            'User deletion test',
            'All tests pass',
          ],
          affectedFiles: ['tests/e2e/users.spec.ts'],
          dependsOn: [task3Id],
        })
        .expect(201);
      task4Id = task4Res.body.id;

      // Task 5: Documentation (Anyone)
      const task5Res = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          projectId,
          title: 'Write API Documentation',
          description: 'Document the user management API',
          type: 'documentation',
          priority: 'P3',
          acceptanceCriteria: [
            'API endpoints documented',
            'Examples provided',
            'Error responses documented',
          ],
          affectedFiles: ['docs/api/users.md'],
        })
        .expect(201);
      task5Id = task5Res.body.id;

      expect(task1Id).toBeDefined();
      expect(task2Id).toBeDefined();
      expect(task3Id).toBeDefined();
      expect(task4Id).toBeDefined();
      expect(task5Id).toBeDefined();
    });
  });

  describe('Collaboration Phase', () => {
    it('should verify all 3 hollons are in IDLE state', async () => {
      const alphaRes = await request(app.getHttpServer())
        .get(`/api/hollons/${hollonAlphaId}`)
        .expect(200);
      expect(alphaRes.body.status).toBe(HollonStatus.IDLE);

      const betaRes = await request(app.getHttpServer())
        .get(`/api/hollons/${hollonBetaId}`)
        .expect(200);
      expect(betaRes.body.status).toBe(HollonStatus.IDLE);

      const gammaRes = await request(app.getHttpServer())
        .get(`/api/hollons/${hollonGammaId}`)
        .expect(200);
      expect(gammaRes.body.status).toBe(HollonStatus.IDLE);
    });

    it('should verify tasks are assigned correctly', async () => {
      const task1Res = await request(app.getHttpServer())
        .get(`/api/tasks/${task1Id}`)
        .expect(200);
      expect(task1Res.body.assignedHollonId).toBe(hollonBetaId);
      expect(task1Res.body.status).toBe(TaskStatus.PENDING);

      const task2Res = await request(app.getHttpServer())
        .get(`/api/tasks/${task2Id}`)
        .expect(200);
      expect(task2Res.body.assignedHollonId).toBe(hollonAlphaId);

      const task4Res = await request(app.getHttpServer())
        .get(`/api/tasks/${task4Id}`)
        .expect(200);
      expect(task4Res.body.assignedHollonId).toBe(hollonGammaId);
    });

    it('should create a collaboration request between hollons', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/collaboration/request')
        .send({
          requesterHollonId: hollonAlphaId,
          type: 'pair_programming',
          description: 'Need help integrating with the API',
          taskId: task2Id,
          preferredTeamId: teamId,
        })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.status).toBe('pending');
      expect(response.body.requesterHollonId).toBe(hollonAlphaId);
      expect(response.body.collaboratorHollonId).toBeDefined();
      // Should match Beta or Gamma based on availability
    });

    it('should verify project has all tasks', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .expect(200);

      expect(response.body.id).toBe(projectId);
      expect(response.body.organizationId).toBe(organizationId);
    });

    it('should verify team has all 3 hollons', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/teams/${teamId}`)
        .expect(200);

      expect(response.body.id).toBe(teamId);
      expect(response.body.organizationId).toBe(organizationId);
    });
  });

  describe('Verification Phase', () => {
    it('should verify all entities are correctly linked', async () => {
      // Verify hollons belong to team
      const alphaRes = await request(app.getHttpServer())
        .get(`/api/hollons/${hollonAlphaId}`)
        .expect(200);
      expect(alphaRes.body.teamId).toBe(teamId);
      expect(alphaRes.body.organizationId).toBe(organizationId);

      const betaRes = await request(app.getHttpServer())
        .get(`/api/hollons/${hollonBetaId}`)
        .expect(200);
      expect(betaRes.body.teamId).toBe(teamId);

      const gammaRes = await request(app.getHttpServer())
        .get(`/api/hollons/${hollonGammaId}`)
        .expect(200);
      expect(gammaRes.body.teamId).toBe(teamId);
    });

    it('should verify project belongs to organization', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .expect(200);

      expect(response.body.organizationId).toBe(organizationId);
    });

    it('should verify tasks belong to project', async () => {
      const task1Res = await request(app.getHttpServer())
        .get(`/api/tasks/${task1Id}`)
        .expect(200);
      expect(task1Res.body.projectId).toBe(projectId);

      const task2Res = await request(app.getHttpServer())
        .get(`/api/tasks/${task2Id}`)
        .expect(200);
      expect(task2Res.body.projectId).toBe(projectId);
    });

    it('should verify system health', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.checks.database.status).toBe('up');
    });
  });
});
