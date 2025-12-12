import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { HollonOrchestratorService } from '@/modules/orchestration/services/hollon-orchestrator.service';
import { TaskPoolService } from '@/modules/orchestration/services/task-pool.service';
import { PromptComposerService } from '@/modules/orchestration/services/prompt-composer.service';
import { BrainProviderService } from '@/modules/brain-provider/brain-provider.service';
import { TaskExecutionService } from '@/modules/orchestration/services/task-execution.service';
import { Hollon, HollonStatus } from '@/modules/hollon/entities/hollon.entity';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
} from '@/modules/task/entities/task.entity';
import { Organization } from '@/modules/organization/entities/organization.entity';
import { Team } from '@/modules/team/entities/team.entity';
import { Role } from '@/modules/role/entities/role.entity';
import { Project } from '@/modules/project/entities/project.entity';
import { OrganizationFactory } from '../../fixtures/organization.factory';
import { TeamFactory } from '../../fixtures/team.factory';
import { cleanupTestData } from '../../utils/test-database.utils';

/**
 * E2E Orchestration Test
 *
 * This test verifies the complete orchestration workflow:
 * 1. Setup: Create Organization → Team → Role → Hollon → Project → Task
 * 2. Execute: Hollon pulls task, composes prompt, executes brain, saves result
 * 3. Verify: Task completed, document created, hollon status updated
 *
 * Note: This test uses mocked brain provider to avoid actual Claude API calls
 */
