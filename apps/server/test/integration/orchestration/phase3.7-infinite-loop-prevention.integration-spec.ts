import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { Organization } from '@/modules/organization/entities/organization.entity';
import { Role } from '@/modules/role/entities/role.entity';
import { Team } from '@/modules/team/entities/team.entity';
import { Hollon, HollonStatus } from '@/modules/hollon/entities/hollon.entity';
import { Project } from '@/modules/project/entities/project.entity';
import { Task, TaskStatus } from '@/modules/task/entities/task.entity';
import { TaskPoolService } from '@/modules/orchestration/services/task-pool.service';
import { cleanupTestData } from '../../utils/test-database.utils';

/**
 * Phase 3.7: Infinite Loop Prevention Integration Test
 *
 * Tests the exponential backoff mechanism:
 * 1. Task fails 3 times consecutively
 * 2. First failure: blocked for 5 minutes
 * 3. Second failure: blocked for 15 minutes
 * 4. Third failure: blocked for 60 minutes
 * 5. Success resets consecutiveFailures counter
 * 6. Blocked tasks are not pulled by pullNextTask()
 */
describe('Phase 3.7: Infinite Loop Prevention (Exponential Backoff)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let taskPool: TaskPoolService;

  let organization: Organization;
  let role: Role;
  let team: Team;
  let hollon: Hollon;
  let project: Project;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    taskPool = app.get(TaskPoolService);
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await app.close();
  });

  describe('Setup: Create test entities', () => {
    it('should create organization', async () => {
      const orgRepo = dataSource.getRepository(Organization);
      organization = await orgRepo.save({
        name: 'Phase 3.7 Backoff Test Org',
        description: 'Testing exponential backoff',
        settings: {},
      });

      expect(organization.id).toBeDefined();
    });

    it('should create role', async () => {
      const roleRepo = dataSource.getRepository(Role);
      role = await roleRepo.save({
        organizationId: organization.id,
        name: 'Developer',
        description: 'Software Developer',
        capabilities: ['typescript', 'nestjs'],
      });

      expect(role.id).toBeDefined();
    });

    it('should create team', async () => {
      const teamRepo = dataSource.getRepository(Team);
      team = await teamRepo.save({
        organizationId: organization.id,
        name: 'Test Team',
        description: 'Backoff test team',
      });

      expect(team.id).toBeDefined();
    });

    it('should create hollon', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);
      hollon = await hollonRepo.save({
        organizationId: organization.id,
        roleId: role.id,
        teamId: team.id,
        name: 'Test Hollon',
        status: HollonStatus.IDLE,
      });

      expect(hollon.id).toBeDefined();
    });

    it('should create project', async () => {
      const projectRepo = dataSource.getRepository(Project);
      project = await projectRepo.save({
        organizationId: organization.id,
        name: 'Backoff Test Project',
        description: 'Testing infinite loop prevention',
        status: 'active',
      });

      expect(project.id).toBeDefined();
    });
  });

  describe('First Failure: 5 minute backoff', () => {
    let task: Task;

    it('should create test task', async () => {
      const taskRepo = dataSource.getRepository(Task);
      task = await taskRepo.save({
        organizationId: organization.id,
        projectId: project.id,
        assignedHollonId: hollon.id, // Phase 3.8: Must have assignedHollonId OR assignedTeamId
        title: 'Task That Will Fail',
        description: 'This task will fail to test exponential backoff',
        type: 'implementation',
        status: TaskStatus.READY,
        priority: 'P2',
        depth: 0,
        consecutiveFailures: 0,
      });

      expect(task.id).toBeDefined();
      expect(task.consecutiveFailures).toBe(0);
    });

    it('should pull task', async () => {
      const result = await taskPool.pullNextTask(hollon.id);

      expect(result.task).toBeDefined();
      expect(result.task?.id).toBe(task.id);
      // Note: After pullNextTask (claimTask), non-review tasks remain in READY status.
      // Status changes to IN_PROGRESS in executeTask after worktree is created.
      expect(result.task?.status).toBe(TaskStatus.READY);
    });

    it('should fail task and set 5-minute backoff', async () => {
      await taskPool.failTask(task.id, 'First failure - testing backoff');

      const taskRepo = dataSource.getRepository(Task);
      const updatedTask = await taskRepo.findOne({ where: { id: task.id } });

      expect(updatedTask?.status).toBe(TaskStatus.READY); // Back to READY for retry
      expect(updatedTask?.consecutiveFailures).toBe(1);
      expect(updatedTask?.lastFailedAt).toBeDefined();
      expect(updatedTask?.blockedUntil).toBeDefined();

      // Verify 5-minute backoff (within 1 second tolerance)
      const now = new Date();
      const blockedUntil = updatedTask!.blockedUntil!;
      const diffMinutes =
        (blockedUntil.getTime() - now.getTime()) / (1000 * 60);

      expect(diffMinutes).toBeGreaterThan(4.9);
      expect(diffMinutes).toBeLessThan(5.1);

      console.log(
        `✅ First failure: blocked for ${diffMinutes.toFixed(2)} minutes`,
      );
    });

    it('should NOT pull blocked task', async () => {
      const result = await taskPool.pullNextTask(hollon.id);

      // Task should not be pulled because it's blocked
      expect(result.task).toBeNull();
      // Reason could be "blocked" or "No available tasks" (task is filtered out)
      expect(result.reason).toBeDefined();

      console.log(`✅ Blocked task not pulled: ${result.reason}`);
    });

    it('should allow pulling after manually clearing blockedUntil', async () => {
      // Fast-forward by clearing blockedUntil (simulating time passage)
      const taskRepo = dataSource.getRepository(Task);
      await taskRepo.update(
        { id: task.id },
        { blockedUntil: null, status: TaskStatus.READY },
      );

      const result = await taskPool.pullNextTask(hollon.id);

      expect(result.task).toBeDefined();
      expect(result.task?.id).toBe(task.id);
    });
  });

  describe('Second Failure: 15 minute backoff', () => {
    let task: Task;

    beforeAll(async () => {
      const taskRepo = dataSource.getRepository(Task);
      const tasks = await taskRepo.find({
        where: { projectId: project.id },
        order: { createdAt: 'DESC' },
      });
      task = tasks[0];
    });

    it('should fail task second time and set 15-minute backoff', async () => {
      await taskPool.failTask(task.id, 'Second failure - testing backoff');

      const taskRepo = dataSource.getRepository(Task);
      const updatedTask = await taskRepo.findOne({ where: { id: task.id } });

      expect(updatedTask?.consecutiveFailures).toBe(2);
      expect(updatedTask?.blockedUntil).toBeDefined();

      // Verify 15-minute backoff (within 1 second tolerance)
      const now = new Date();
      const blockedUntil = updatedTask!.blockedUntil!;
      const diffMinutes =
        (blockedUntil.getTime() - now.getTime()) / (1000 * 60);

      expect(diffMinutes).toBeGreaterThan(14.9);
      expect(diffMinutes).toBeLessThan(15.1);

      console.log(
        `✅ Second failure: blocked for ${diffMinutes.toFixed(2)} minutes`,
      );
    });

    it('should clear blockage for next test', async () => {
      const taskRepo = dataSource.getRepository(Task);
      await taskRepo.update(
        { id: task.id },
        { blockedUntil: null, status: TaskStatus.READY },
      );

      const result = await taskPool.pullNextTask(hollon.id);
      expect(result.task).toBeDefined();
    });
  });

  describe('Third Failure: 60 minute backoff', () => {
    let task: Task;

    beforeAll(async () => {
      const taskRepo = dataSource.getRepository(Task);
      const tasks = await taskRepo.find({
        where: { projectId: project.id },
        order: { createdAt: 'DESC' },
      });
      task = tasks[0];
    });

    it('should fail task third time and set 60-minute backoff', async () => {
      await taskPool.failTask(task.id, 'Third failure - testing backoff');

      const taskRepo = dataSource.getRepository(Task);
      const updatedTask = await taskRepo.findOne({ where: { id: task.id } });

      expect(updatedTask?.consecutiveFailures).toBe(3);
      expect(updatedTask?.blockedUntil).toBeDefined();

      // Verify 60-minute backoff (within 1 second tolerance)
      const now = new Date();
      const blockedUntil = updatedTask!.blockedUntil!;
      const diffMinutes =
        (blockedUntil.getTime() - now.getTime()) / (1000 * 60);

      expect(diffMinutes).toBeGreaterThan(59.9);
      expect(diffMinutes).toBeLessThan(60.1);

      console.log(
        `✅ Third failure: blocked for ${diffMinutes.toFixed(2)} minutes`,
      );
    });

    it('should keep 60-minute backoff for subsequent failures', async () => {
      // Clear blockage and fail again
      const taskRepo = dataSource.getRepository(Task);
      await taskRepo.update(
        { id: task.id },
        { blockedUntil: null, status: TaskStatus.READY },
      );

      await taskPool.pullNextTask(hollon.id);
      await taskPool.failTask(task.id, 'Fourth failure - should still be 60m');

      const updatedTask = await taskRepo.findOne({ where: { id: task.id } });

      expect(updatedTask?.consecutiveFailures).toBe(4);

      // Still 60 minutes (max backoff)
      const now = new Date();
      const blockedUntil = updatedTask!.blockedUntil!;
      const diffMinutes =
        (blockedUntil.getTime() - now.getTime()) / (1000 * 60);

      expect(diffMinutes).toBeGreaterThan(59.9);
      expect(diffMinutes).toBeLessThan(60.1);

      console.log(
        `✅ Fourth failure: still blocked for ${diffMinutes.toFixed(2)} minutes (max)`,
      );
    });
  });

  describe('Success Resets Counter', () => {
    let task: Task;

    beforeAll(async () => {
      const taskRepo = dataSource.getRepository(Task);
      const tasks = await taskRepo.find({
        where: { projectId: project.id },
        order: { createdAt: 'DESC' },
      });
      task = tasks[0];
    });

    it('should reset consecutiveFailures on success', async () => {
      // Clear blockage and complete task
      const taskRepo = dataSource.getRepository(Task);
      await taskRepo.update(
        { id: task.id },
        {
          blockedUntil: null,
          status: TaskStatus.IN_PROGRESS,
        },
      );

      await taskPool.completeTask(task.id);

      const updatedTask = await taskRepo.findOne({ where: { id: task.id } });

      expect(updatedTask?.status).toBe(TaskStatus.COMPLETED);
      expect(updatedTask?.consecutiveFailures).toBe(0); // Reset!
      expect(updatedTask?.blockedUntil).toBeNull(); // Cleared!
      expect(updatedTask?.completedAt).toBeDefined();

      console.log('✅ Success reset consecutiveFailures to 0');
    });
  });

  describe('Verify Backoff Fields in Database', () => {
    it('should have all backoff columns in tasks table', async () => {
      const result = await dataSource.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'hollon_test_worker_1'
          AND table_name = 'tasks'
          AND column_name IN ('consecutive_failures', 'last_failed_at', 'blocked_until')
        ORDER BY column_name;
      `);

      expect(result.length).toBe(3);

      const columns = result.map((r: any) => r.column_name);
      expect(columns).toContain('consecutive_failures');
      expect(columns).toContain('last_failed_at');
      expect(columns).toContain('blocked_until');

      console.log('✅ All backoff fields exist in database');
    });

    it('should have index on blocked_until column', async () => {
      const result = await dataSource.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'tasks'
          AND indexname LIKE '%blocked_until%';
      `);

      expect(result.length).toBeGreaterThan(0);

      console.log(`✅ Index found: ${result[0].indexname}`);
    });
  });
});
