import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../../src/app.module';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  Task,
  TaskStatus,
  TaskPriority,
} from '../../../src/modules/task/entities/task.entity';
import {
  Project,
  ProjectStatus,
} from '../../../src/modules/project/entities/project.entity';
import { Organization } from '../../../src/modules/organization/entities/organization.entity';
import {
  Hollon,
  HollonStatus,
} from '../../../src/modules/hollon/entities/hollon.entity';
import { Role } from '../../../src/modules/role/entities/role.entity';
import { Team } from '../../../src/modules/team/entities/team.entity';

describe('Task API (e2e)', () => {
  let app: INestApplication;
  let taskRepo: Repository<Task>;
  let projectRepo: Repository<Project>;
  let orgRepo: Repository<Organization>;
  let hollonRepo: Repository<Hollon>;
  let roleRepo: Repository<Role>;
  let teamRepo: Repository<Team>;

  let testOrg: Organization;
  let testTeam: Team;
  let testRole: Role;
  let testProject: Project;
  let testHollon: Hollon;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    await app.init();

    taskRepo = moduleFixture.get<Repository<Task>>(getRepositoryToken(Task));
    projectRepo = moduleFixture.get<Repository<Project>>(
      getRepositoryToken(Project),
    );
    orgRepo = moduleFixture.get<Repository<Organization>>(
      getRepositoryToken(Organization),
    );
    hollonRepo = moduleFixture.get<Repository<Hollon>>(
      getRepositoryToken(Hollon),
    );
    roleRepo = moduleFixture.get<Repository<Role>>(getRepositoryToken(Role));
    teamRepo = moduleFixture.get<Repository<Team>>(getRepositoryToken(Team));
  });

  beforeEach(async () => {
    // Setup test data
    testOrg = await orgRepo.save(
      orgRepo.create({
        name: 'E2E Test Org',
        description: 'Organization for E2E tests',
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
        name: 'E2EEngineer',
        description: 'E2E test role',
        systemPrompt: 'You are an E2E test engineer',
        capabilities: ['typescript'],
      }),
    );

    testTeam = await teamRepo.save(
      teamRepo.create({
        organizationId: testOrg.id,
        name: 'E2E Team',
        description: 'E2E test team',
      }),
    );

    testProject = await projectRepo.save(
      projectRepo.create({
        organizationId: testOrg.id,
        name: 'E2E Test Project',
        description: 'Project for E2E tests',
        status: ProjectStatus.ACTIVE,
      }),
    );

    testHollon = await hollonRepo.save(
      hollonRepo.create({
        name: 'E2EHollon',
        organizationId: testOrg.id,
        teamId: testTeam.id,
        roleId: testRole.id,
        brainProviderId: 'claude_code',
        status: HollonStatus.IDLE,
        maxConcurrentTasks: 1,
      }),
    );
  });

  afterEach(async () => {
    // Cleanup
    await taskRepo.delete({ projectId: testProject.id });
    await hollonRepo.delete({ id: testHollon.id });
    await projectRepo.delete({ id: testProject.id });
    await teamRepo.delete({ id: testTeam.id });
    await roleRepo.delete({ id: testRole.id });
    await orgRepo.delete({ id: testOrg.id });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/tasks', () => {
    it('should create a new task', () => {
      return request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'E2E Test Task',
          description: 'Task created via E2E test',
          projectId: testProject.id,
          priority: TaskPriority.P3_MEDIUM,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body).toHaveProperty('id');
          expect(res.body.title).toBe('E2E Test Task');
          expect(res.body.status).toBe(TaskStatus.READY);
          expect(res.body.priority).toBe(TaskPriority.P3_MEDIUM);
        });
    });

    it('should validate required fields', () => {
      return request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          description: 'Missing title',
          projectId: testProject.id,
        })
        .expect(400);
    });

    it('should create a subtask with parent', async () => {
      // Create parent task
      const parentRes = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'Parent Task',
          description: 'Parent',
          projectId: testProject.id,
          priority: TaskPriority.P2_HIGH,
        })
        .expect(201);

      const parentId = parentRes.body.id;

      // Create subtask
      return request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'Subtask',
          description: 'Child task',
          projectId: testProject.id,
          parentTaskId: parentId,
          priority: TaskPriority.P3_MEDIUM,
        })
        .expect(201)
        .expect((res) => {
          expect(res.body.parentTaskId).toBe(parentId);
          expect(res.body.depth).toBe(1);
        });
    });

    it('should reject subtask exceeding max depth', async () => {
      // Create depth 0 task
      const depth0 = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'Depth 0',
          description: 'Root',
          projectId: testProject.id,
          priority: TaskPriority.P3_MEDIUM,
        });

      // Create depth 1 task
      const depth1 = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'Depth 1',
          description: 'Level 1',
          projectId: testProject.id,
          parentTaskId: depth0.body.id,
          priority: TaskPriority.P3_MEDIUM,
        });

      // Create depth 2 task
      const depth2 = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'Depth 2',
          description: 'Level 2',
          projectId: testProject.id,
          parentTaskId: depth1.body.id,
          priority: TaskPriority.P3_MEDIUM,
        });

      // Create depth 3 task
      const depth3 = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'Depth 3',
          description: 'Level 3',
          projectId: testProject.id,
          parentTaskId: depth2.body.id,
          priority: TaskPriority.P3_MEDIUM,
        });

      // Attempt depth 4 - should fail
      return request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'Depth 4',
          description: 'Level 4',
          projectId: testProject.id,
          parentTaskId: depth3.body.id,
          priority: TaskPriority.P3_MEDIUM,
        })
        .expect(400)
        .expect((res) => {
          expect(res.body.message).toContain('Maximum subtask depth');
        });
    });
  });

  describe('GET /api/v1/tasks/:id', () => {
    it('should retrieve a task by id', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'Retrieve Test',
          description: 'Task to retrieve',
          projectId: testProject.id,
          priority: TaskPriority.P3_MEDIUM,
        });

      const taskId = created.body.id;

      return request(app.getHttpServer())
        .get(`/api/v1/tasks/${taskId}`)
        .expect(200)
        .expect((res) => {
          expect(res.body.id).toBe(taskId);
          expect(res.body.title).toBe('Retrieve Test');
        });
    });

    it('should return 404 for non-existent task', () => {
      return request(app.getHttpServer())
        .get('/api/v1/tasks/00000000-0000-0000-0000-000000000000')
        .expect(404);
    });
  });

  describe('GET /api/v1/projects/:projectId/tasks/ready', () => {
    it('should retrieve ready tasks for a project', async () => {
      // Create multiple tasks
      await request(app.getHttpServer()).post('/api/v1/tasks').send({
        title: 'Ready Task 1',
        description: 'Test',
        projectId: testProject.id,
        priority: TaskPriority.P1_CRITICAL,
      });

      await request(app.getHttpServer()).post('/api/v1/tasks').send({
        title: 'Ready Task 2',
        description: 'Test',
        projectId: testProject.id,
        priority: TaskPriority.P3_MEDIUM,
      });

      return request(app.getHttpServer())
        .get(`/api/v1/projects/${testProject.id}/tasks/ready`)
        .expect(200)
        .expect((res) => {
          expect(Array.isArray(res.body)).toBe(true);
          expect(res.body.length).toBe(2);
          // Verify priority ordering
          expect(res.body[0].priority).toBe(TaskPriority.P1_CRITICAL);
          expect(res.body[1].priority).toBe(TaskPriority.P3_MEDIUM);
        });
    });

    it('should not include assigned tasks', async () => {
      // Create task
      const created = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'To Be Assigned',
          description: 'Test',
          projectId: testProject.id,
          priority: TaskPriority.P3_MEDIUM,
        });

      const taskId = created.body.id;

      // Assign task
      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${taskId}/assign`)
        .send({ hollonId: testHollon.id })
        .expect(200);

      // Get ready tasks - should be empty
      return request(app.getHttpServer())
        .get(`/api/v1/projects/${testProject.id}/tasks/ready`)
        .expect(200)
        .expect((res) => {
          expect(res.body.length).toBe(0);
        });
    });
  });

  describe('PATCH /api/v1/tasks/:id/assign', () => {
    it('should assign task to hollon', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'Task to Assign',
          description: 'Test',
          projectId: testProject.id,
          priority: TaskPriority.P3_MEDIUM,
        });

      const taskId = created.body.id;

      return request(app.getHttpServer())
        .patch(`/api/v1/tasks/${taskId}/assign`)
        .send({ hollonId: testHollon.id })
        .expect(200)
        .expect((res) => {
          expect(res.body.assignedHollonId).toBe(testHollon.id);
          expect(res.body.status).toBe(TaskStatus.IN_PROGRESS);
          expect(res.body.startedAt).toBeDefined();
        });
    });

    it('should validate hollon ID', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'Task to Assign',
          description: 'Test',
          projectId: testProject.id,
          priority: TaskPriority.P3_MEDIUM,
        });

      return request(app.getHttpServer())
        .patch(`/api/v1/tasks/${created.body.id}/assign`)
        .send({ hollonId: 'invalid-id' })
        .expect(400);
    });
  });

  describe('PATCH /api/v1/tasks/:id/complete', () => {
    it('should mark task as completed', async () => {
      // Create and assign task
      const created = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'Task to Complete',
          description: 'Test',
          projectId: testProject.id,
          priority: TaskPriority.P3_MEDIUM,
        });

      const taskId = created.body.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${taskId}/assign`)
        .send({ hollonId: testHollon.id });

      // Complete task
      return request(app.getHttpServer())
        .patch(`/api/v1/tasks/${taskId}/complete`)
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(TaskStatus.COMPLETED);
          expect(res.body.completedAt).toBeDefined();
        });
    });
  });

  describe('PATCH /api/v1/tasks/:id/fail', () => {
    it('should mark task as failed with error message', async () => {
      // Create and assign task
      const created = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'Task to Fail',
          description: 'Test',
          projectId: testProject.id,
          priority: TaskPriority.P3_MEDIUM,
        });

      const taskId = created.body.id;

      await request(app.getHttpServer())
        .patch(`/api/v1/tasks/${taskId}/assign`)
        .send({ hollonId: testHollon.id });

      // Fail task
      return request(app.getHttpServer())
        .patch(`/api/v1/tasks/${taskId}/fail`)
        .send({ errorMessage: 'Test failure reason' })
        .expect(200)
        .expect((res) => {
          expect(res.body.status).toBe(TaskStatus.FAILED);
          expect(res.body.errorMessage).toBe('Test failure reason');
          expect(res.body.retryCount).toBe(1);
        });
    });
  });

  describe('DELETE /api/v1/tasks/:id', () => {
    it('should delete a task', async () => {
      const created = await request(app.getHttpServer())
        .post('/api/v1/tasks')
        .send({
          title: 'Task to Delete',
          description: 'Test',
          projectId: testProject.id,
          priority: TaskPriority.P3_MEDIUM,
        });

      const taskId = created.body.id;

      await request(app.getHttpServer())
        .delete(`/api/v1/tasks/${taskId}`)
        .expect(200);

      // Verify deletion
      return request(app.getHttpServer())
        .get(`/api/v1/tasks/${taskId}`)
        .expect(404);
    });
  });
});
