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
import {
  CostRecord,
  CostRecordType,
} from '@/modules/cost-tracking/entities/cost-record.entity';
import { CostTrackingService } from '@/modules/orchestration/services/cost-tracking.service';

/**
 * Scenario 3: Budget Exceeded
 *
 * 검증 시나리오:
 * 1. 낮은 비용 한도 설정
 * 2. 한도 초과 시 작업 중단 확인
 */
describe('Integration: Scenario 3 - Budget Exceeded', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let costTracking: CostTrackingService;

  let organization: Organization;
  let role: Role;
  let team: Team;
  let hollon: Hollon;
  let project: Project;
  let task: Task;

  const LOW_DAILY_BUDGET = 100; // $1.00 daily limit (very low for testing)
  const LOW_MONTHLY_BUDGET = 1000; // $10.00 monthly limit

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    costTracking = app.get(CostTrackingService);
  });

  afterAll(async () => {
    costTracking.clearBudgetLimits();
    await dataSource.dropDatabase();
    await app.close();
  });

  describe('Setup: Create test entities with low budget', () => {
    it('should create organization with low budget', async () => {
      const orgRepo = dataSource.getRepository(Organization);
      organization = await orgRepo.save({
        name: 'Budget Test Organization',
        contextPrompt: 'We have strict budget constraints.',
        costLimitDailyCents: LOW_DAILY_BUDGET,
        costLimitMonthlyCents: LOW_MONTHLY_BUDGET,
      });

      expect(organization.id).toBeDefined();
      expect(organization.costLimitDailyCents).toBe(LOW_DAILY_BUDGET);
    });

    it('should set budget limits in cost tracking service', () => {
      costTracking.setBudgetLimits(organization.id, {
        daily: LOW_DAILY_BUDGET,
        monthly: LOW_MONTHLY_BUDGET,
        alertThresholdPercent: 80,
        stopThresholdPercent: 100,
      });

      const limits = costTracking.getBudgetLimits(organization.id);
      expect(limits).toBeDefined();
      expect(limits?.daily).toBe(LOW_DAILY_BUDGET);
      expect(limits?.monthly).toBe(LOW_MONTHLY_BUDGET);
    });

    it('should create role, team, hollon', async () => {
      const roleRepo = dataSource.getRepository(Role);
      role = await roleRepo.save({
        organizationId: organization.id,
        name: 'Budget Tester',
        systemPrompt: 'You work within budget constraints.',
        capabilities: ['testing'],
      });

      const teamRepo = dataSource.getRepository(Team);
      team = await teamRepo.save({
        organizationId: organization.id,
        name: 'Budget Team',
        contextPrompt: 'Budget aware team.',
      });

      const hollonRepo = dataSource.getRepository(Hollon);
      hollon = await hollonRepo.save({
        organizationId: organization.id,
        roleId: role.id,
        teamId: team.id,
        name: 'Budget Hollon',
        status: HollonStatus.IDLE,
      });

      expect(role.id).toBeDefined();
      expect(team.id).toBeDefined();
      expect(hollon.id).toBeDefined();
    });

    it('should create project and task', async () => {
      const projectRepo = dataSource.getRepository(Project);
      project = await projectRepo.save({
        organizationId: organization.id,
        teamId: team.id,
        name: 'Budget Test Project',
        description: 'Testing budget limits',
      });

      const taskRepo = dataSource.getRepository(Task);
      task = await taskRepo.save({
        projectId: project.id,
        organizationId: organization.id,
        title: 'Simple task',
        description: 'This should not execute due to budget',
        type: 'implementation',
        status: TaskStatus.READY,
        priority: 'P2',
        depth: 0,
      });

      expect(project.id).toBeDefined();
      expect(task.id).toBeDefined();
    });
  });

  describe('Execution: Simulate cost accumulation', () => {
    it('should start with zero cost', async () => {
      const summary = await costTracking.getDailySummary(organization.id);

      expect(summary.totalCostCents).toBe(0);
      expect(summary.totalRecords).toBe(0);
    });

    it('should allow work when under budget', async () => {
      const budgetCheck = await costTracking.checkBudget(organization.id);

      expect(budgetCheck.canProceed).toBe(true);
      expect(budgetCheck.blockers).toHaveLength(0);
      expect(budgetCheck.dailyStatus?.status).toBe('ok');
    });

    it('should record costs and reach 80% warning threshold', async () => {
      const costRepo = dataSource.getRepository(CostRecord);

      // Add cost records that reach 80% of daily budget
      const costAt80Percent = Math.floor(LOW_DAILY_BUDGET * 0.81);

      await costRepo.save({
        organizationId: organization.id,
        hollonId: hollon.id,
        taskId: task.id,
        type: CostRecordType.BRAIN_EXECUTION,
        providerId: 'claude_code',
        modelUsed: 'claude-sonnet-4-5',
        inputTokens: 1000,
        outputTokens: 500,
        costCents: costAt80Percent,
        executionTimeMs: 2000,
      });

      const budgetCheck = await costTracking.checkBudget(organization.id);

      expect(budgetCheck.canProceed).toBe(true); // Still can proceed
      expect(budgetCheck.warnings.length).toBeGreaterThan(0); // But has warnings
      expect(budgetCheck.dailyStatus?.status).toBe('warning');
      expect(budgetCheck.dailyStatus?.usagePercent).toBeGreaterThan(80);
    });

    it('should block work when budget exceeded', async () => {
      const costRepo = dataSource.getRepository(CostRecord);

      // Add another cost record to exceed budget
      await costRepo.save({
        organizationId: organization.id,
        hollonId: hollon.id,
        taskId: task.id,
        type: CostRecordType.BRAIN_EXECUTION,
        providerId: 'claude_code',
        modelUsed: 'claude-sonnet-4-5',
        inputTokens: 500,
        outputTokens: 250,
        costCents: 50, // Push over the limit
        executionTimeMs: 1000,
      });

      const budgetCheck = await costTracking.checkBudget(organization.id);

      expect(budgetCheck.canProceed).toBe(false); // Should be blocked
      expect(budgetCheck.blockers.length).toBeGreaterThan(0);
      expect(budgetCheck.dailyStatus?.status).toBe('exceeded');
      expect(budgetCheck.dailyStatus?.shouldStopWork).toBe(true);
      expect(budgetCheck.dailyStatus?.usagePercent).toBeGreaterThan(100);
    });
  });

  describe('Verification: Check budget enforcement', () => {
    it('should have exceeded daily budget', async () => {
      const summary = await costTracking.getDailySummary(organization.id);

      expect(summary.totalCostCents).toBeGreaterThan(LOW_DAILY_BUDGET);
    });

    it('should return clear error message about budget', async () => {
      const budgetCheck = await costTracking.checkBudget(organization.id);

      expect(budgetCheck.blockers.length).toBeGreaterThan(0);
      expect(budgetCheck.blockers[0]).toContain('budget');
      expect(budgetCheck.blockers[0].toLowerCase()).toContain('exceeded');
    });

    it('should have cost breakdown by type', async () => {
      const summary = await costTracking.getDailySummary(organization.id);

      expect(summary.costByType).toBeDefined();
      expect(
        summary.costByType[CostRecordType.BRAIN_EXECUTION],
      ).toBeGreaterThan(0);
    });

    it('should have cost breakdown by hollon', async () => {
      const summary = await costTracking.getDailySummary(organization.id);

      expect(summary.costByHollon).toBeDefined();
      expect(summary.costByHollon[hollon.id]).toBeGreaterThan(0);
    });

    it('should track total tokens used', async () => {
      const summary = await costTracking.getDailySummary(organization.id);

      expect(summary.totalTokens).toBeGreaterThan(0);
    });
  });

  describe('Cleanup: Verify budget reset logic', () => {
    it('should allow clearing budget limits for testing', () => {
      costTracking.clearBudgetLimits();

      const limits = costTracking.getBudgetLimits(organization.id);
      expect(limits).toBeNull();
    });

    it('should allow work after clearing budget limits', async () => {
      const budgetCheck = await costTracking.checkBudget(organization.id);

      // Without budget limits, should always allow work
      expect(budgetCheck.canProceed).toBe(true);
      expect(budgetCheck.blockers).toHaveLength(0);
    });

    it('should track task costs correctly', async () => {
      const taskCosts = await costTracking.getTaskCosts(task.id);

      expect(taskCosts.length).toBeGreaterThan(0);
      expect(taskCosts.every((c) => c.taskId === task.id)).toBe(true);
    });

    it('should calculate task total cost', async () => {
      const totalCost = await costTracking.getTaskTotalCost(task.id);

      expect(totalCost).toBeGreaterThan(0);
    });
  });
});
