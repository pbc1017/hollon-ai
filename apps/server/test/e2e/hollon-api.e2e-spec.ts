import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../src/app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Hollon,
  HollonStatus,
  HollonLifecycle,
} from '../../src/modules/hollon/entities/hollon.entity';
import { Organization } from '../../src/modules/organization/entities/organization.entity';
import { Role } from '../../src/modules/role/entities/role.entity';
import { Team } from '../../src/modules/team/entities/team.entity';

describe('Hollon API (e2e)', () => {
  let app: INestApplication;
  let hollonRepo: Repository<Hollon>;
  let orgRepo: Repository<Organization>;
  let roleRepo: Repository<Role>;
  let teamRepo: Repository<Team>;

  let testOrg: Organization;
  let testTeam: Team;
  let testRole: Role;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    hollonRepo = moduleFixture.get<Repository<Hollon>>(
      getRepositoryToken(Hollon),
    );
    orgRepo = moduleFixture.get<Repository<Organization>>(
      getRepositoryToken(Organization),
    );
    roleRepo = moduleFixture.get<Repository<Role>>(getRepositoryToken(Role));
    teamRepo = moduleFixture.get<Repository<Team>>(getRepositoryToken(Team));
  });

  beforeEach(async () => {
    testOrg = await orgRepo.save(
      orgRepo.create({
        name: 'E2E Hollon Org',
        description: 'Organization for hollon E2E tests',
        settings: {
          costLimitDailyCents: 10000,
          costLimitMonthlyCents: 100000,
          maxHollonsPerTeam: 10,
          defaultTaskPriority: 'medium',
        },
      }),
    );

    testRole = await roleRepo.save(
      roleRepo.create({
        organizationId: testOrg.id,
        name: 'E2ERole',
        description: 'E2E test role',
        systemPrompt: 'You are an E2E test hollon',
        capabilities: ['typescript', 'testing'],
      }),
    );

    testTeam = await teamRepo.save(
      teamRepo.create({
        organizationId: testOrg.id,
        name: 'E2E Hollon Team',
        description: 'E2E test team',
      }),
    );
  });

  afterEach(async () => {
    await hollonRepo.delete({ organizationId: testOrg.id });
    await teamRepo.delete({ id: testTeam.id });
    await roleRepo.delete({ id: testRole.id });
    await orgRepo.delete({ id: testOrg.id });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/hollons', () => {
    it('should create a new hollon', () => {
      return request(app.getHttpServer())
        .post('/api/v1/hollons')
        .send({
          name: 'E2E Test Hollon',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.name).toBe('E2E Test Hollon');
          expect(res.body.status).toBe(HollonStatus.IDLE);
          expect(res.body.lifecycle).toBe(HollonLifecycle.PERMANENT);
        });
    });

    it('should validate required fields', () => {
      return request(app.getHttpServer())
        .post('/api/v1/hollons')
        .send({
          organizationId: testOrg.id,
          teamId: testTeam.id,
        })
        .expect(400);
    });

    it('should set default values correctly', () => {
      return request(app.getHttpServer())
        .post('/api/v1/hollons')
        .send({
          name: 'Default Values Test',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.maxConcurrentTasks).toBe(1);
          expect(res.body.lifecycle).toBe(HollonLifecycle.PERMANENT);
        });
    });
  });

  describe('GET /api/v1/hollons/:id', () => {
    it('should retrieve a hollon by id', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/hollons')
        .send({
          name: 'Retrieve Test Hollon',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
        });

      const hollonId = created.body.id;

      return request(app.getHttpServer())
        .get(`/api/v1/hollons/${hollonId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(hollonId);
          expect(res.body.name).toBe('Retrieve Test Hollon');
          expect(res.body).toHaveProperty('organization');
          expect(res.body).toHaveProperty('team');
          expect(res.body).toHaveProperty('role');
        });
    });

    it('should return 404 for non-existent hollon', () => {
      return request(app.getHttpServer())
        .get('/api/v1/hollons/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('GET /api/v1/organizations/:orgId/hollons/idle', () => {
    it('should retrieve idle hollons for an organization', async () => {
      // Create idle hollon
      await request(app.getHttpServer()).post('/api/v1/hollons').send({
        name: 'Idle Hollon 1',
        organizationId: testOrg.id,
        teamId: testTeam.id,
        roleId: testRole.id,
        brainProviderId: 'claude_code',
      });

      // Create another idle hollon
      await request(app.getHttpServer()).post('/api/v1/hollons').send({
        name: 'Idle Hollon 2',
        organizationId: testOrg.id,
        teamId: testTeam.id,
        roleId: testRole.id,
        brainProviderId: 'claude_code',
      });

      // Create working hollon
      const workingHollon = await request(app.getHttpServer())
        .post('/api/v1/hollons')
        .send({
          name: 'Working Hollon',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
        });

      // Set to working status
      await request(app.getHttpServer())
        .patch(`/api/v1/hollons/${workingHollon.body.id}/status`)
        .send({ status: HollonStatus.WORKING });

      // Get idle hollons
      return request(app.getHttpServer())
        .get(`/api/v1/organizations/${testOrg.id}/hollons/idle`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBe(2);
          expect(res.body.every((h) => h.status === HollonStatus.IDLE)).toBe(
            true,
          );
        });
    });
  });

  describe('PATCH /api/v1/hollons/:id/status', () => {
    it('should update hollon status to WORKING', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/hollons')
        .send({
          name: 'Status Test Hollon',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
        });

      const hollonId = created.body.id;

      return request(app.getHttpServer())
        .patch(`/api/v1/hollons/${hollonId}/status`)
        .send({ status: HollonStatus.WORKING })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(HollonStatus.WORKING);
          expect(res.body.lastActiveAt).toBeDefined();
        });
    });

    it('should update hollon status to IDLE', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/hollons')
        .send({
          name: 'Status Test Hollon',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
        });

      const hollonId = created.body.id;

      // Set to WORKING first
      await request(app.getHttpServer())
        .patch(`/api/v1/hollons/${hollonId}/status`)
        .send({ status: HollonStatus.WORKING });

      // Set back to IDLE
      return request(app.getHttpServer())
        .patch(`/api/v1/hollons/${hollonId}/status`)
        .send({ status: HollonStatus.IDLE })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(HollonStatus.IDLE);
        });
    });

    it('should validate status enum values', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/hollons')
        .send({
          name: 'Status Test Hollon',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
        });

      return request(app.getHttpServer())
        .patch(`/api/v1/hollons/${created.body.id}/status`)
        .send({ status: 'INVALID_STATUS' })
        .expect(400);
    });
  });

  describe('POST /api/v1/hollons/temporary', () => {
    it('should create a temporary hollon without approval', async () => {
      const parentHollon = await request(app.getHttpServer())
        .post('/api/v1/hollons')
        .send({
          name: 'Parent Hollon',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
        });

      return request(app.getHttpServer())
        .post('/api/v1/hollons/temporary')
        .send({
          name: 'Temp Hollon',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
          createdBy: parentHollon.body.id,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.lifecycle).toBe(HollonLifecycle.TEMPORARY);
          expect(res.body.createdByHollonId).toBe(parentHollon.body.id);
          expect(res.body.status).toBe(HollonStatus.IDLE);
        });
    });
  });

  describe('POST /api/v1/hollons/permanent', () => {
    it('should create approval request for permanent hollon', async () => {
      const requestingHollon = await request(app.getHttpServer())
        .post('/api/v1/hollons')
        .send({
          name: 'Requesting Hollon',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
        });

      return request(app.getHttpServer())
        .post('/api/v1/hollons/permanent')
        .send({
          name: 'Permanent Hollon Request',
          organizationId: testOrg.id,
          roleName: testRole.name,
          roleId: testRole.id,
          teamId: testTeam.id,
          brainProviderId: 'claude_code',
          createdBy: requestingHollon.body.id,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.requestType).toBe('CREATE_PERMANENT_HOLLON');
          expect(res.body.status).toBe('PENDING');
        });
    });
  });

  describe('DELETE /api/v1/hollons/:id', () => {
    it('should delete a temporary hollon directly', async () => {
      const parentHollon = await request(app.getHttpServer())
        .post('/api/v1/hollons')
        .send({
          name: 'Parent Hollon',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
        });

      const tempHollon = await request(app.getHttpServer())
        .post('/api/v1/hollons/temporary')
        .send({
          name: 'Temp Hollon to Delete',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
          createdBy: parentHollon.body.id,
        });

      const hollonId = tempHollon.body.id;

      await request(app.getHttpServer())
        .delete(`/api/v1/hollons/${hollonId}`)
        .expect(200);

      // Verify deletion
      return request(app.getHttpServer())
        .get(`/api/v1/hollons/${hollonId}`)
        .expect(404);
    });
  });

  describe('POST /api/v1/hollons/:id/request-delete', () => {
    it('should create approval request for deleting permanent hollon', async () => {
      const permanentHollon = await request(app.getHttpServer())
        .post('/api/v1/hollons')
        .send({
          name: 'Permanent Hollon to Delete',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
        });

      const hollonId = permanentHollon.body.id;

      return request(app.getHttpServer())
        .post(`/api/v1/hollons/${hollonId}/request-delete`)
        .send({ requestedBy: 'user-123' })
        .expect(201)
        .expect((res) => {
          expect(res.body.requestType).toBe('DELETE_PERMANENT_HOLLON');
          expect(res.body.status).toBe('PENDING');
        });
    });

    it('should reject deletion request for temporary hollon', async () => {
      const parentHollon = await request(app.getHttpServer())
        .post('/api/v1/hollons')
        .send({
          name: 'Parent Hollon',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
        });

      const tempHollon = await request(app.getHttpServer())
        .post('/api/v1/hollons/temporary')
        .send({
          name: 'Temp Hollon',
          organizationId: testOrg.id,
          teamId: testTeam.id,
          roleId: testRole.id,
          brainProviderId: 'claude_code',
          createdBy: parentHollon.body.id,
        });

      return request(app.getHttpServer())
        .post(`/api/v1/hollons/${tempHollon.body.id}/request-delete`)
        .send({ requestedBy: 'user-123' })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain(
            'Only permanent hollons require approval',
          );
        });
    });
  });
});
