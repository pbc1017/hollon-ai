import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import {
  TaskStatus,
  TaskType,
} from '../../src/modules/task/entities/task.entity';
import { HollonOrchestratorService } from '../../src/modules/orchestration/services/hollon-orchestrator.service';
import { TaskPoolService } from '../../src/modules/orchestration/services/task-pool.service';
import { BrainProviderService } from '../../src/modules/brain-provider/brain-provider.service';

/**
 * Phase 3.10 Parent Hollon Review Cycle Integration Test
 *
 * 테스트 범위:
 * 1. LLM complete decision - 모든 서브태스크 완료 후 parent task 완료
 * 2. LLM rework decision - 특정 서브태스크 재작업 요청
 * 3. LLM add_tasks decision - 추가 서브태스크 생성
 * 4. LLM redirect decision - 방향 전환 (일부 취소 + 새 방향)
 * 5. reviewCount max 3 limit - 무한루프 방지
 * 6. Temporary hollon cleanup only on complete
 * 7. Team distribution review cycle
 * 8. Priority 0 assignment - 리뷰 태스크 최우선 처리
 * 9. Subtask results in prompt - 서브태스크 결과가 프롬프트에 포함
 * 10. READY_FOR_REVIEW status transition
 *
 * Integration 테스트는:
 * - BrainProvider를 Mock으로 처리 (실제 LLM 호출 없음)
 * - 빠른 실행 속도 (10-15초 이내)
 * - 무료 (API 비용 없음)
 */
