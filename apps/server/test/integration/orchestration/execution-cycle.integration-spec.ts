import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { HollonOrchestratorService } from '../../src/modules/orchestration/services/hollon-orchestrator.service';
import { Organization } from '../../src/modules/organization/entities/organization.entity';
import { Team } from '../../src/modules/team/entities/team.entity';
import { Role } from '../../src/modules/role/entities/role.entity';
import { Hollon } from '../../src/modules/hollon/entities/hollon.entity';
import { Project } from '../../src/modules/project/entities/project.entity';
import { Task, TaskStatus, TaskType, TaskPriority } from '../../src/modules/task/entities/task.entity';
import { Document } from '../../src/modules/document/entities/document.entity';
import { CostRecord } from '../../src/modules/cost-tracking/entities/cost-record.entity';
import { BrainProviderConfig } from '../../src/modules/brain-provider/entities/brain-provider-config.entity';

/**
 * Full Execution Cycle E2E Test
 * 
 * Tests the complete Hollon execution cycle:
 * 1. Pull next task from task pool
 * 2. Compose 6-layer prompt
 * 3. Execute Brain Provider (Claude Code)
 * 4. Validate result with Quality Gate
 * 5. Save result as document
 * 6. Update task status to completed
 * 7. Record cost
 * 
 * This validates Phase 1 core functionality end-to-end.
 */
