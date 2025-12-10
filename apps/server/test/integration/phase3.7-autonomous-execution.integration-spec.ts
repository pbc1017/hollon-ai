import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import request from 'supertest';
import { HollonExecutionService } from '../../src/modules/orchestration/services/hollon-execution.service';
import { TaskPoolService } from '../../src/modules/orchestration/services/task-pool.service';
import { OrganizationService } from '../../src/modules/organization/organization.service';
import { TaskStatus } from '../../src/modules/task/entities/task.entity';
import { ClaudeCodeProvider } from '../../src/modules/brain-provider/providers/claude-code.provider';
import { BrainResponse } from '../../src/modules/brain-provider/interfaces/brain-provider.interface';

/**
 * Phase 3.7 Autonomous Execution Integration Test
 *
 * 테스트 범위:
 * 1. Exponential Backoff (5min → 15min → 1hour)
 * 2. Emergency Stop API
 * 3. Stuck Task Detection (2시간 초과 감지)
 * 4. Progress Monitoring
 * 5. Cron-based Autonomous Execution
 *
 * Integration 테스트는:
 * - BrainProvider를 Mock으로 처리 (실제 LLM 호출 없음)
 * - 빠른 실행 속도 (5-10초 이내)
 * - 무료 (API 비용 없음)
 */
