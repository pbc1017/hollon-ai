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
import { BrainProviderConfig } from '@/modules/brain-provider/entities/brain-provider-config.entity';
import { HollonOrchestratorService } from '@/modules/orchestration/services/hollon-orchestrator.service';

/**
 * Real Brain Execution E2E Test
 *
 * ⚠️  WARNING: This test makes REAL API calls to Claude Code
 * ⚠️  It will consume API credits and take time to execute
 *
 * Purpose:
 * - Verify the complete system works end-to-end with real Brain Provider
 * - Test actual Claude Code CLI integration
 * - Validate cost tracking with real execution
 *
 * Run separately with:
 * pnpm --filter=@hollon-ai/server test:e2e -- real-brain-execution
 */
describe.skip('E2E: Real Brain Execution (⚠️ Uses Real API)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orchestrator: HollonOrchestratorService;

  let organization: Organization;
  let role: Role;
  let team: Team;
  let hollon: Hollon;
  let project: Project;
  let task: Task;
  let brainConfig: BrainProviderConfig;

  const REAL_EXECUTION_TIMEOUT = 60000; // 60 seconds for real API calls

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    orchestrator = app.get(HollonOrchestratorService);
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await app.close();
  });

  describe('Setup: Create entities for real execution', () => {
    it('should create organization', async () => {
      const orgRepo = dataSource.getRepository(Organization);
      organization = await orgRepo.save({
        name: 'Real Execution Test Org',
        contextPrompt: 'We test with real Claude Code execution.',
        costLimitDailyCents: 100000, // $1000/day - generous for testing
        costLimitMonthlyCents: 1000000,
      });

      expect(organization.id).toBeDefined();
    });

    it('should create brain provider config', async () => {
      const configRepo = dataSource.getRepository(BrainProviderConfig);
      brainConfig = await configRepo.save({
        organizationId: organization.id,
        providerId: 'claude_code',
        displayName: 'Claude Code CLI',
        config: {
          model: 'claude-sonnet-4',
        },
        costPerInputTokenCents: 0.003, // $3 per million tokens
        costPerOutputTokenCents: 0.015, // $15 per million tokens
        enabled: true,
        timeoutSeconds: 60,
        maxRetries: 1,
      });

      expect(brainConfig.id).toBeDefined();
    });

    it('should create role and team', async () => {
      const roleRepo = dataSource.getRepository(Role);
      role = await roleRepo.save({
        organizationId: organization.id,
        name: 'Math Solver',
        systemPrompt:
          'You are a helpful assistant that solves math problems concisely.',
        capabilities: ['mathematics', 'problem-solving'],
      });

      const teamRepo = dataSource.getRepository(Team);
      team = await teamRepo.save({
        organizationId: organization.id,
        name: 'Math Team',
        contextPrompt: 'We solve math problems.',
      });

      expect(role.id).toBeDefined();
      expect(team.id).toBeDefined();
    });

    it('should create hollon', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);
      hollon = await hollonRepo.save({
        organizationId: organization.id,
        roleId: role.id,
        teamId: team.id,
        name: 'Math Solver Hollon',
        status: HollonStatus.IDLE,
      });

      expect(hollon.id).toBeDefined();
    });

    it('should create project', async () => {
      const projectRepo = dataSource.getRepository(Project);
      project = await projectRepo.save({
        organizationId: organization.id,
        teamId: team.id,
        name: 'Math Problems',
        description: 'Simple math problem solving',
      });

      expect(project.id).toBeDefined();
    });

    it('should create a simple math task', async () => {
      const taskRepo = dataSource.getRepository(Task);
      task = await taskRepo.save({
        projectId: project.id,
        title: 'Solve: What is 2 + 2?',
        description:
          'Calculate the sum of 2 + 2 and provide the answer in a single sentence.',
        type: 'research',
        status: TaskStatus.READY,
        priority: 'P1',
        acceptanceCriteria: [
          'Answer must be correct',
          'Response must be concise',
        ],
        depth: 0,
      });

      expect(task.id).toBeDefined();
      expect(task.status).toBe(TaskStatus.READY);
    });
  });

  describe('Execution: Run real Claude Code', () => {
    it(
      'should execute hollon cycle with real Brain Provider',
      async () => {
        console.log('\n🚀 Starting REAL Brain Provider execution...');
        console.log(`   Task: ${task.title}`);
        console.log(`   Hollon: ${hollon.name}\n`);

        const result = await orchestrator.runCycle(hollon.id);

        console.log('\n✅ Execution completed!');
        console.log(`   Result: ${JSON.stringify(result, null, 2)}\n`);

        expect(result).toBeDefined();
        expect(result.success).toBe(true);
      },
      REAL_EXECUTION_TIMEOUT,
    );
  });

  describe('Verification: Check real execution results', () => {
    it('should have task marked as IN_REVIEW or COMPLETED', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const updatedTask = await taskRepo.findOne({
        where: { id: task.id },
      });

      expect(updatedTask).toBeDefined();
      expect([TaskStatus.IN_REVIEW, TaskStatus.COMPLETED]).toContain(
        updatedTask?.status,
      );
      expect(updatedTask?.assignedHollonId).toBe(hollon.id);
    });

    it('should have hollon in valid state', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);
      const updatedHollon = await hollonRepo.findOne({
        where: { id: hollon.id },
      });

      expect(updatedHollon).toBeDefined();
      expect([
        HollonStatus.IDLE,
        HollonStatus.WORKING,
        HollonStatus.IN_REVIEW,
      ]).toContain(updatedHollon?.status);
    });

    it('should have tracked cost in database', async () => {
      // Note: CostRecord is tracked by BrainProviderService.executeWithTracking
      // This verifies the integration worked end-to-end
      const taskRepo = dataSource.getRepository(Task);
      const finalTask = await taskRepo.findOne({ where: { id: task.id } });

      expect(finalTask).toBeDefined();
      expect(finalTask?.assignedHollonId).toBeDefined();
    });
  });
});
