import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { ContractStatus } from '../../../src/modules/cross-team-collaboration/entities/cross-team-contract.entity';

/**
 * Scenario 2: Team Dependency E2E Test
 *
 * Tests cross-team collaboration with contract workflow:
 * 1. Setup: Create 2 organizations → 2 teams → 4 roles → 4 hollons
 * 2. Team A needs API from Team B
 * 3. Create cross-team contract and negotiate
 * 4. Team B completes API
 * 5. Team A proceeds with integration
 * 6. Verify contract fulfillment
 */
describe('Team Dependency E2E (Scenario 2)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Entity IDs
  let organizationId: string;
  let teamAId: string;
  let teamBId: string;
  let backendRoleId: string;
  let frontendRoleId: string;
  let hollonTeamABackendId: string;
  let hollonTeamAFrontendId: string;
  let hollonTeamBBackendId: string;
  let hollonTeamBFrontendId: string;
  let projectTeamAId: string;
  let projectTeamBId: string;
  let taskTeamAId: string;
  let taskTeamBId: string;
  let contractId: string;

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
    if (contractId)
      await dataSource.query('DELETE FROM cross_team_contracts WHERE id = $1', [
        contractId,
      ]);
    if (taskTeamAId)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [taskTeamAId]);
    if (taskTeamBId)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [taskTeamBId]);
    if (projectTeamAId)
      await dataSource.query('DELETE FROM projects WHERE id = $1', [
        projectTeamAId,
      ]);
    if (projectTeamBId)
      await dataSource.query('DELETE FROM projects WHERE id = $1', [
        projectTeamBId,
      ]);
    if (hollonTeamABackendId)
      await dataSource.query('DELETE FROM hollons WHERE id = $1', [
        hollonTeamABackendId,
      ]);
    if (hollonTeamAFrontendId)
      await dataSource.query('DELETE FROM hollons WHERE id = $1', [
        hollonTeamAFrontendId,
      ]);
    if (hollonTeamBBackendId)
      await dataSource.query('DELETE FROM hollons WHERE id = $1', [
        hollonTeamBBackendId,
      ]);
    if (hollonTeamBFrontendId)
      await dataSource.query('DELETE FROM hollons WHERE id = $1', [
        hollonTeamBFrontendId,
      ]);
    if (backendRoleId)
      await dataSource.query('DELETE FROM roles WHERE id = $1', [
        backendRoleId,
      ]);
    if (frontendRoleId)
      await dataSource.query('DELETE FROM roles WHERE id = $1', [
        frontendRoleId,
      ]);
    if (teamAId)
      await dataSource.query('DELETE FROM teams WHERE id = $1', [teamAId]);
    if (teamBId)
      await dataSource.query('DELETE FROM teams WHERE id = $1', [teamBId]);
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
          name: `Team Dependency Org ${testRunId}`,
          description: 'Testing cross-team dependency',
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

    it('should create Team A and Team B', async () => {
      const teamARes = await request(app.getHttpServer())
        .post('/api/teams')
        .send({
          organizationId,
          name: 'Team A - Client Team',
          description: 'Frontend-focused team that depends on Team B',
        })
        .expect(201);
      teamAId = teamARes.body.id;

      const teamBRes = await request(app.getHttpServer())
        .post('/api/teams')
        .send({
          organizationId,
          name: 'Team B - Platform Team',
          description: 'Backend-focused team that provides APIs',
        })
        .expect(201);
      teamBId = teamBRes.body.id;

      expect(teamAId).toBeDefined();
      expect(teamBId).toBeDefined();
    });

    it('should create backend and frontend roles', async () => {
      const backendRes = await request(app.getHttpServer())
        .post('/api/roles')
        .send({
          organizationId,
          name: `Backend Engineer ${testRunId}`,
          description: 'API development specialist',
          systemPrompt: 'You are a backend engineer.',
          capabilities: ['nestjs', 'postgresql'],
        })
        .expect(201);
      backendRoleId = backendRes.body.id;

      const frontendRes = await request(app.getHttpServer())
        .post('/api/roles')
        .send({
          organizationId,
          name: `Frontend Engineer ${testRunId}`,
          description: 'UI development specialist',
          systemPrompt: 'You are a frontend engineer.',
          capabilities: ['react', 'typescript'],
        })
        .expect(201);
      frontendRoleId = frontendRes.body.id;

      expect(backendRoleId).toBeDefined();
      expect(frontendRoleId).toBeDefined();
    });

    it('should create 2 hollons for Team A', async () => {
      const backendRes = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          organizationId,
          teamId: teamAId,
          roleId: backendRoleId,
          name: 'Team A Backend',
          systemPrompt: 'You handle Team A backend integration.',
          maxConcurrentTasks: 1,
        })
        .expect(201);
      hollonTeamABackendId = backendRes.body.id;

      const frontendRes = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          organizationId,
          teamId: teamAId,
          roleId: frontendRoleId,
          name: 'Team A Frontend',
          systemPrompt: 'You handle Team A frontend.',
          maxConcurrentTasks: 1,
        })
        .expect(201);
      hollonTeamAFrontendId = frontendRes.body.id;

      expect(hollonTeamABackendId).toBeDefined();
      expect(hollonTeamAFrontendId).toBeDefined();
    });

    it('should create 2 hollons for Team B', async () => {
      const backendRes = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          organizationId,
          teamId: teamBId,
          roleId: backendRoleId,
          name: 'Team B Backend',
          systemPrompt: 'You build platform APIs.',
          maxConcurrentTasks: 1,
        })
        .expect(201);
      hollonTeamBBackendId = backendRes.body.id;

      const frontendRes = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          organizationId,
          teamId: teamBId,
          roleId: frontendRoleId,
          name: 'Team B Frontend',
          systemPrompt: 'You handle Team B frontend.',
          maxConcurrentTasks: 1,
        })
        .expect(201);
      hollonTeamBFrontendId = frontendRes.body.id;

      expect(hollonTeamBBackendId).toBeDefined();
      expect(hollonTeamBFrontendId).toBeDefined();
    });

    it('should create projects for both teams', async () => {
      const projectARes = await request(app.getHttpServer())
        .post('/api/projects')
        .send({
          organizationId,
          name: 'Team A Client App',
          description: 'Client application project',
          workingDirectory: '/tmp/team-a-client',
        })
        .expect(201);
      projectTeamAId = projectARes.body.id;

      const projectBRes = await request(app.getHttpServer())
        .post('/api/projects')
        .send({
          organizationId,
          name: 'Team B Platform',
          description: 'Platform API project',
          workingDirectory: '/tmp/team-b-platform',
        })
        .expect(201);
      projectTeamBId = projectBRes.body.id;

      expect(projectTeamAId).toBeDefined();
      expect(projectTeamBId).toBeDefined();
    });
  });

  describe('Cross-Team Dependency Phase', () => {
    it('should create Task B (API to be provided by Team B)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          projectId: projectTeamBId,
          title: 'Build User Authentication API',
          description: 'Create /api/auth endpoints for Team A to consume',
          type: 'implementation',
          priority: 'P1',
          assignedHollonId: hollonTeamBBackendId,
          acceptanceCriteria: [
            'POST /api/auth/login',
            'POST /api/auth/logout',
            'GET /api/auth/me',
            'Return JWT tokens',
          ],
          affectedFiles: ['src/auth/auth.controller.ts'],
        })
        .expect(201);

      taskTeamBId = response.body.id;
      expect(taskTeamBId).toBeDefined();
    });

    it('should create Task A (depends on Team B API)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          projectId: projectTeamAId,
          title: 'Integrate Authentication in Client App',
          description: 'Use Team B auth API in our client',
          type: 'implementation',
          priority: 'P1',
          assignedHollonId: hollonTeamABackendId,
          acceptanceCriteria: [
            'Call Team B auth API',
            'Store JWT tokens',
            'Handle auth errors',
          ],
          affectedFiles: ['src/services/auth.service.ts'],
        })
        .expect(201);

      taskTeamAId = response.body.id;
      expect(taskTeamAId).toBeDefined();
    });

    it('should create cross-team contract', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/cross-team-collaboration/contracts')
        .send({
          requesterTeamId: teamAId,
          providerTeamId: teamBId,
          requestingTaskId: taskTeamAId,
          providingTaskId: taskTeamBId,
          description: 'Team A needs auth API from Team B',
          deliverables: [
            '/api/auth/login endpoint',
            '/api/auth/logout endpoint',
            '/api/auth/me endpoint',
            'API documentation',
          ],
          deadline: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000,
          ).toISOString(), // 7 days from now
        })
        .expect(201);

      contractId = response.body.id;
      expect(response.body.status).toBe(ContractStatus.PENDING);
      expect(response.body.requesterTeamId).toBe(teamAId);
      expect(response.body.providerTeamId).toBe(teamBId);
    });

    it('should negotiate contract (provider accepts)', async () => {
      const response = await request(app.getHttpServer())
        .patch(
          `/api/cross-team-collaboration/contracts/${contractId}/negotiate`,
        )
        .send({
          status: ContractStatus.ACCEPTED,
          providerNotes: 'We can deliver the auth API within the deadline',
        })
        .expect(200);

      expect(response.body.status).toBe(ContractStatus.ACCEPTED);
    });

    it('should verify contract is now active', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/cross-team-collaboration/contracts/${contractId}`)
        .expect(200);

      expect(response.body.status).toBe(ContractStatus.ACCEPTED);
      expect(response.body.providerNotes).toBeDefined();
    });

    it('should mark Team B task as completed', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskTeamBId}`)
        .send({
          status: 'completed',
        })
        .expect(200);

      expect(response.body.status).toBe('completed');
    });

    it('should confirm contract delivery', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/cross-team-collaboration/contracts/${contractId}/confirm`)
        .send({
          confirmedBy: hollonTeamABackendId,
          confirmationNotes: 'API received and tested successfully',
        })
        .expect(200);

      expect(response.body.status).toBe(ContractStatus.FULFILLED);
    });
  });

  describe('Verification Phase', () => {
    it('should verify all hollons belong to correct teams', async () => {
      const teamABackend = await request(app.getHttpServer())
        .get(`/api/hollons/${hollonTeamABackendId}`)
        .expect(200);
      expect(teamABackend.body.teamId).toBe(teamAId);

      const teamBBackend = await request(app.getHttpServer())
        .get(`/api/hollons/${hollonTeamBBackendId}`)
        .expect(200);
      expect(teamBBackend.body.teamId).toBe(teamBId);
    });

    it('should verify tasks belong to correct projects', async () => {
      const taskA = await request(app.getHttpServer())
        .get(`/api/tasks/${taskTeamAId}`)
        .expect(200);
      expect(taskA.body.projectId).toBe(projectTeamAId);

      const taskB = await request(app.getHttpServer())
        .get(`/api/tasks/${taskTeamBId}`)
        .expect(200);
      expect(taskB.body.projectId).toBe(projectTeamBId);
    });

    it('should verify contract is fulfilled', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/cross-team-collaboration/contracts/${contractId}`)
        .expect(200);

      expect(response.body.status).toBe(ContractStatus.FULFILLED);
      expect(response.body.confirmationNotes).toContain('tested successfully');
    });

    it('should verify Team B task is completed', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/tasks/${taskTeamBId}`)
        .expect(200);

      expect(response.body.status).toBe('completed');
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