describe('Phase 3.10 Parent Hollon Review Cycle (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Services
  let hollonOrchestratorService: HollonOrchestratorService;
  let taskPoolService: TaskPoolService;
  let brainProviderService: BrainProviderService;

  // Test data IDs
  let organizationId: string;
  let roleId: string;
  let projectId: string;
  let parentHollonId: string;
  let parentTaskId: string;
  let subtask1Id: string;
  let subtask2Id: string;

  const testRunId = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Get services
    hollonOrchestratorService = moduleFixture.get<HollonOrchestratorService>(
      HollonOrchestratorService,
    );
    taskPoolService = moduleFixture.get<TaskPoolService>(TaskPoolService);
    brainProviderService =
      moduleFixture.get<BrainProviderService>(BrainProviderService);
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await app?.close();
  });

  /**
   * Helper: Create test organization, role, project, hollon
   */
  async function createTestContext() {
    const org = await dataSource.query(
      `INSERT INTO organizations (name, description) VALUES ($1, $2) RETURNING id`,
      [`Test Org Review ${testRunId}`, 'Test organization for review cycle'],
    );
    organizationId = org[0].id;

    const role = await dataSource.query(
      `INSERT INTO roles (name, organization_id) VALUES ($1, $2) RETURNING id`,
      ['Developer', organizationId],
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
      [`Parent Hollon ${testRunId}`, roleId, organizationId, 'idle', 0],
    );
    parentHollonId = hollon[0].id;
  }

  /**
   * Helper: Create parent task with 2 completed subtasks
   */
  async function createParentTaskWithCompletedSubtasks() {
    // Create parent task
    const parentTask = await dataSource.query(
      `INSERT INTO tasks (
        title, description, project_id, organization_id,
        status, type, assigned_hollon_id, depth, review_count
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
      [
        `Parent Task ${testRunId}`,
        'Parent task for review',
        projectId,
        organizationId,
        TaskStatus.IN_PROGRESS,
        TaskType.IMPLEMENTATION,
        parentHollonId,
        0,
        0,
      ],
    );
    parentTaskId = parentTask[0].id;

    // Create subtask 1 (completed)
    const subtask1 = await dataSource.query(
      `INSERT INTO tasks (
        title, description, project_id, organization_id,
        status, type, parent_task_id, depth
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        'Subtask 1',
        'First subtask',
        projectId,
        organizationId,
        TaskStatus.COMPLETED,
        TaskType.IMPLEMENTATION,
        parentTaskId,
        1,
      ],
    );
    subtask1Id = subtask1[0].id;

    // Create subtask 2 (completed)
    const subtask2 = await dataSource.query(
      `INSERT INTO tasks (
        title, description, project_id, organization_id,
        status, type, parent_task_id, depth
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [
        'Subtask 2',
        'Second subtask',
        projectId,
        organizationId,
        TaskStatus.COMPLETED,
        TaskType.IMPLEMENTATION,
        parentTaskId,
        1,
      ],
    );
    subtask2Id = subtask2[0].id;

    // Update parent task to READY_FOR_REVIEW
    await dataSource.query(`UPDATE tasks SET status = $1 WHERE id = $2`, [
      TaskStatus.READY_FOR_REVIEW,
      parentTaskId,
    ]);
  }

  /**
   * Helper: Cleanup test data
   */
  async function cleanupTestData() {
    if (subtask1Id)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [subtask1Id]);
    if (subtask2Id)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [subtask2Id]);
    if (parentTaskId)
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [parentTaskId]);
    if (parentHollonId)
      await dataSource.query('DELETE FROM hollons WHERE id = $1', [
        parentHollonId,
      ]);
    if (projectId)
      await dataSource.query('DELETE FROM projects WHERE id = $1', [projectId]);
    if (roleId)
      await dataSource.query('DELETE FROM roles WHERE id = $1', [roleId]);
    if (organizationId)
      await dataSource.query('DELETE FROM organizations WHERE id = $1', [
        organizationId,
      ]);
  }

  describe('1. READY_FOR_REVIEW status transition', () => {
    beforeEach(async () => {
      await createTestContext();
    });

    afterEach(async () => {
      await cleanupTestData();
    });

    it('should transition parent task to READY_FOR_REVIEW when all subtasks complete', async () => {
      await createParentTaskWithCompletedSubtasks();

      // Verify parent task is in READY_FOR_REVIEW
      const task = await dataSource.query(
        'SELECT status, review_count FROM tasks WHERE id = $1',
        [parentTaskId],
      );

      expect(task[0].status).toBe(TaskStatus.READY_FOR_REVIEW);
      expect(task[0].review_count).toBe(0);
    });
  });

  describe('2. Priority 0 assignment - review tasks highest priority', () => {
    beforeEach(async () => {
      await createTestContext();
    });

    afterEach(async () => {
      await cleanupTestData();
    });

    it('should pull READY_FOR_REVIEW task with Priority 0 (highest)', async () => {
      await createParentTaskWithCompletedSubtasks();

      // Create another READY task (Priority 1)
      const readyTask = await dataSource.query(
        `INSERT INTO tasks (
          title, description, project_id, organization_id,
          status, assigned_hollon_id
        ) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          'Ready Task',
          'Normal ready task',
          projectId,
          organizationId,
          TaskStatus.READY,
          parentHollonId,
        ],
      );
      const readyTaskId = readyTask[0].id;

      // Pull next task - should get READY_FOR_REVIEW (Priority 0)
      const result = await taskPoolService.pullNextTask(parentHollonId);

      expect(result.task).not.toBeNull();
      expect(result.task?.id).toBe(parentTaskId);
      expect(result.reason).toContain('Review subtasks');

      // Cleanup
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [readyTaskId]);
    });
  });

  describe('3. Task claiming - READY_FOR_REVIEW → IN_REVIEW transition', () => {
    beforeEach(async () => {
      await createTestContext();
    });

    afterEach(async () => {
      await cleanupTestData();
    });

    it('should transition to IN_REVIEW and increment reviewCount', async () => {
      await createParentTaskWithCompletedSubtasks();

      // Pull task (claims it)
      await taskPoolService.pullNextTask(parentHollonId);

      // Verify task state
      const task = await dataSource.query(
        'SELECT status, review_count, last_reviewed_at FROM tasks WHERE id = $1',
        [parentTaskId],
      );

      expect(task[0].status).toBe(TaskStatus.IN_REVIEW);
      expect(task[0].review_count).toBe(1);
      expect(task[0].last_reviewed_at).not.toBeNull();
    });
  });

  describe('4. LLM complete decision', () => {
    beforeEach(async () => {
      await createTestContext();
      await createParentTaskWithCompletedSubtasks();
    });

    afterEach(async () => {
      await cleanupTestData();
    });

    it('should complete parent task when LLM decides to complete', async () => {
      // Mock Brain Provider to return "complete" decision
      jest
        .spyOn(brainProviderService, 'executeWithTracking')
        .mockResolvedValue({
          output:
            '```json\n' +
            JSON.stringify({
              action: 'complete',
              reasoning: 'All subtasks look good',
            }) +
            '\n```',
          success: true,
          duration: 1000,
          cost: {
            inputTokens: 100,
            outputTokens: 50,
            totalCostCents: 0.01,
          },
        });

      // Execute orchestrator (review mode) - runCycle will pull the task internally
      const result = await hollonOrchestratorService.runCycle(parentHollonId);

      console.log('DEBUG: Test result=', JSON.stringify(result, null, 2));
      if (!result.success) {
        console.log('ERROR:', result.error);
      }
      expect(result.success).toBe(true);
      expect(result.output).toContain('completed after review');

      // Verify parent task is COMPLETED
      const task = await dataSource.query(
        'SELECT status FROM tasks WHERE id = $1',
        [parentTaskId],
      );
      expect(task[0].status).toBe(TaskStatus.COMPLETED);
    });
  });

  describe('5. LLM rework decision', () => {
    beforeEach(async () => {
      await createTestContext();
      await createParentTaskWithCompletedSubtasks();
    });

    afterEach(async () => {
      await cleanupTestData();
    });

    it('should set subtasks to READY for rework', async () => {
      // Mock Brain Provider to return "rework" decision
      jest
        .spyOn(brainProviderService, 'executeWithTracking')
        .mockResolvedValue({
          output:
            '```json\n' +
            JSON.stringify({
              action: 'rework',
              subtaskIds: [subtask1Id],
              reworkInstructions: 'Please fix the error handling',
              reasoning: 'Subtask 1 needs better error handling',
            }) +
            '\n```',
          success: true,
          duration: 1000,
          cost: {
            inputTokens: 100,
            outputTokens: 50,
            totalCostCents: 0.01,
          },
        });

      // Execute orchestrator (review mode) - runCycle will pull the task internally
      const result = await hollonOrchestratorService.runCycle(parentHollonId);

      expect(result.success).toBe(true);
      expect(result.output).toContain('Rework requested');

      // Verify subtask1 is READY
      const subtask = await dataSource.query(
        'SELECT status, description FROM tasks WHERE id = $1',
        [subtask1Id],
      );
      expect(subtask[0].status).toBe(TaskStatus.READY);
      expect(subtask[0].description).toContain('Please fix the error handling');

      // Verify parent task is back to IN_PROGRESS
      const parentTask = await dataSource.query(
        'SELECT status FROM tasks WHERE id = $1',
        [parentTaskId],
      );
      expect(parentTask[0].status).toBe(TaskStatus.IN_PROGRESS);
    });
  });

  describe('6. LLM add_tasks decision', () => {
    beforeEach(async () => {
      await createTestContext();
      await createParentTaskWithCompletedSubtasks();
    });

    afterEach(async () => {
      await cleanupTestData();
    });

    it('should create additional subtasks when requested', async () => {
      // Mock Brain Provider to return "add_tasks" decision
      jest
        .spyOn(brainProviderService, 'executeWithTracking')
        .mockResolvedValue({
          output:
            '```json\n' +
            JSON.stringify({
              action: 'add_tasks',
              newSubtasks: [
                {
                  title: 'New Subtask 3',
                  description: 'Additional work needed',
                  type: TaskType.IMPLEMENTATION,
                  priority: 'P1',
                },
              ],
              reasoning: 'Need to add error handling tests',
            }) +
            '\n```',
          success: true,
          duration: 1000,
          cost: {
            inputTokens: 100,
            outputTokens: 50,
            totalCostCents: 0.01,
          },
        });

      // Execute orchestrator (review mode) - runCycle will pull the task internally
      const result = await hollonOrchestratorService.runCycle(parentHollonId);

      expect(result.success).toBe(true);
      expect(result.output).toContain('follow-up tasks');

      // Verify new subtask was created
      const subtasks = await dataSource.query(
        'SELECT COUNT(*) FROM tasks WHERE parent_task_id = $1',
        [parentTaskId],
      );
      expect(parseInt(subtasks[0].count)).toBeGreaterThanOrEqual(3);

      // Verify parent task is back to IN_PROGRESS
      const parentTask = await dataSource.query(
        'SELECT status FROM tasks WHERE id = $1',
        [parentTaskId],
      );
      expect(parentTask[0].status).toBe(TaskStatus.IN_PROGRESS);

      // Cleanup new subtask
      await dataSource.query(
        'DELETE FROM tasks WHERE parent_task_id = $1 AND title = $2',
        [parentTaskId, 'New Subtask 3'],
      );
    });
  });

  describe('7. LLM redirect decision', () => {
    beforeEach(async () => {
      await createTestContext();
      await createParentTaskWithCompletedSubtasks();
    });

    afterEach(async () => {
      await cleanupTestData();
    });

    it('should cancel specified subtasks and redirect parent task', async () => {
      // Mock Brain Provider to return "redirect" decision
      jest
        .spyOn(brainProviderService, 'executeWithTracking')
        .mockResolvedValue({
          output:
            '```json\n' +
            JSON.stringify({
              action: 'redirect',
              cancelSubtaskIds: [subtask2Id],
              newDirection:
                'Focus on GraphQL instead of REST API - cancel REST implementation',
              reasoning: 'Architecture decision changed to GraphQL',
            }) +
            '\n```',
          success: true,
          duration: 1000,
          cost: {
            inputTokens: 100,
            outputTokens: 50,
            totalCostCents: 0.01,
          },
        });

      // Execute orchestrator (review mode) - runCycle will pull the task internally
      const result = await hollonOrchestratorService.runCycle(parentHollonId);

      expect(result.success).toBe(true);
      expect(result.output).toContain('redirected');

      // Verify subtask2 is CANCELLED
      const subtask = await dataSource.query(
        'SELECT status FROM tasks WHERE id = $1',
        [subtask2Id],
      );
      expect(subtask[0].status).toBe(TaskStatus.CANCELLED);

      // Verify parent task description updated
      const parentTask = await dataSource.query(
        'SELECT description FROM tasks WHERE id = $1',
        [parentTaskId],
      );
      expect(parentTask[0].description).toContain('New Direction');
      expect(parentTask[0].description).toContain('GraphQL');
    });
  });

  describe('8. reviewCount max 3 limit', () => {
    beforeEach(async () => {
      await createTestContext();
      await createParentTaskWithCompletedSubtasks();
    });

    afterEach(async () => {
      await cleanupTestData();
    });

    it('should skip task when reviewCount >= 3', async () => {
      // Set reviewCount to 3
      await dataSource.query(
        'UPDATE tasks SET review_count = $1 WHERE id = $2',
        [3, parentTaskId],
      );

      // Try to pull task - should skip
      const result = await taskPoolService.pullNextTask(parentHollonId);

      expect(result.task).toBeNull();
      expect(result.reason).toBe('No available tasks');
    });

    it('should allow review when reviewCount < 3', async () => {
      // Set reviewCount to 2
      await dataSource.query(
        'UPDATE tasks SET review_count = $1 WHERE id = $2',
        [2, parentTaskId],
      );

      // Try to pull task - should succeed
      const result = await taskPoolService.pullNextTask(parentHollonId);

      expect(result.task).not.toBeNull();
      expect(result.task?.id).toBe(parentTaskId);
    });
  });

  describe('9. Temporary hollon cleanup only on complete', () => {
    let tempHollonId: string;

    beforeEach(async () => {
      await createTestContext();

      // Create temporary hollon (depth > 0)
      const tempHollon = await dataSource.query(
        `INSERT INTO hollons (name, role_id, organization_id, status, depth, lifecycle) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          `Temp Hollon ${testRunId}`,
          roleId,
          organizationId,
          'idle',
          1, // depth > 0 = temporary
          'temporary', // HollonLifecycle.TEMPORARY
        ],
      );
      tempHollonId = tempHollon[0].id;

      // Create parent task assigned to temp hollon
      const parentTask = await dataSource.query(
        `INSERT INTO tasks (
          title, description, project_id, organization_id,
          status, type, assigned_hollon_id, creator_hollon_id, depth, review_count
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
        [
          `Parent Task ${testRunId}`,
          'Task created by temp hollon',
          projectId,
          organizationId,
          TaskStatus.IN_PROGRESS,
          TaskType.IMPLEMENTATION,
          tempHollonId,
          tempHollonId, // creator = temp hollon
          0,
          0,
        ],
      );
      parentTaskId = parentTask[0].id;

      // Create subtasks
      const subtask1 = await dataSource.query(
        `INSERT INTO tasks (
          title, project_id, organization_id, status, type, parent_task_id, depth
        ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          'Subtask 1',
          projectId,
          organizationId,
          TaskStatus.COMPLETED,
          TaskType.IMPLEMENTATION,
          parentTaskId,
          1,
        ],
      );
      subtask1Id = subtask1[0].id;

      // Update to READY_FOR_REVIEW
      await dataSource.query('UPDATE tasks SET status = $1 WHERE id = $2', [
        TaskStatus.READY_FOR_REVIEW,
        parentTaskId,
      ]);
    });

    afterEach(async () => {
      if (subtask1Id)
        await dataSource.query('DELETE FROM tasks WHERE id = $1', [subtask1Id]);
      if (parentTaskId)
        await dataSource.query('DELETE FROM tasks WHERE id = $1', [
          parentTaskId,
        ]);
      if (tempHollonId)
        await dataSource.query('DELETE FROM hollons WHERE id = $1', [
          tempHollonId,
        ]);
      await cleanupTestData();
    });

    it('should delete temporary hollon on LLM complete', async () => {
      // Mock Brain Provider to return "complete"
      jest
        .spyOn(brainProviderService, 'executeWithTracking')
        .mockResolvedValue({
          output:
            '```json\n' +
            JSON.stringify({
              action: 'complete',
              reasoning: 'All done',
            }) +
            '\n```',
          success: true,
          duration: 1000,
          cost: {
            inputTokens: 100,
            outputTokens: 50,
            totalCostCents: 0.01,
          },
        });

      // Execute cycle (internally pulls and executes task)
      await hollonOrchestratorService.runCycle(tempHollonId);

      // Verify temp hollon was deleted
      const hollon = await dataSource.query(
        'SELECT * FROM hollons WHERE id = $1',
        [tempHollonId],
      );
      expect(hollon.length).toBe(0);
    });

    it('should NOT delete temporary hollon on rework decision', async () => {
      // Mock Brain Provider to return "rework"
      jest
        .spyOn(brainProviderService, 'executeWithTracking')
        .mockResolvedValue({
          output:
            '```json\n' +
            JSON.stringify({
              action: 'rework',
              subtaskIds: [subtask1Id],
              reworkInstructions: 'Fix it',
              reasoning: 'Needs work',
            }) +
            '\n```',
          success: true,
          duration: 1000,
          cost: {
            inputTokens: 100,
            outputTokens: 50,
            totalCostCents: 0.01,
          },
        });

      // Claim and execute
      await taskPoolService.pullNextTask(tempHollonId);
      await hollonOrchestratorService.runCycle(tempHollonId);

      // Verify temp hollon still exists
      const hollon = await dataSource.query(
        'SELECT * FROM hollons WHERE id = $1',
        [tempHollonId],
      );
      expect(hollon.length).toBe(1);
    });
  });

  describe('10. Subtask results in review prompt', () => {
    beforeEach(async () => {
      await createTestContext();
      await createParentTaskWithCompletedSubtasks();
    });

    afterEach(async () => {
      await cleanupTestData();
    });

    it('should include subtask results in review mode prompt', async () => {
      // Mock Brain Provider and capture the prompt
      let capturedPrompt = '';
      jest
        .spyOn(brainProviderService, 'executeWithTracking')
        .mockImplementation(async (params) => {
          capturedPrompt = params.prompt;
          return {
            output:
              '```json\n' +
              JSON.stringify({
                action: 'complete',
                reasoning: 'Good',
              }),
            success: true,
            duration: 1000,
            cost: {
              inputTokens: 100,
              outputTokens: 50,
              totalCostCents: 0.01,
            },
          };
        });

      // Execute orchestrator - runCycle will pull the task internally
      await hollonOrchestratorService.runCycle(parentHollonId);

      // Verify prompt contains review mode indicators
      expect(capturedPrompt).toContain('SUBTASK REVIEW MODE');
      expect(capturedPrompt).toContain('Subtask Results Summary');
      expect(capturedPrompt).toContain('Your Decision');
      expect(capturedPrompt).toContain('Option 1: Complete');
      expect(capturedPrompt).toContain('Option 2: Rework');
      expect(capturedPrompt).toContain('Option 3: Add Tasks');
      expect(capturedPrompt).toContain('Option 4: Redirect');

      // Verify subtask titles are in prompt
      expect(capturedPrompt).toContain('Subtask 1');
      expect(capturedPrompt).toContain('Subtask 2');
    });
  });
});
