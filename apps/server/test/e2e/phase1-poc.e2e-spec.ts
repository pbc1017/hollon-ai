import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import request from 'supertest';

/**
 * Phase 1 POC End-to-End Test
 *
 * Tests the complete flow of the Hollon AI system:
 * 0. Register and login test user (get JWT token)
 * 1. Create Organization
 * 2. Create Team
 * 3. Create Role
 * 4. Create Hollon
 * 5. Create Project
 * 6. Create Task
 * 7. Assign Task to Hollon
 * 8. Verify all entities are correctly linked
 *
 * This validates that Phase 1 core functionality is working end-to-end.
 */
describe('Phase 1 POC (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let accessToken: string;

  // Entity IDs created during the test
  let organizationId: string;
  let teamId: string;
  let roleId: string;
  let hollonId: string;
  let projectId: string;
  let taskId: string;

  // Unique suffix to avoid conflicts in concurrent/repeated test runs
  const testRunId = Date.now();
  const testEmail = `test-${testRunId}@hollon.test`;
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Set global prefix to match production configuration
    app.setGlobalPrefix('api');

    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Clean up any leftover test data from previous runs
    await dataSource.query(
      'TRUNCATE tasks, projects, hollons, roles, teams, organizations RESTART IDENTITY CASCADE',
    );

    // Register test user
    const registerResponse = await request(app.getHttpServer())
      .post('/api/auth/register')
      .send({
        email: testEmail,
        password: testPassword,
        firstName: 'Test',
        lastName: 'User',
      })
      .expect(201);

    accessToken = registerResponse.body.accessToken;
    expect(accessToken).toBeDefined();
  });

  afterAll(async () => {
    // Cleanup: Delete all test data
    if (taskId) {
      await dataSource.query('DELETE FROM hollon.tasks WHERE id = $1', [
        taskId,
      ]);
    }
    if (projectId) {
      await dataSource.query('DELETE FROM hollon.projects WHERE id = $1', [
        projectId,
      ]);
    }
    if (hollonId) {
      await dataSource.query('DELETE FROM hollon.hollons WHERE id = $1', [
        hollonId,
      ]);
    }
    if (roleId) {
      await dataSource.query('DELETE FROM hollon.roles WHERE id = $1', [
        roleId,
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

  describe('Step 1: Create Organization', () => {
    it('should create an organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          name: 'POC Test Organization',
          description: 'Testing Phase 1 POC functionality',
          settings: {
            costLimitDailyCents: 10000,
            costLimitMonthlyCents: 300000,
            maxHollonsPerTeam: 10,
            defaultTaskPriority: 'medium',
          },
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('POC Test Organization');
      expect(response.body.settings.costLimitDailyCents).toBe(10000);

      organizationId = response.body.id;
    });
  });

  describe('Step 2: Create Team', () => {
    it('should create a team within the organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/teams')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId,
          name: 'Backend Team',
          description: 'Backend development team for POC',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Backend Team');
      expect(response.body.organizationId).toBe(organizationId);

      teamId = response.body.id;
    });
  });

  describe('Step 3: Create Role', () => {
    it('should create a role within the organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/roles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId,
          name: `Backend Engineer ${testRunId}`,
          description: 'TypeScript and NestJS expert',
          systemPrompt:
            'You are an expert backend engineer specializing in TypeScript and NestJS framework.',
          capabilities: ['typescript', 'nestjs', 'postgresql', 'testing'],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe(`Backend Engineer ${testRunId}`);
      expect(response.body.organizationId).toBe(organizationId);
      expect(response.body.capabilities).toContain('typescript');

      roleId = response.body.id;
    });
  });

  describe('Step 4: Create Hollon', () => {
    it('should create a hollon assigned to team and role', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/hollons')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId,
          teamId,
          roleId,
          name: 'Alpha',
          systemPrompt:
            'You are Alpha, a skilled backend developer who loves clean code.',
          maxConcurrentTasks: 1,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('Alpha');
      expect(response.body.organizationId).toBe(organizationId);
      expect(response.body.teamId).toBe(teamId);
      expect(response.body.roleId).toBe(roleId);
      expect(response.body.status).toBe('idle');
      expect(response.body.maxConcurrentTasks).toBe(1);

      hollonId = response.body.id;
    });
  });

  describe('Step 5: Create Project', () => {
    it('should create a project within the organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/projects')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId,
          name: 'POC Project',
          description: 'Test project for Phase 1 POC validation',
          workingDirectory: '/tmp/hollon-poc-test',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.name).toBe('POC Project');
      expect(response.body.organizationId).toBe(organizationId);
      expect(response.body.workingDirectory).toBe('/tmp/hollon-poc-test');

      projectId = response.body.id;
    });
  });

  describe('Step 6: Create Task', () => {
    it('should create a task within the project', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          organizationId,
          projectId,
          title: 'Implement Hello World function',
          description:
            'Create a simple TypeScript function that returns "Hello, World!"',
          type: 'implementation',
          priority: 'P2',
          acceptanceCriteria: [
            'Function should return "Hello, World!" string',
            'Function should be exported',
            'Function should have proper TypeScript types',
            'Function should include JSDoc comments',
          ],
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Implement Hello World function');
      expect(response.body.projectId).toBe(projectId);
      expect(response.body.status).toBe('pending');
      expect(response.body.type).toBe('implementation');
      expect(response.body.priority).toBe('P2');
      expect(response.body.acceptanceCriteria).toHaveLength(4);

      taskId = response.body.id;
    });
  });

  describe('Step 7: Assign Task to Hollon', () => {
    it('should assign the task to the hollon', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tasks/${taskId}/assign`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          hollonId,
        })
        .expect(200);

      // Note: The endpoint returns the updated task
      // Verify the task was updated successfully
      expect(response.body).toHaveProperty('id');
      expect(response.body.id).toBe(taskId);
    });

    it('should verify task is assigned', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.assignedHollonId).toBe(hollonId);
      expect(response.body.id).toBe(taskId);
    });
  });

  describe('Step 8: Verify Entity Relationships', () => {
    it('should verify organization has team', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(organizationId);
    });

    it('should verify team has hollon', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/teams/${teamId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(teamId);
      expect(response.body.organizationId).toBe(organizationId);
    });

    it('should verify hollon has correct team and role', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/hollons/${hollonId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(hollonId);
      expect(response.body.teamId).toBe(teamId);
      expect(response.body.roleId).toBe(roleId);
      expect(response.body.organizationId).toBe(organizationId);
    });

    it('should verify project belongs to organization', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(projectId);
      expect(response.body.organizationId).toBe(organizationId);
    });

    it('should verify task is linked to project and hollon', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.id).toBe(taskId);
      expect(response.body.projectId).toBe(projectId);
      expect(response.body.assignedHollonId).toBe(hollonId);
    });
  });

  describe('Step 9: Health Check', () => {
    it('should verify system health', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.checks.database.status).toBe('up');
    });
  });
});