describe('Phase 3.7 Autonomous Execution (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Services
  let hollonExecutionService: HollonExecutionService;
  let taskPoolService: TaskPoolService;
  let organizationService: OrganizationService;

  // Mocks
  let mockClaudeProvider: jest.Mocked<ClaudeCodeProvider>;

  // Test data IDs
  let organizationId: string;
  let roleId: string;
  let projectId: string;
  let hollonId: string;
  let taskId: string;

  const testRunId = Date.now();

  beforeAll(async () => {
    // Mock ClaudeCodeProvider
    const mockBrainResponse: BrainResponse = {
      response: 'Mock LLM response: Task completed successfully',
      cost: {
        inputTokens: 100,
        outputTokens: 50,
        totalCostCents: 0.001,
      },
      duration: 1000,
      metadata: {},
    };

    mockClaudeProvider = {
      execute: jest.fn().mockResolvedValue(mockBrainResponse),
      healthCheck: jest.fn().mockResolvedValue(true),
    } as any;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ClaudeCodeProvider)
      .useValue(mockClaudeProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Get services
    hollonExecutionService = moduleFixture.get<HollonExecutionService>(
      HollonExecutionService,
    );
    taskPoolService = moduleFixture.get<TaskPoolService>(TaskPoolService);
    organizationService =
      moduleFixture.get<OrganizationService>(OrganizationService);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await app?.close();
  });

  describe('1. Exponential Backoff', () => {
    beforeEach(async () => {
      // Create test data using SQL to avoid entity validation issues
      const org = await dataSource.query(
        `INSERT INTO organizations (name, description) VALUES ($1, $2) RETURNING id`,
        [`Test Org Backoff ${testRunId}`, 'Test organization for backoff'],
      );
      organizationId = org[0].id;

      const role = await dataSource.query(
        `INSERT INTO roles (name, organization_id) VALUES ($1, $2) RETURNING id`,
        ['Test Role', organizationId],
      );
      roleId = role[0].id;

      const project = await dataSource.query(
        `INSERT INTO projects (name, description, organization_id, working_directory) VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          `Test Project ${testRunId}`,
          'Test project',
          organizationId,
          '/tmp/test',
        ],
      );
      projectId = project[0].id;

      const hollon = await dataSource.query(
        `INSERT INTO hollons (name, role_id, organization_id, status, depth) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
        [`Test Hollon ${testRunId}`, roleId, organizationId, 'idle', 0],
      );
      hollonId = hollon[0].id;

      const task = await dataSource.query(
        `INSERT INTO tasks (title, description, project_id, organization_id, status, assigned_hollon_id, consecutive_failures) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          `Test Task ${testRunId}`,
          'Test task for backoff',
          projectId,
          organizationId,
          TaskStatus.READY,
          hollonId,
          0,
        ],
      );
      taskId = task[0].id;
    });

    afterEach(async () => {
      // Cleanup using SQL
      if (taskId)
        await dataSource.query('DELETE FROM tasks WHERE id = $1', [taskId]);
      if (hollonId)
        await dataSource.query('DELETE FROM hollons WHERE id = $1', [hollonId]);
      if (projectId)
        await dataSource.query('DELETE FROM projects WHERE id = $1', [
          projectId,
        ]);
      if (roleId)
        await dataSource.query('DELETE FROM roles WHERE id = $1', [roleId]);
      if (organizationId)
        await dataSource.query('DELETE FROM organizations WHERE id = $1', [
          organizationId,
        ]);
    });

    it('should apply 5 min backoff on first failure', async () => {
      const beforeTime = new Date();

      await taskPoolService.failTask(taskId, 'Test error');

      const task = await dataSource.query(
        'SELECT consecutive_failures, status, blocked_until FROM tasks WHERE id = $1',
        [taskId],
      );

      expect(task[0].consecutive_failures).toBe(1);
      expect(task[0].status).toBe(TaskStatus.READY);

      const backoffMs =
        new Date(task[0].blocked_until).getTime() - beforeTime.getTime();
      const expected5Min = 5 * 60 * 1000;
      expect(backoffMs).toBeGreaterThanOrEqual(expected5Min - 1000);
      expect(backoffMs).toBeLessThanOrEqual(expected5Min + 1000);
    });

    it('should reset backoff counter on success', async () => {
      // Apply some failures
      await taskPoolService.failTask(taskId, 'Test error 1');
      await taskPoolService.failTask(taskId, 'Test error 2');

      // Complete task successfully
      await taskPoolService.completeTask(taskId);

      const task = await dataSource.query(
        'SELECT status, consecutive_failures, blocked_until, last_failed_at FROM tasks WHERE id = $1',
        [taskId],
      );

      expect(task[0].status).toBe(TaskStatus.COMPLETED);
      expect(task[0].consecutive_failures).toBe(0);
      expect(task[0].blocked_until).toBeNull();
      expect(task[0].last_failed_at).toBeNull();
    });
  });

  describe('2. Emergency Stop API', () => {
    beforeEach(async () => {
      const org = await dataSource.query(
        `INSERT INTO organizations (name, description) VALUES ($1, $2) RETURNING id`,
        [
          `Test Org EmStop ${testRunId}`,
          'Test organization for emergency stop',
        ],
      );
      organizationId = org[0].id;
    });

    afterEach(async () => {
      if (organizationId)
        await dataSource.query('DELETE FROM organizations WHERE id = $1', [
          organizationId,
        ]);
    });

    it('should stop autonomous execution via API', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/emergency-stop`)
        .send({ reason: 'Test emergency stop' })
        .expect(201);

      expect(response.body.message).toContain('stopped');
      expect(
        response.body.organization.settings.autonomousExecutionEnabled,
      ).toBe(false);
      expect(response.body.organization.settings.emergencyStopReason).toBe(
        'Test emergency stop',
      );
    });

    it('should resume autonomous execution via API', async () => {
      // First stop
      await organizationService.emergencyStop(organizationId, 'Test stop');

      // Then resume
      const response = await request(app.getHttpServer())
        .post(`/api/organizations/${organizationId}/resume-execution`)
        .expect(201);

      expect(response.body.message).toContain('resumed');
      expect(
        response.body.organization.settings.autonomousExecutionEnabled,
      ).toBe(true);
      expect(
        response.body.organization.settings.emergencyStopReason,
      ).toBeUndefined();
    });
  });

  describe('3. Stuck Task Detection', () => {
    beforeEach(async () => {
      const org = await dataSource.query(
        `INSERT INTO organizations (name, description) VALUES ($1, $2) RETURNING id`,
        [
          `Test Org Stuck ${testRunId}`,
          'Test organization for stuck detection',
        ],
      );
      organizationId = org[0].id;

      const project = await dataSource.query(
        `INSERT INTO projects (name, description, organization_id, working_directory) VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          `Test Project ${testRunId}`,
          'Test project',
          organizationId,
          '/tmp/test',
        ],
      );
      projectId = project[0].id;
    });

    afterEach(async () => {
      await dataSource.query('DELETE FROM tasks WHERE project_id = $1', [
        projectId,
      ]);
      await dataSource.query('DELETE FROM projects WHERE id = $1', [projectId]);
      await dataSource.query('DELETE FROM organizations WHERE id = $1', [
        organizationId,
      ]);
    });

    it('should detect and block tasks stuck for over 2 hours', async () => {
      // Create task that has been IN_PROGRESS for > 2 hours
      const twoHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago

      const task = await dataSource.query(
        `INSERT INTO tasks (title, description, project_id, organization_id, status, started_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          `Stuck Task ${testRunId}`,
          'Task stuck in progress',
          projectId,
          organizationId,
          TaskStatus.IN_PROGRESS,
          twoHoursAgo,
        ],
      );
      const stuckTaskId = task[0].id;

      // Run stuck task detection
      await hollonExecutionService.detectStuckTasks();

      // Task should now be BLOCKED
      const updatedTask = await dataSource.query(
        'SELECT status, blocked_reason FROM tasks WHERE id = $1',
        [stuckTaskId],
      );

      expect(updatedTask[0].status).toBe(TaskStatus.BLOCKED);
      expect(updatedTask[0].blocked_reason).toContain('stuck in IN_PROGRESS');
      expect(updatedTask[0].blocked_reason).toContain('hours');
    });

    it('should not block tasks under 2 hours', async () => {
      // Create task that has been IN_PROGRESS for 1 hour
      const oneHourAgo = new Date(Date.now() - 1 * 60 * 60 * 1000);

      const task = await dataSource.query(
        `INSERT INTO tasks (title, description, project_id, organization_id, status, started_at) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          `Recent Task ${testRunId}`,
          'Task in progress',
          projectId,
          organizationId,
          TaskStatus.IN_PROGRESS,
          oneHourAgo,
        ],
      );
      const recentTaskId = task[0].id;

      // Run stuck task detection
      await hollonExecutionService.detectStuckTasks();

      // Task should still be IN_PROGRESS
      const updatedTask = await dataSource.query(
        'SELECT status, blocked_reason FROM tasks WHERE id = $1',
        [recentTaskId],
      );

      expect(updatedTask[0].status).toBe(TaskStatus.IN_PROGRESS);
      expect(updatedTask[0].blocked_reason).toBeNull();
    });
  });

  describe('4. Progress Monitoring', () => {
    it('should log progress statistics without errors', async () => {
      const org = await dataSource.query(
        `INSERT INTO organizations (name, description) VALUES ($1, $2) RETURNING id`,
        [
          `Test Org Progress ${testRunId}`,
          'Test organization for progress monitoring',
        ],
      );
      organizationId = org[0].id;

      const project = await dataSource.query(
        `INSERT INTO projects (name, description, organization_id, working_directory) VALUES ($1, $2, $3, $4) RETURNING id`,
        [
          `Test Project ${testRunId}`,
          'Test project',
          organizationId,
          '/tmp/test',
        ],
      );
      projectId = project[0].id;

      // Create various tasks in different states
      await dataSource.query(
        `INSERT INTO tasks (title, description, project_id, organization_id, status) VALUES ($1, $2, $3, $4, $5)`,
        [
          'Completed Task',
          'Done',
          projectId,
          organizationId,
          TaskStatus.COMPLETED,
        ],
      );
      await dataSource.query(
        `INSERT INTO tasks (title, description, project_id, organization_id, status) VALUES ($1, $2, $3, $4, $5)`,
        [
          'In Progress Task',
          'Working',
          projectId,
          organizationId,
          TaskStatus.IN_PROGRESS,
        ],
      );
      await dataSource.query(
        `INSERT INTO tasks (title, description, project_id, organization_id, status) VALUES ($1, $2, $3, $4, $5)`,
        ['Ready Task', 'Waiting', projectId, organizationId, TaskStatus.READY],
      );

      // Run progress monitoring - should not throw errors
      await expect(
        hollonExecutionService.monitorProgress(),
      ).resolves.not.toThrow();

      // Cleanup
      await dataSource.query('DELETE FROM tasks WHERE project_id = $1', [
        projectId,
      ]);
      await dataSource.query('DELETE FROM projects WHERE id = $1', [projectId]);
      await dataSource.query('DELETE FROM organizations WHERE id = $1', [
        organizationId,
      ]);
    });
  });

  describe('5. Sub-Hollon Depth Restriction', () => {
    let hollonService;

    beforeAll(() => {
      const {
        HollonService,
      } = require('../../src/modules/hollon/hollon.service');
      hollonService = app.get(HollonService);
    });

    beforeEach(async () => {
      const org = await dataSource.query(
        `INSERT INTO organizations (name, description) VALUES ($1, $2) RETURNING id`,
        [
          `Test Org Depth ${testRunId}`,
          'Test organization for depth restriction',
        ],
      );
      organizationId = org[0].id;

      const role = await dataSource.query(
        `INSERT INTO roles (name, organization_id) VALUES ($1, $2) RETURNING id`,
        ['Test Role', organizationId],
      );
      roleId = role[0].id;
    });

    afterEach(async () => {
      await dataSource.query('DELETE FROM hollons WHERE organization_id = $1', [
        organizationId,
      ]);
      await dataSource.query('DELETE FROM roles WHERE id = $1', [roleId]);
      await dataSource.query('DELETE FROM organizations WHERE id = $1', [
        organizationId,
      ]);
    });

    it('should allow depth 0 (permanent) hollon to create temporary sub-hollon', async () => {
      // Create permanent hollon (depth 0)
      const permanentHollon = await dataSource.query(
        `INSERT INTO hollons (name, role_id, organization_id, status, depth, lifecycle) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          `Permanent Hollon ${testRunId}`,
          roleId,
          organizationId,
          'idle',
          0,
          'permanent',
        ],
      );
      const permanentHollonId = permanentHollon[0].id;

      // Should be able to create temporary sub-hollon
      const result = await hollonService.createTemporary({
        name: `Temp Sub-Hollon ${testRunId}`,
        roleId,
        organizationId,
        createdBy: permanentHollonId,
      });

      expect(result).toBeDefined();
      expect(result.depth).toBe(1);
      expect(result.lifecycle).toBe('temporary');
    });

    it('should prevent depth 1 (temporary) hollon from creating sub-hollon', async () => {
      // Create temporary hollon (depth 1)
      const tempHollon = await dataSource.query(
        `INSERT INTO hollons (name, role_id, organization_id, status, depth, lifecycle) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          `Temp Hollon ${testRunId}`,
          roleId,
          organizationId,
          'idle',
          1,
          'temporary',
        ],
      );
      const tempHollonId = tempHollon[0].id;

      // Should NOT be able to create sub-hollon from temporary hollon
      await expect(
        hollonService.createTemporary({
          name: `Should Fail ${testRunId}`,
          roleId,
          organizationId,
          createdBy: tempHollonId,
        }),
      ).rejects.toThrow(/Cannot create temporary hollon from depth 1 hollon/);
    });
  });
});
