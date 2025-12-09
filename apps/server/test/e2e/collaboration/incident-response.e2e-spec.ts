import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { HollonStatus } from '../../../src/modules/hollon/entities/hollon.entity';
import {
  IncidentSeverity,
  IncidentStatus,
} from '../../../src/modules/incident/entities/incident.entity';

/**
 * Scenario 3: Incident Response E2E Test
 *
 * Tests P1-P4 incident handling and escalation:
 * 1. Setup: Create organization → team → 3 hollons
 * 2. Create P1 (critical) incident
 * 3. Verify non-essential tasks are paused
 * 4. Assign incident to hollon
 * 5. Resolve incident
 * 6. Generate postmortem
 * 7. Verify normal operations resume
 */
describe.skip('Incident Response E2E (Scenario 3)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Entity IDs
  let organizationId: string;
  let teamId: string;
  let backendRoleId: string;
  let hollonAlphaId: string;
  let hollonBetaId: string;
  let hollonGammaId: string;
  let projectId: string;
  let criticalTaskId: string;
  let normalTask1Id: string;
  let normalTask2Id: string;
  let incidentId: string;

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
    if (incidentId)
      await dataSource.query('DELETE FROM incidents WHERE id = $1', [
        incidentId,
      ]);
    if (criticalTaskId)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [
        criticalTaskId,
      ]);
    if (normalTask1Id)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [
        normalTask1Id,
      ]);
    if (normalTask2Id)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [
        normalTask2Id,
      ]);
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
    if (backendRoleId)
      await dataSource.query('DELETE FROM roles WHERE id = $1', [
        backendRoleId,
      ]);
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
          name: `Incident Response Org ${testRunId}`,
          description: 'Testing incident response',
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
          name: 'Backend Team',
          description: 'Team handling backend services',
        })
        .expect(201);

      teamId = response.body.id;
      expect(teamId).toBeDefined();
    });

    it('should create backend role', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/roles')
        .send({
          organizationId,
          name: `Backend Engineer ${testRunId}`,
          description: 'Backend specialist',
          systemPrompt: 'You are a backend engineer.',
          capabilities: ['nestjs', 'postgresql', 'debugging'],
        })
        .expect(201);

      backendRoleId = response.body.id;
      expect(backendRoleId).toBeDefined();
    });

    it('should create 3 hollons', async () => {
      const alphaRes = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          organizationId,
          teamId,
          roleId: backendRoleId,
          name: 'Alpha',
          systemPrompt: 'You are Alpha, a backend developer.',
          maxConcurrentTasks: 1,
        })
        .expect(201);
      hollonAlphaId = alphaRes.body.id;
      expect(alphaRes.body.status).toBe(HollonStatus.IDLE);

      const betaRes = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          organizationId,
          teamId,
          roleId: backendRoleId,
          name: 'Beta',
          systemPrompt: 'You are Beta, a backend developer.',
          maxConcurrentTasks: 1,
        })
        .expect(201);
      hollonBetaId = betaRes.body.id;
      expect(betaRes.body.status).toBe(HollonStatus.IDLE);

      const gammaRes = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          organizationId,
          teamId,
          roleId: backendRoleId,
          name: 'Gamma',
          systemPrompt: 'You are Gamma, a backend developer.',
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
          name: 'Backend Service Project',
          description: 'Project for backend services',
          workingDirectory: '/tmp/backend-service',
        })
        .expect(201);

      projectId = response.body.id;
      expect(projectId).toBeDefined();
    });

    it('should create normal priority tasks', async () => {
      const task1Res = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          projectId,
          title: 'Add User Profile Feature',
          description: 'Low priority feature development',
          type: 'implementation',
          priority: 'P3',
          assignedHollonId: hollonBetaId,
          acceptanceCriteria: ['Profile CRUD endpoints', 'Unit tests'],
          affectedFiles: ['src/profile/profile.controller.ts'],
        })
        .expect(201);
      normalTask1Id = task1Res.body.id;

      const task2Res = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          projectId,
          title: 'Refactor Logging',
          description: 'Code quality improvement',
          type: 'refactoring',
          priority: 'P4',
          assignedHollonId: hollonGammaId,
          acceptanceCriteria: ['Consistent log format', 'Remove duplicates'],
          affectedFiles: ['src/common/logger.ts'],
        })
        .expect(201);
      normalTask2Id = task2Res.body.id;

      expect(normalTask1Id).toBeDefined();
      expect(normalTask2Id).toBeDefined();
    });
  });

  describe('Incident Creation Phase', () => {
    it('should create a P1 critical incident', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/incidents')
        .send({
          organizationId,
          teamId,
          title: 'Database Connection Pool Exhausted',
          description:
            'Production API is down - database connections maxed out',
          severity: IncidentSeverity.P1,
          affectedServices: ['api-gateway', 'user-service', 'order-service'],
          detectedBy: hollonAlphaId,
        })
        .expect(201);

      incidentId = response.body.id;
      expect(response.body.status).toBe(IncidentStatus.OPEN);
      expect(response.body.severity).toBe(IncidentSeverity.P1);
      expect(response.body.organizationId).toBe(organizationId);
    });

    it('should verify incident was classified correctly', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/incidents/${incidentId}`)
        .expect(200);

      expect(response.body.severity).toBe(IncidentSeverity.P1);
      expect(response.body.title).toContain('Database Connection');
    });

    it('should pause non-essential tasks for P1 incident', async () => {
      // This would typically be triggered automatically by the incident service
      // For E2E test, we simulate the pause mechanism
      const task1Update = await request(app.getHttpServer())
        .patch(`/api/tasks/${normalTask1Id}`)
        .send({
          status: 'blocked',
          blockedReason: `Paused due to P1 incident ${incidentId}`,
        })
        .expect(200);

      expect(task1Update.body.status).toBe('blocked');
      expect(task1Update.body.blockedReason).toContain('P1 incident');

      const task2Update = await request(app.getHttpServer())
        .patch(`/api/tasks/${normalTask2Id}`)
        .send({
          status: 'blocked',
          blockedReason: `Paused due to P1 incident ${incidentId}`,
        })
        .expect(200);

      expect(task2Update.body.status).toBe('blocked');
    });
  });

  describe('Incident Resolution Phase', () => {
    it('should create critical task for incident', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          projectId,
          title: 'Fix Database Connection Pool',
          description: 'Increase pool size and fix connection leaks',
          type: 'bug_fix',
          priority: 'P0', // P0 for incident-related tasks
          assignedHollonId: hollonAlphaId,
          acceptanceCriteria: [
            'Increase pool size to 100',
            'Fix unclosed connections',
            'Add connection monitoring',
            'Verify production recovery',
          ],
          affectedFiles: ['src/config/database.config.ts'],
        })
        .expect(201);

      criticalTaskId = response.body.id;
      expect(criticalTaskId).toBeDefined();
    });

    it('should assign incident to hollon', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/incidents/${incidentId}`)
        .send({
          assignedHollonId: hollonAlphaId,
          status: IncidentStatus.IN_PROGRESS,
        })
        .expect(200);

      expect(response.body.assignedHollonId).toBe(hollonAlphaId);
      expect(response.body.status).toBe(IncidentStatus.IN_PROGRESS);
    });

    it('should add timeline entry for incident', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/incidents/${incidentId}/timeline`)
        .send({
          action: 'investigation_started',
          description: 'Alpha started investigating connection pool exhaustion',
          performedBy: hollonAlphaId,
          metadata: {
            currentPoolSize: 20,
            activeConnections: 20,
            waitingQueries: 150,
          },
        })
        .expect(201);

      expect(response.body.action).toBe('investigation_started');
      expect(response.body.incidentId).toBe(incidentId);
    });

    it('should mark critical task as completed', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tasks/${criticalTaskId}`)
        .send({
          status: 'completed',
        })
        .expect(200);

      expect(response.body.status).toBe('completed');
    });

    it('should resolve the incident', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/incidents/${incidentId}`)
        .send({
          status: IncidentStatus.RESOLVED,
          resolutionSummary:
            'Increased connection pool to 100 and fixed 3 connection leaks',
        })
        .expect(200);

      expect(response.body.status).toBe(IncidentStatus.RESOLVED);
      expect(response.body.resolutionSummary).toContain('Increased connection');
    });

    it('should generate postmortem', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/incidents/${incidentId}/postmortem`)
        .send({
          rootCause:
            'Connection pool size (20) was too small for production traffic',
          impactAnalysis:
            '30 minutes downtime, 500+ users affected, $5000 estimated revenue loss',
          actionItems: [
            'Monitor connection pool usage',
            'Add alerts for pool > 80% utilization',
            'Review all repositories for connection leaks',
            'Update deployment checklist',
          ],
          lessonsLearned: [
            'Need better connection pool monitoring',
            'Should have load tested with realistic traffic',
          ],
        })
        .expect(201);

      expect(response.body.rootCause).toContain('Connection pool size');
      expect(response.body.actionItems).toHaveLength(4);
      expect(response.body.incidentId).toBe(incidentId);
    });
  });

  describe('Recovery Phase', () => {
    it('should unblock normal tasks after incident resolution', async () => {
      const task1Update = await request(app.getHttpServer())
        .patch(`/api/tasks/${normalTask1Id}`)
        .send({
          status: 'pending',
          blockedReason: null,
        })
        .expect(200);

      expect(task1Update.body.status).toBe('pending');
      expect(task1Update.body.blockedReason).toBeNull();

      const task2Update = await request(app.getHttpServer())
        .patch(`/api/tasks/${normalTask2Id}`)
        .send({
          status: 'pending',
          blockedReason: null,
        })
        .expect(200);

      expect(task2Update.body.status).toBe('pending');
    });

    it('should verify all hollons returned to IDLE', async () => {
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

    it('should verify incident is resolved', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/incidents/${incidentId}`)
        .expect(200);

      expect(response.body.status).toBe(IncidentStatus.RESOLVED);
      expect(response.body.resolutionSummary).toBeDefined();
    });

    it('should verify postmortem exists', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/incidents/${incidentId}/postmortem`)
        .expect(200);

      expect(response.body.rootCause).toBeDefined();
      expect(response.body.actionItems.length).toBeGreaterThan(0);
      expect(response.body.lessonsLearned.length).toBeGreaterThan(0);
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