describe('Full Execution Cycle E2E', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orchestrator: HollonOrchestratorService;

  // Test entities
  let organization: Organization;
  let team: Team;
  let role: Role;
  let hollon: Hollon;
  let project: Project;
  let brainConfig: BrainProviderConfig;

  const testRunId = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    orchestrator = moduleFixture.get<HollonOrchestratorService>(
      HollonOrchestratorService,
    );

    // Clean database
    await dataSource.query(
      'TRUNCATE tasks, documents, cost_records, projects, hollons, roles, teams, brain_provider_configs, organizations RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Create test organization
    const orgRepo = dataSource.getRepository(Organization);
    organization = await orgRepo.save({
      name: `Test Org ${testRunId}`,
      description: 'Test organization for execution cycle',
      settings: {
        costLimitDailyCents: 10000, // $100/day
        costLimitMonthlyCents: 100000,
        maxHollonsPerTeam: 10,
        defaultTaskPriority: 'medium',
      },
    });

    // Create brain provider config
    const configRepo = dataSource.getRepository(BrainProviderConfig);
    brainConfig = await configRepo.save({
      organizationId: organization.id,
      providerId: 'claude_code',
      displayName: 'Claude Code',
      config: {},
      costPerInputTokenCents: 0.0003,
      costPerOutputTokenCents: 0.0015,
      enabled: true,
      timeoutSeconds: 120,
    });

    // Create team
    const teamRepo = dataSource.getRepository(Team);
    team = await teamRepo.save({
      organizationId: organization.id,
      name: `Test Team ${testRunId}`,
      description: 'Test team',
    });

    // Create role
    const roleRepo = dataSource.getRepository(Role);
    role = await roleRepo.save({
      organizationId: organization.id,
      name: `Test Developer ${testRunId}`,
      description: 'Test developer role',
      systemPrompt: 'You are a helpful software developer assistant.',
      capabilities: ['typescript', 'nodejs'],
    });

    // Create hollon
    const hollonRepo = dataSource.getRepository(Hollon);
    hollon = await hollonRepo.save({
      organizationId: organization.id,
      teamId: team.id,
      roleId: role.id,
      name: `Test Hollon ${testRunId}`,
      status: 'idle',
    });

    // Create project with working directory
    const projectRepo = dataSource.getRepository(Project);
    project = await projectRepo.save({
      organizationId: organization.id,
      name: `Test Project ${testRunId}`,
      description: 'Test project',
      workingDirectory: process.cwd(), // Use current directory for tests
    });
  });

  describe('Happy Path: Simple Task Execution', () => {
    it('should execute a simple task end-to-end', async () => {
      // 1. Create a simple task
      const taskRepo = dataSource.getRepository(Task);
      const task = await taskRepo.save({
        projectId: project.id,
        title: 'Calculate sum',
        description: 'Calculate 15 + 27 and return only the number.',
        type: TaskType.IMPLEMENTATION,
        priority: TaskPriority.P2,
        status: TaskStatus.READY,
        acceptanceCriteria: ['Must return 42'],
      });

      // 2. Run orchestration cycle
      const result = await orchestrator.runCycle(hollon.id);

      // 3. Verify result
      expect(result.success).toBe(true);
      expect(result.taskId).toBe(task.id);
      expect(result.output).toBeDefined();
      expect(result.output).toContain('42');

      // 4. Verify task status
      const updatedTask = await taskRepo.findOne({
        where: { id: task.id },
      });
      expect(updatedTask.status).toBe(TaskStatus.COMPLETED);
      expect(updatedTask.completedAt).toBeDefined();

      // 5. Verify document created
      const documentRepo = dataSource.getRepository(Document);
      const documents = await documentRepo.find({
        where: { projectId: project.id },
      });
      expect(documents.length).toBeGreaterThan(0);
      expect(documents[0].type).toBe('task_result');

      // 6. Verify cost recorded
      const costRepo = dataSource.getRepository(CostRecord);
      const costRecords = await costRepo.find({
        where: { organizationId: organization.id },
      });
      expect(costRecords.length).toBeGreaterThan(0);
      expect(costRecords[0].totalCostCents).toBeGreaterThan(0);
    }, 120000); // 2 minute timeout for Claude API call
  });

  describe('No Task Available', () => {
    it('should handle no available tasks gracefully', async () => {
      // Don't create any tasks

      const result = await orchestrator.runCycle(hollon.id);

      expect(result.success).toBe(true);
      expect(result.noTaskAvailable).toBe(true);
    });
  });

  describe('Cost Tracking', () => {
    it('should track cost for each execution', async () => {
      // Create task
      const taskRepo = dataSource.getRepository(Task);
      const task = await taskRepo.save({
        projectId: project.id,
        title: 'Simple greeting',
        description: 'Return the string "Hello World"',
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.READY,
      });

      // Execute
      await orchestrator.runCycle(hollon.id);

      // Verify cost record
      const costRepo = dataSource.getRepository(CostRecord);
      const costRecords = await costRepo.find({
        where: { 
          organizationId: organization.id,
          hollonId: hollon.id,
          taskId: task.id,
        },
      });

      expect(costRecords.length).toBe(1);
      expect(costRecords[0].inputTokens).toBeGreaterThan(0);
      expect(costRecords[0].outputTokens).toBeGreaterThan(0);
      expect(costRecords[0].totalCostCents).toBeGreaterThan(0);
    }, 120000);
  });

  describe('Multiple Task Execution', () => {
    it('should execute multiple tasks sequentially', async () => {
      // Create 3 simple tasks
      const taskRepo = dataSource.getRepository(Task);
      const tasks = await Promise.all([
        taskRepo.save({
          projectId: project.id,
          title: 'Task 1',
          description: 'Return "One"',
          type: TaskType.IMPLEMENTATION,
          status: TaskStatus.READY,
          priority: TaskPriority.P1,
        }),
        taskRepo.save({
          projectId: project.id,
          title: 'Task 2',
          description: 'Return "Two"',
          type: TaskType.IMPLEMENTATION,
          status: TaskStatus.READY,
          priority: TaskPriority.P2,
        }),
        taskRepo.save({
          projectId: project.id,
          title: 'Task 3',
          description: 'Return "Three"',
          type: TaskType.IMPLEMENTATION,
          status: TaskStatus.READY,
          priority: TaskPriority.P3,
        }),
      ]);

      // Execute 3 cycles
      const results = [];
      for (let i = 0; i < 3; i++) {
        const result = await orchestrator.runCycle(hollon.id);
        results.push(result);
      }

      // Verify all succeeded
      expect(results.every((r) => r.success)).toBe(true);
      expect(results.filter((r) => r.taskId).length).toBe(3);

      // Verify all tasks completed
      const completedTasks = await taskRepo.find({
        where: { 
          projectId: project.id,
          status: TaskStatus.COMPLETED,
        },
      });
      expect(completedTasks.length).toBe(3);

      // Verify executed in priority order (P1, P2, P3)
      expect(results[0].taskId).toBe(tasks[0].id); // P1 first
      expect(results[1].taskId).toBe(tasks[1].id); // P2 second
      expect(results[2].taskId).toBe(tasks[2].id); // P3 third
    }, 360000); // 6 minute timeout for 3 API calls
  });
});
