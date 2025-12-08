import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { HollonStatus } from '../../../src/modules/hollon/entities/hollon.entity';
import {
  ConflictType,
  ConflictResolutionStrategy,
} from '../../../src/modules/conflict-resolution/entities/conflict.entity';

/**
 * Scenario 4: File Conflict Resolution E2E Test
 *
 * Tests concurrent file editing conflict resolution:
 * 1. Setup: Create organization → team → 2 hollons → project
 * 2. Both hollons assigned tasks affecting same file
 * 3. Detect file conflict
 * 4. Apply conflict resolution strategy
 * 5. Verify conflict resolved
 * 6. Verify both tasks can proceed
 */
describe('File Conflict Resolution E2E (Scenario 4)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Entity IDs
  let organizationId: string;
  let teamId: string;
  let backendRoleId: string;
  let hollonAlphaId: string;
  let hollonBetaId: string;
  let projectId: string;
  let task1Id: string;
  let task2Id: string;
  let conflictId: string;

  const testRunId = Date.now();
  const conflictingFile = 'src/users/user.service.ts';

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
    if (conflictId)
      await dataSource.query('DELETE FROM conflicts WHERE id = $1', [
        conflictId,
      ]);
    if (task1Id)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [task1Id]);
    if (task2Id)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [task2Id]);
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
          name: `File Conflict Org ${testRunId}`,
          description: 'Testing file conflict resolution',
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
          description: 'Team working on backend services',
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
          description: 'Backend development specialist',
          systemPrompt: 'You are a backend engineer.',
          capabilities: ['nestjs', 'typescript', 'git'],
        })
        .expect(201);

      backendRoleId = response.body.id;
      expect(backendRoleId).toBeDefined();
    });

    it('should create 2 hollons', async () => {
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
    });

    it('should create project', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/projects')
        .send({
          organizationId,
          name: 'User Service Project',
          description: 'Project for user management service',
          workingDirectory: '/tmp/user-service',
        })
        .expect(201);

      projectId = response.body.id;
      expect(projectId).toBeDefined();
    });
  });

  describe('Conflict Creation Phase', () => {
    it('should create Task 1 (Alpha: Add validation)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          projectId,
          title: 'Add Email Validation',
          description: 'Add email format validation to user creation',
          type: 'implementation',
          priority: 'P2',
          assignedHollonId: hollonAlphaId,
          acceptanceCriteria: [
            'Validate email format',
            'Return proper error message',
            'Add unit tests',
          ],
          affectedFiles: [conflictingFile],
        })
        .expect(201);

      task1Id = response.body.id;
      expect(task1Id).toBeDefined();
    });

    it('should create Task 2 (Beta: Add password hashing)', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          projectId,
          title: 'Add Password Hashing',
          description: 'Hash passwords using bcrypt before storing',
          type: 'implementation',
          priority: 'P2',
          assignedHollonId: hollonBetaId,
          acceptanceCriteria: [
            'Use bcrypt for hashing',
            'Salt rounds = 10',
            'Add unit tests',
          ],
          affectedFiles: [conflictingFile],
        })
        .expect(201);

      task2Id = response.body.id;
      expect(task2Id).toBeDefined();
    });

    it('should start both tasks (simulating concurrent work)', async () => {
      const task1Update = await request(app.getHttpServer())
        .patch(`/api/tasks/${task1Id}`)
        .send({
          status: 'in_progress',
        })
        .expect(200);
      expect(task1Update.body.status).toBe('in_progress');

      const task2Update = await request(app.getHttpServer())
        .patch(`/api/tasks/${task2Id}`)
        .send({
          status: 'in_progress',
        })
        .expect(200);
      expect(task2Update.body.status).toBe('in_progress');
    });

    it('should detect file conflict', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/conflict-resolution/conflicts')
        .send({
          organizationId,
          type: ConflictType.FILE_CONFLICT,
          description: `Both hollons editing ${conflictingFile}`,
          involvedHollonIds: [hollonAlphaId, hollonBetaId],
          involvedTaskIds: [task1Id, task2Id],
          conflictData: {
            filePath: conflictingFile,
            hollon1Changes: 'Added email validation in createUser method',
            hollon2Changes: 'Added password hashing in createUser method',
            conflictingLines: '45-60',
          },
        })
        .expect(201);

      conflictId = response.body.id;
      expect(response.body.type).toBe(ConflictType.FILE_CONFLICT);
      expect(response.body.status).toBe('pending');
      expect(response.body.involvedHollonIds).toHaveLength(2);
    });
  });

  describe('Conflict Resolution Phase', () => {
    it('should analyze conflict and suggest resolution', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/conflict-resolution/conflicts/${conflictId}/analyze`)
        .send({
          analyzedBy: hollonAlphaId,
        })
        .expect(201);

      expect(response.body.conflictId).toBe(conflictId);
      expect(response.body.analysis).toBeDefined();
    });

    it('should resolve conflict using sequential strategy', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/conflict-resolution/conflicts/${conflictId}/resolve`)
        .send({
          strategy: ConflictResolutionStrategy.SEQUENTIAL,
          resolutionData: {
            order: [task1Id, task2Id], // Alpha first, then Beta
            reason:
              'Email validation should be added first, then password hashing',
            mergeInstructions:
              'Alpha completes first, Beta rebases and continues',
          },
          resolvedBy: hollonAlphaId,
        })
        .expect(201);

      expect(response.body.strategy).toBe(
        ConflictResolutionStrategy.SEQUENTIAL,
      );
      expect(response.body.status).toBe('resolved');
    });

    it('should verify conflict is resolved', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/conflict-resolution/conflicts/${conflictId}`)
        .expect(200);

      expect(response.body.status).toBe('resolved');
      expect(response.body.strategy).toBe(
        ConflictResolutionStrategy.SEQUENTIAL,
      );
      expect(response.body.resolutionData).toBeDefined();
    });

    it('should block Task 2 until Task 1 completes', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tasks/${task2Id}`)
        .send({
          status: 'blocked',
          blockedReason: `Waiting for Task ${task1Id} to complete due to file conflict`,
        })
        .expect(200);

      expect(response.body.status).toBe('blocked');
      expect(response.body.blockedReason).toContain('file conflict');
    });

    it('should complete Task 1 (Alpha)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tasks/${task1Id}`)
        .send({
          status: 'completed',
        })
        .expect(200);

      expect(response.body.status).toBe('completed');
    });

    it('should unblock Task 2 after Task 1 completion', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tasks/${task2Id}`)
        .send({
          status: 'in_progress',
          blockedReason: null,
        })
        .expect(200);

      expect(response.body.status).toBe('in_progress');
      expect(response.body.blockedReason).toBeNull();
    });

    it('should complete Task 2 (Beta)', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/tasks/${task2Id}`)
        .send({
          status: 'completed',
        })
        .expect(200);

      expect(response.body.status).toBe('completed');
    });
  });

  describe('Verification Phase', () => {
    it('should verify both tasks completed successfully', async () => {
      const task1Res = await request(app.getHttpServer())
        .get(`/api/tasks/${task1Id}`)
        .expect(200);
      expect(task1Res.body.status).toBe('completed');

      const task2Res = await request(app.getHttpServer())
        .get(`/api/tasks/${task2Id}`)
        .expect(200);
      expect(task2Res.body.status).toBe('completed');
    });

    it('should verify conflict is resolved', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/conflict-resolution/conflicts/${conflictId}`)
        .expect(200);

      expect(response.body.status).toBe('resolved');
      expect(response.body.strategy).toBe(
        ConflictResolutionStrategy.SEQUENTIAL,
      );
    });

    it('should verify no more conflicts exist', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/conflict-resolution/conflicts')
        .query({
          organizationId,
          status: 'pending',
        })
        .expect(200);

      // Filter to only conflicts created in this test
      const pendingConflicts = (response.body as Array<{ id: string }>).filter(
        (c) => c.id === conflictId,
      );
      expect(pendingConflicts).toHaveLength(0);
    });

    it('should verify both hollons returned to IDLE', async () => {
      const alphaRes = await request(app.getHttpServer())
        .get(`/api/hollons/${hollonAlphaId}`)
        .expect(200);
      expect(alphaRes.body.status).toBe(HollonStatus.IDLE);

      const betaRes = await request(app.getHttpServer())
        .get(`/api/hollons/${hollonBetaId}`)
        .expect(200);
      expect(betaRes.body.status).toBe(HollonStatus.IDLE);
    });

    it('should verify both hollons belong to same team', async () => {
      const alphaRes = await request(app.getHttpServer())
        .get(`/api/hollons/${hollonAlphaId}`)
        .expect(200);
      expect(alphaRes.body.teamId).toBe(teamId);

      const betaRes = await request(app.getHttpServer())
        .get(`/api/hollons/${hollonBetaId}`)
        .expect(200);
      expect(betaRes.body.teamId).toBe(teamId);
    });

    it('should verify system health', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
      expect(response.body.checks.database.status).toBe('up');
    });
  });

  describe('Alternative Resolution Strategy', () => {
    it('should demonstrate parallel strategy for different sections', async () => {
      // This test demonstrates how PARALLEL strategy would work
      // when hollons edit different sections of the same file

      const task3Res = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          projectId,
          title: 'Add User Deletion',
          description: 'Add soft delete functionality',
          type: 'implementation',
          priority: 'P2',
          assignedHollonId: hollonAlphaId,
          affectedFiles: [conflictingFile],
        })
        .expect(201);

      const task4Res = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          projectId,
          title: 'Add User Search',
          description: 'Add search by username/email',
          type: 'implementation',
          priority: 'P2',
          assignedHollonId: hollonBetaId,
          affectedFiles: [conflictingFile],
        })
        .expect(201);

      const conflictRes = await request(app.getHttpServer())
        .post('/api/conflict-resolution/conflicts')
        .send({
          organizationId,
          type: ConflictType.FILE_CONFLICT,
          description: `Hollons editing different methods in ${conflictingFile}`,
          involvedHollonIds: [hollonAlphaId, hollonBetaId],
          involvedTaskIds: [task3Res.body.id, task4Res.body.id],
          conflictData: {
            filePath: conflictingFile,
            hollon1Changes: 'Adding deleteUser method (lines 80-95)',
            hollon2Changes: 'Adding searchUsers method (lines 100-120)',
            conflictingLines: 'none',
          },
        })
        .expect(201);

      const resolveRes = await request(app.getHttpServer())
        .post(
          `/api/conflict-resolution/conflicts/${conflictRes.body.id}/resolve`,
        )
        .send({
          strategy: ConflictResolutionStrategy.PARALLEL,
          resolutionData: {
            reason: 'Changes are in different methods, no actual conflict',
            mergeInstructions: 'Both can proceed, will merge automatically',
          },
          resolvedBy: hollonAlphaId,
        })
        .expect(201);

      expect(resolveRes.body.strategy).toBe(
        ConflictResolutionStrategy.PARALLEL,
      );

      // Cleanup
      await dataSource.query('DELETE FROM conflicts WHERE id = $1', [
        conflictRes.body.id,
      ]);
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [
        task3Res.body.id,
      ]);
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [
        task4Res.body.id,
      ]);
    });
  });
});