describe('Orchestration E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orchestrator: HollonOrchestratorService;
  let taskPool: TaskPoolService;
  let promptComposer: PromptComposerService;

  // Test data IDs
  let testOrg: Organization;
  let testTeam: Team;
  let testRole: Role;
  let testHollon: Hollon;
  let testProject: Project;
  let testTask: Task;

  const mockBrainProvider = {
    executeWithTracking: jest.fn(),
  };

  const mockTaskExecutionService = {
    executeTask: jest.fn().mockResolvedValue({
      prUrl: 'https://github.com/test/repo/pull/1',
      worktreePath: '/tmp/test-worktree',
    }),
    setupTaskWorktree: jest.fn(),
    cleanupTaskWorktree: jest.fn(),
  };

  // Helper to get repositories
  const getOrganizationRepo = () => dataSource.getRepository(Organization);
  const getTeamRepo = () => dataSource.getRepository(Team);
  const getRoleRepo = () => dataSource.getRepository(Role);
  const getHollonRepo = () => dataSource.getRepository(Hollon);
  const getProjectRepo = () => dataSource.getRepository(Project);
  const getTaskRepo = () => dataSource.getRepository(Task);

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(BrainProviderService)
      .useValue(mockBrainProvider)
      .overrideProvider(TaskExecutionService)
      .useValue(mockTaskExecutionService)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    orchestrator = app.get(HollonOrchestratorService);
    taskPool = app.get(TaskPoolService);
    promptComposer = app.get(PromptComposerService);

    // Clean up before tests
    await cleanupTestData(dataSource);
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full Orchestration Cycle', () => {
    it('should execute complete workflow: setup → task pull → prompt composition → brain execution → completion', async () => {
      // ==================== SETUP PHASE ====================
      // Create organization using factory
      testOrg = await OrganizationFactory.createPersisted(
        getOrganizationRepo(),
        {
          description: 'E2E orchestration test organization',
        },
      );

      // Create team using factory
      testTeam = await TeamFactory.createPersisted(getTeamRepo(), testOrg.id, {
        description: 'E2E orchestration test team',
      });

      // Create role
      testRole = await getRoleRepo().save({
        name: 'E2E Backend Engineer',
        description: 'Test role for backend development',
        systemPrompt:
          'You are a senior backend engineer specializing in NestJS',
        capabilities: ['typescript', 'nestjs', 'postgresql'],
        organizationId: testOrg.id,
      });

      // Create hollon
      testHollon = await getHollonRepo().save({
        name: 'E2E Alpha Hollon',
        status: HollonStatus.IDLE,
        systemPrompt: 'You are Alpha, a diligent backend engineer.',
        maxConcurrentTasks: 1,
        organizationId: testOrg.id,
        teamId: testTeam.id,
        roleId: testRole.id,
      });

      // Create project
      testProject = await getProjectRepo().save({
        name: 'E2E Test Project',
        description: 'Test project for E2E',
        workingDirectory: '/tmp/e2e-test',
        organizationId: testOrg.id,
      });

      // Create task
      testTask = await getTaskRepo().save({
        title: 'E2E Test Task',
        description: 'Implement a simple function to add two numbers',
        type: TaskType.IMPLEMENTATION,
        acceptanceCriteria: [
          'Function should take two parameters',
          'Function should return the sum',
          'Add unit tests',
        ],
        affectedFiles: ['src/utils/math.ts'],
        priority: TaskPriority.P1_CRITICAL,
        status: TaskStatus.READY,
        assignedHollonId: testHollon.id,
        projectId: testProject.id,
        organizationId: testOrg.id,
      });

      // Mock brain provider response
      mockBrainProvider.executeWithTracking.mockResolvedValue({
        success: true,
        output: `I've implemented the add function in src/utils/math.ts:

\`\`\`typescript
export function add(a: number, b: number): number {
  return a + b;
}
\`\`\`

And added tests in src/utils/math.spec.ts:

\`\`\`typescript
describe('add', () => {
  it('should add two numbers', () => {
    expect(add(2, 3)).toBe(5);
  });
});
\`\`\`
`,
        duration: 5000,
        cost: {
          inputTokens: 1000,
          outputTokens: 500,
          totalCostCents: 0.15,
        },
      });

      // ==================== EXECUTION PHASE ====================
      const result = await orchestrator.runCycle(testHollon.id);

      // ==================== VERIFICATION PHASE ====================
      // Verify execution success
      expect(result.success).toBe(true);
      expect(result.taskId).toBe(testTask.id);
      expect(result.taskTitle).toBe('E2E Test Task');
      expect(result.output).toContain('Task executed with worktree isolation');
      expect(result.output).toContain('https://github.com/test/repo/pull/1');
      expect(result.duration).toBeGreaterThan(0);

      // Verify TaskExecutionService was called
      expect(mockTaskExecutionService.executeTask).toHaveBeenCalledWith(
        testTask.id,
        testHollon.id,
      );

      // Note: Task status is still IN_PROGRESS because TaskExecutionService is mocked
      // In real execution, TaskExecutionService would update it to READY_FOR_REVIEW
      const updatedTask = await getTaskRepo().findOne({
        where: { id: testTask.id },
      });
      expect(updatedTask?.status).toBe(TaskStatus.IN_PROGRESS);

      // Verify hollon status returned to IDLE
      const updatedHollon = await getHollonRepo().findOne({
        where: { id: testHollon.id },
      });
      expect(updatedHollon?.status).toBe(HollonStatus.IDLE);

      // Note: Document creation is handled by TaskExecutionService (mocked in this test)
      // In real execution, a document would be created
    });

    it('should handle no available tasks gracefully', async () => {
      // Create hollon without assigned tasks
      const idleHollon = await getHollonRepo().save({
        name: 'E2E Idle Hollon',
        status: HollonStatus.IDLE,
        systemPrompt: 'You are an idle hollon.',
        maxConcurrentTasks: 1,
        organizationId: testOrg.id,
        teamId: testTeam.id,
        roleId: testRole.id,
      });

      const result = await orchestrator.runCycle(idleHollon.id);

      expect(result.success).toBe(true);
      expect(result.noTaskAvailable).toBe(true);
      expect(mockBrainProvider.executeWithTracking).not.toHaveBeenCalled();

      // Cleanup
      await getHollonRepo().delete(idleHollon.id);
    });

    it('should handle file conflicts correctly', async () => {
      // Create first task and mark as in progress
      const task1 = await getTaskRepo().save({
        title: 'Task 1',
        description: 'First task',
        type: TaskType.IMPLEMENTATION,
        affectedFiles: ['src/common/utils.ts'],
        priority: TaskPriority.P1_CRITICAL,
        status: TaskStatus.IN_PROGRESS,
        assignedHollonId: testHollon.id,
        projectId: testProject.id,
        organizationId: testOrg.id,
      });

      // Create conflicting task
      const task2 = await getTaskRepo().save({
        title: 'Task 2',
        description: 'Conflicting task',
        type: TaskType.IMPLEMENTATION,
        affectedFiles: ['src/common/utils.ts'], // Same file!
        priority: TaskPriority.P1_CRITICAL,
        status: TaskStatus.READY,
        projectId: testProject.id,
        organizationId: testOrg.id,
      });

      // Create another hollon
      const hollon2 = await getHollonRepo().save({
        name: 'E2E Beta Hollon',
        status: HollonStatus.IDLE,
        systemPrompt: 'You are Beta.',
        maxConcurrentTasks: 1,
        organizationId: testOrg.id,
        teamId: testTeam.id,
        roleId: testRole.id,
      });

      // Try to pull task - should fail due to file conflict
      const pullResult = await taskPool.pullNextTask(hollon2.id);

      expect(pullResult.task).toBeNull();
      expect(pullResult.reason).toBe('No available tasks');

      // Cleanup
      await getTaskRepo().delete(task1.id);
      await getTaskRepo().delete(task2.id);
      await getHollonRepo().delete(hollon2.id);
    });

    it('should handle brain execution errors', async () => {
      // Create task
      const errorTask = await getTaskRepo().save({
        title: 'Error Task',
        description: 'This task will fail',
        type: TaskType.IMPLEMENTATION,
        priority: TaskPriority.P1_CRITICAL,
        status: TaskStatus.READY,
        assignedHollonId: testHollon.id,
        projectId: testProject.id,
        organizationId: testOrg.id,
      });

      // Mock task execution failure
      mockTaskExecutionService.executeTask.mockRejectedValueOnce(
        new Error('Task execution failed'),
      );

      const result = await orchestrator.runCycle(testHollon.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Task execution failed');

      // Verify hollon status - should be IDLE after error to allow picking up new tasks
      // ERROR state is reserved for unrecoverable situations
      const hollon = await getHollonRepo().findOne({
        where: { id: testHollon.id },
      });
      expect(hollon?.status).toBe(HollonStatus.IDLE);

      // Cleanup
      await getTaskRepo().delete(errorTask.id);

      // Reset hollon status
      await getHollonRepo().update(testHollon.id, {
        status: HollonStatus.IDLE,
      });
    });
  });

  describe('Task Pool Priority System', () => {
    it('should prioritize directly assigned tasks', async () => {
      // Create multiple tasks with different priorities
      const directTask = await getTaskRepo().save({
        title: 'Direct Task',
        description: 'Directly assigned',
        type: TaskType.IMPLEMENTATION,
        priority: TaskPriority.P2_HIGH,
        status: TaskStatus.READY,
        assignedHollonId: testHollon.id,
        projectId: testProject.id,
        organizationId: testOrg.id,
      });

      const unassignedTask = await getTaskRepo().save({
        title: 'Unassigned Task',
        description: 'Higher priority but unassigned',
        type: TaskType.IMPLEMENTATION,
        priority: TaskPriority.P1_CRITICAL,
        organizationId: testOrg.id,
        status: TaskStatus.READY,
        projectId: testProject.id,
      });

      // Pull task - should get directly assigned task despite lower priority
      const pullResult = await taskPool.pullNextTask(testHollon.id);

      expect(pullResult.task).toBeDefined();
      expect(pullResult.task?.id).toBe(directTask.id);
      expect(pullResult.reason).toBe('Directly assigned');

      // Cleanup
      await getTaskRepo().delete(directTask.id);
      await getTaskRepo().delete(unassignedTask.id);
    });
  });

  describe('Prompt Composition', () => {
    it('should compose all 6 layers correctly', async () => {
      // Create a task for testing
      const promptTask = await getTaskRepo().save({
        title: 'Prompt Test Task',
        description: 'Test prompt composition',
        type: TaskType.IMPLEMENTATION,
        acceptanceCriteria: ['Verify all layers present'],
        priority: TaskPriority.P1_CRITICAL,
        status: TaskStatus.READY,
        assignedHollonId: testHollon.id,
        projectId: testProject.id,
        organizationId: testOrg.id,
      });

      const prompt = await promptComposer.composePrompt(
        testHollon.id,
        promptTask.id,
      );

      // Verify all 6 layers
      expect(prompt.layers).toHaveProperty('organization');
      expect(prompt.layers).toHaveProperty('team');
      expect(prompt.layers).toHaveProperty('role');
      expect(prompt.layers).toHaveProperty('hollon');
      expect(prompt.layers).toHaveProperty('memories');
      expect(prompt.layers).toHaveProperty('task');

      // Verify content
      expect(prompt.systemPrompt).toContain(testOrg.name);
      expect(prompt.systemPrompt).toContain(testTeam.name);
      expect(prompt.systemPrompt).toContain(testRole.name);
      expect(prompt.systemPrompt).toContain(testHollon.name);

      expect(prompt.userPrompt).toContain(promptTask.title);
      expect(prompt.userPrompt).toContain(promptTask.description);

      expect(prompt.totalTokens).toBeGreaterThan(0);

      // Cleanup
      await getTaskRepo().delete(promptTask.id);
    });
  });
});
