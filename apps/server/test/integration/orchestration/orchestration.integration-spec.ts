import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import configuration from '../../../src/config/configuration';
import { getTestDatabaseConfig } from '../../setup/test-database';
import { HollonOrchestratorService } from '../../../src/modules/orchestration/services/hollon-orchestrator.service';
import { TaskPoolService } from '../../../src/modules/orchestration/services/task-pool.service';
import { PromptComposerService } from '../../../src/modules/orchestration/services/prompt-composer.service';
import { QualityGateService } from '../../../src/modules/orchestration/services/quality-gate.service';
import { EscalationService } from '../../../src/modules/orchestration/services/escalation.service';
import { BrainProviderService } from '../../../src/modules/brain-provider/brain-provider.service';
import {
  Hollon,
  HollonStatus,
} from '../../../src/modules/hollon/entities/hollon.entity';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
} from '../../../src/modules/task/entities/task.entity';
import { Document } from '../../../src/modules/document/entities/document.entity';
import { Organization } from '../../../src/modules/organization/entities/organization.entity';
import { Team } from '../../../src/modules/team/entities/team.entity';
import { Role } from '../../../src/modules/role/entities/role.entity';
import { Project } from '../../../src/modules/project/entities/project.entity';
import { OrganizationFactory } from '../../fixtures/organization.factory';
import { TeamFactory } from '../../fixtures/team.factory';

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
  let module: TestingModule;
  let orchestrator: HollonOrchestratorService;
  let taskPool: TaskPoolService;
  let promptComposer: PromptComposerService;

  let organizationRepo: Repository<Organization>;
  let teamRepo: Repository<Team>;
  let roleRepo: Repository<Role>;
  let hollonRepo: Repository<Hollon>;
  let projectRepo: Repository<Project>;
  let taskRepo: Repository<Task>;
  let documentRepo: Repository<Document>;

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

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) =>
            getTestDatabaseConfig(configService),
          inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([
          Organization,
          Team,
          Role,
          Hollon,
          Project,
          Task,
          Document,
        ]),
      ],
      providers: [
        HollonOrchestratorService,
        TaskPoolService,
        PromptComposerService,
        QualityGateService,
        {
          provide: BrainProviderService,
          useValue: mockBrainProvider,
        },
        {
          provide: EscalationService,
          useValue: {
            escalate: jest.fn(),
            determineEscalationLevel: jest.fn(),
            getEscalationHistory: jest.fn(),
            clearHistory: jest.fn(),
          },
        },
      ],
    }).compile();

    orchestrator = module.get<HollonOrchestratorService>(
      HollonOrchestratorService,
    );
    taskPool = module.get<TaskPoolService>(TaskPoolService);
    promptComposer = module.get<PromptComposerService>(PromptComposerService);
    module.get<BrainProviderService>(BrainProviderService);

    organizationRepo = module.get<Repository<Organization>>(
      getRepositoryToken(Organization),
    );
    teamRepo = module.get<Repository<Team>>(getRepositoryToken(Team));
    roleRepo = module.get<Repository<Role>>(getRepositoryToken(Role));
    hollonRepo = module.get<Repository<Hollon>>(getRepositoryToken(Hollon));
    projectRepo = module.get<Repository<Project>>(getRepositoryToken(Project));
    taskRepo = module.get<Repository<Task>>(getRepositoryToken(Task));
    documentRepo = module.get<Repository<Document>>(
      getRepositoryToken(Document),
    );
  });

  afterAll(async () => {
    // Cleanup test data (order matters for foreign key constraints)
    try {
      if (testTask) await taskRepo.delete(testTask.id);
      if (testHollon) await hollonRepo.delete(testHollon.id);
      if (testProject) await projectRepo.delete(testProject.id);
      if (testRole) await roleRepo.delete(testRole.id);
      if (testTeam) await teamRepo.delete(testTeam.id);
      if (testOrg) await organizationRepo.delete(testOrg.id);
    } catch (error) {
      // Ignore cleanup errors during test teardown
      console.log('Cleanup error (ignored):', error.message);
    }

    if (module) {
      await module.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Full Orchestration Cycle', () => {
    it('should execute complete workflow: setup → task pull → prompt composition → brain execution → completion', async () => {
      // ==================== SETUP PHASE ====================
      // Create organization using factory
      testOrg = await OrganizationFactory.createPersisted(organizationRepo, {
        description: 'E2E orchestration test organization',
      });

      // Create team using factory
      testTeam = await TeamFactory.createPersisted(teamRepo, testOrg.id, {
        description: 'E2E orchestration test team',
      });

      // Create role
      testRole = await roleRepo.save({
        name: 'E2E Backend Engineer',
        description: 'Test role for backend development',
        systemPrompt:
          'You are a senior backend engineer specializing in NestJS',
        capabilities: ['typescript', 'nestjs', 'postgresql'],
        organizationId: testOrg.id,
      });

      // Create hollon
      testHollon = await hollonRepo.save({
        name: 'E2E Alpha Hollon',
        status: HollonStatus.IDLE,
        systemPrompt: 'You are Alpha, a diligent backend engineer.',
        maxConcurrentTasks: 1,
        organizationId: testOrg.id,
        teamId: testTeam.id,
        roleId: testRole.id,
      });

      // Create project
      testProject = await projectRepo.save({
        name: 'E2E Test Project',
        description: 'Test project for E2E',
        workingDirectory: '/tmp/e2e-test',
        organizationId: testOrg.id,
      });

      // Create task
      testTask = await taskRepo.save({
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
      expect(result.output).toContain('add function');
      expect(result.duration).toBeGreaterThan(0);

      // Verify brain was called with correct parameters
      expect(mockBrainProvider.executeWithTracking).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: expect.any(String),
          systemPrompt: expect.any(String),
        }),
        expect.objectContaining({
          organizationId: testOrg.id,
          hollonId: testHollon.id,
          taskId: testTask.id,
        }),
      );

      // Verify task was completed
      const completedTask = await taskRepo.findOne({
        where: { id: testTask.id },
      });
      expect(completedTask?.status).toBe(TaskStatus.COMPLETED);
      expect(completedTask?.completedAt).toBeDefined();

      // Verify hollon status returned to IDLE
      const updatedHollon = await hollonRepo.findOne({
        where: { id: testHollon.id },
      });
      expect(updatedHollon?.status).toBe(HollonStatus.IDLE);

      // Verify document was created
      const documents = await documentRepo.find({
        where: { hollonId: testHollon.id },
      });
      expect(documents.length).toBeGreaterThan(0);
      expect(documents[0].content).toContain('add function');

      // Cleanup the created document
      await documentRepo.delete(documents[0].id);
    });

    it('should handle no available tasks gracefully', async () => {
      // Create hollon without assigned tasks
      const idleHollon = await hollonRepo.save({
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
      await hollonRepo.delete(idleHollon.id);
    });

    it('should handle file conflicts correctly', async () => {
      // Create first task and mark as in progress
      const task1 = await taskRepo.save({
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
      const task2 = await taskRepo.save({
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
      const hollon2 = await hollonRepo.save({
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
      await taskRepo.delete(task1.id);
      await taskRepo.delete(task2.id);
      await hollonRepo.delete(hollon2.id);
    });

    it('should handle brain execution errors', async () => {
      // Create task
      const errorTask = await taskRepo.save({
        title: 'Error Task',
        description: 'This task will fail',
        type: TaskType.IMPLEMENTATION,
        priority: TaskPriority.P1_CRITICAL,
        status: TaskStatus.READY,
        assignedHollonId: testHollon.id,
        projectId: testProject.id,
        organizationId: testOrg.id,
      });

      // Mock brain failure
      mockBrainProvider.executeWithTracking.mockRejectedValueOnce(
        new Error('Brain execution failed'),
      );

      const result = await orchestrator.runCycle(testHollon.id);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Brain execution failed');

      // Verify hollon status - should be IDLE after error to allow picking up new tasks
      // ERROR state is reserved for unrecoverable situations
      const hollon = await hollonRepo.findOne({
        where: { id: testHollon.id },
      });
      expect(hollon?.status).toBe(HollonStatus.IDLE);

      // Cleanup
      await taskRepo.delete(errorTask.id);

      // Reset hollon status
      await hollonRepo.update(testHollon.id, { status: HollonStatus.IDLE });
    });
  });

  describe('Task Pool Priority System', () => {
    it('should prioritize directly assigned tasks', async () => {
      // Create multiple tasks with different priorities
      const directTask = await taskRepo.save({
        title: 'Direct Task',
        description: 'Directly assigned',
        type: TaskType.IMPLEMENTATION,
        priority: TaskPriority.P2_HIGH,
        status: TaskStatus.READY,
        assignedHollonId: testHollon.id,
        projectId: testProject.id,
        organizationId: testOrg.id,
      });

      const unassignedTask = await taskRepo.save({
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
      await taskRepo.delete(directTask.id);
      await taskRepo.delete(unassignedTask.id);
    });
  });

  describe('Prompt Composition', () => {
    it('should compose all 6 layers correctly', async () => {
      // Create a task for testing
      const promptTask = await taskRepo.save({
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
      await taskRepo.delete(promptTask.id);
    });
  });
});
