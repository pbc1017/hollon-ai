import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CostTrackingService } from './cost-tracking.service';
import {
  CostRecord,
  CostRecordType,
} from '../../cost-tracking/entities/cost-record.entity';
import { Organization } from '../../organization/entities/organization.entity';

describe('CostTrackingService', () => {
  let service: CostTrackingService;
  let module: TestingModule;
  let costRecordRepo: jest.Mocked<Repository<CostRecord>>;

  const mockCostRecord = (overrides: Partial<CostRecord> = {}): CostRecord =>
    ({
      id: 'cost-1',
      organizationId: 'org-1',
      hollonId: 'hollon-1',
      taskId: 'task-1',
      type: CostRecordType.BRAIN_EXECUTION,
      providerId: 'claude_code',
      modelUsed: 'claude-sonnet-4-5',
      inputTokens: 100,
      outputTokens: 50,
      costCents: 0.15,
      executionTimeMs: 1200,
      metadata: '{}',
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as CostRecord;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        CostTrackingService,
        {
          provide: getRepositoryToken(CostRecord),
          useValue: {
            find: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Organization),
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<CostTrackingService>(CostTrackingService);
    costRecordRepo = module.get(getRepositoryToken(CostRecord));
  });

  afterEach(async () => {
    service.clearBudgetLimits();
    jest.clearAllMocks();
    if (module) {
      await module.close();
    }
  });

  describe('setBudgetLimits', () => {
    it('should set daily budget limit', () => {
      service.setBudgetLimits('org-1', {
        daily: 1000, // $10.00
      });

      const limits = service.getBudgetLimits('org-1');
      expect(limits).toBeDefined();
      expect(limits?.daily).toBe(1000);
    });

    it('should set monthly budget limit', () => {
      service.setBudgetLimits('org-1', {
        monthly: 10000, // $100.00
      });

      const limits = service.getBudgetLimits('org-1');
      expect(limits?.monthly).toBe(10000);
    });

    it('should set both daily and monthly limits', () => {
      service.setBudgetLimits('org-1', {
        daily: 1000,
        monthly: 10000,
      });

      const limits = service.getBudgetLimits('org-1');
      expect(limits?.daily).toBe(1000);
      expect(limits?.monthly).toBe(10000);
    });

    it('should set custom threshold percentages', () => {
      service.setBudgetLimits('org-1', {
        daily: 1000,
        alertThresholdPercent: 70,
        stopThresholdPercent: 90,
      });

      const limits = service.getBudgetLimits('org-1');
      expect(limits?.alertThresholdPercent).toBe(70);
      expect(limits?.stopThresholdPercent).toBe(90);
    });
  });

  describe('getBudgetLimits', () => {
    it('should return null for organization without limits', () => {
      const limits = service.getBudgetLimits('org-nonexistent');
      expect(limits).toBeNull();
    });

    it('should return set limits', () => {
      service.setBudgetLimits('org-1', { daily: 1000 });
      const limits = service.getBudgetLimits('org-1');
      expect(limits?.daily).toBe(1000);
    });
  });

  describe('checkBudget', () => {
    it('should allow work when no budget limits set', async () => {
      const result = await service.checkBudget('org-1');

      expect(result.canProceed).toBe(true);
      expect(result.dailyStatus).toBeNull();
      expect(result.monthlyStatus).toBeNull();
      expect(result.warnings).toHaveLength(0);
      expect(result.blockers).toHaveLength(0);
    });

    it('should allow work when under daily budget', async () => {
      service.setBudgetLimits('org-1', { daily: 1000 });

      // Mock query builder for getCostForPeriod
      const queryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '500' }), // $5.00 used
      };

      costRecordRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);

      const result = await service.checkBudget('org-1');

      expect(result.canProceed).toBe(true);
      expect(result.dailyStatus?.status).toBe('ok');
      expect(result.dailyStatus?.usagePercent).toBe(50);
      expect(result.blockers).toHaveLength(0);
    });

    it('should warn when approaching daily budget', async () => {
      service.setBudgetLimits('org-1', { daily: 1000 });

      const queryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '850' }), // 85% used
      };

      costRecordRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);

      const result = await service.checkBudget('org-1');

      expect(result.canProceed).toBe(true); // Can still proceed
      expect(result.dailyStatus?.status).toBe('warning');
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.blockers).toHaveLength(0);
    });

    it('should block work when daily budget exceeded', async () => {
      service.setBudgetLimits('org-1', { daily: 1000 });

      const queryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '1050' }), // 105% used
      };

      costRecordRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);

      const result = await service.checkBudget('org-1');

      expect(result.canProceed).toBe(false);
      expect(result.dailyStatus?.status).toBe('exceeded');
      expect(result.dailyStatus?.shouldStopWork).toBe(true);
      expect(result.blockers.length).toBeGreaterThan(0);
    });

    it('should check both daily and monthly budgets', async () => {
      service.setBudgetLimits('org-1', {
        daily: 1000,
        monthly: 10000,
      });

      const queryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest
          .fn()
          .mockResolvedValueOnce({ total: '500' }) // Daily OK
          .mockResolvedValueOnce({ total: '8500' }), // Monthly warning
      };

      costRecordRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);

      const result = await service.checkBudget('org-1');

      expect(result.canProceed).toBe(true);
      expect(result.dailyStatus?.status).toBe('ok');
      expect(result.monthlyStatus?.status).toBe('warning');
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it('should block if either daily or monthly budget exceeded', async () => {
      service.setBudgetLimits('org-1', {
        daily: 1000,
        monthly: 10000,
      });

      const queryBuilder: any = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest
          .fn()
          .mockResolvedValueOnce({ total: '1200' }) // Daily exceeded
          .mockResolvedValueOnce({ total: '5000' }), // Monthly OK
      };

      costRecordRepo.createQueryBuilder = jest
        .fn()
        .mockReturnValue(queryBuilder);

      const result = await service.checkBudget('org-1');

      expect(result.canProceed).toBe(false);
      expect(result.blockers.length).toBeGreaterThan(0);
    });
  });

  describe('getCostSummary', () => {
    it('should return cost summary for period', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-02');

      const records = [
        mockCostRecord({
          costCents: 100,
          type: CostRecordType.BRAIN_EXECUTION,
          hollonId: 'hollon-1',
        }),
        mockCostRecord({
          costCents: 200,
          type: CostRecordType.BRAIN_EXECUTION,
          hollonId: 'hollon-1',
        }),
        mockCostRecord({
          costCents: 150,
          type: CostRecordType.TASK_ANALYSIS,
          hollonId: 'hollon-2',
        }),
      ];

      costRecordRepo.find = jest.fn().mockResolvedValue(records);

      const summary = await service.getCostSummary('org-1', startDate, endDate);

      expect(summary.totalCostCents).toBe(450);
      expect(summary.totalRecords).toBe(3);
      expect(summary.costByType[CostRecordType.BRAIN_EXECUTION]).toBe(300);
      expect(summary.costByType[CostRecordType.TASK_ANALYSIS]).toBe(150);
      expect(summary.costByHollon['hollon-1']).toBe(300);
      expect(summary.costByHollon['hollon-2']).toBe(150);
      expect(summary.averageCostPerExecution).toBe(150);
    });

    it('should handle empty period', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-02');

      costRecordRepo.find = jest.fn().mockResolvedValue([]);

      const summary = await service.getCostSummary('org-1', startDate, endDate);

      expect(summary.totalCostCents).toBe(0);
      expect(summary.totalRecords).toBe(0);
      expect(summary.averageCostPerExecution).toBe(0);
    });
  });

  describe('getTaskCosts', () => {
    it('should return all cost records for a task', async () => {
      const records = [
        mockCostRecord({ taskId: 'task-1', costCents: 100 }),
        mockCostRecord({ taskId: 'task-1', costCents: 200 }),
      ];

      costRecordRepo.find = jest.fn().mockResolvedValue(records);

      const costs = await service.getTaskCosts('task-1');

      expect(costs).toHaveLength(2);
      expect(costRecordRepo.find).toHaveBeenCalledWith({
        where: { taskId: 'task-1' },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('getTaskTotalCost', () => {
    it('should return total cost for a task', async () => {
      const records = [
        mockCostRecord({ taskId: 'task-1', costCents: 100 }),
        mockCostRecord({ taskId: 'task-1', costCents: 250 }),
        mockCostRecord({ taskId: 'task-1', costCents: 150 }),
      ];

      costRecordRepo.find = jest.fn().mockResolvedValue(records);

      const total = await service.getTaskTotalCost('task-1');

      expect(total).toBe(500);
    });

    it('should return 0 for task with no costs', async () => {
      costRecordRepo.find = jest.fn().mockResolvedValue([]);

      const total = await service.getTaskTotalCost('task-nonexistent');

      expect(total).toBe(0);
    });
  });

  describe('getHollonCosts', () => {
    it('should return costs for a hollon', async () => {
      const records = [
        mockCostRecord({ hollonId: 'hollon-1', costCents: 100 }),
        mockCostRecord({ hollonId: 'hollon-1', costCents: 200 }),
      ];

      costRecordRepo.find = jest.fn().mockResolvedValue(records);

      const costs = await service.getHollonCosts('hollon-1');

      expect(costs).toHaveLength(2);
    });

    it('should filter by date range when provided', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');

      costRecordRepo.find = jest.fn().mockResolvedValue([]);

      await service.getHollonCosts('hollon-1', startDate, endDate);

      expect(costRecordRepo.find).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            hollonId: 'hollon-1',
            createdAt: expect.anything(),
          }),
        }),
      );
    });
  });

  describe('getDailySummary', () => {
    it('should return summary for today', async () => {
      const records = [mockCostRecord({ costCents: 100 })];

      costRecordRepo.find = jest.fn().mockResolvedValue(records);

      const summary = await service.getDailySummary('org-1');

      expect(summary.totalCostCents).toBe(100);
      expect(summary.organizationId).toBe('org-1');
    });
  });

  describe('getMonthlySummary', () => {
    it('should return summary for current month', async () => {
      const records = [
        mockCostRecord({ costCents: 100 }),
        mockCostRecord({ costCents: 200 }),
      ];

      costRecordRepo.find = jest.fn().mockResolvedValue(records);

      const summary = await service.getMonthlySummary('org-1');

      expect(summary.totalCostCents).toBe(300);
      expect(summary.organizationId).toBe('org-1');
    });
  });

  describe('clearBudgetLimits', () => {
    it('should clear all budget limits', () => {
      service.setBudgetLimits('org-1', { daily: 1000 });
      service.setBudgetLimits('org-2', { daily: 2000 });

      service.clearBudgetLimits();

      expect(service.getBudgetLimits('org-1')).toBeNull();
      expect(service.getBudgetLimits('org-2')).toBeNull();
    });
  });

  describe('getOrganizationsWithBudgets', () => {
    it('should return list of organizations with budgets', () => {
      service.setBudgetLimits('org-1', { daily: 1000 });
      service.setBudgetLimits('org-2', { monthly: 10000 });

      const orgs = service.getOrganizationsWithBudgets();

      expect(orgs).toContain('org-1');
      expect(orgs).toContain('org-2');
      expect(orgs).toHaveLength(2);
    });

    it('should return empty array when no budgets set', () => {
      const orgs = service.getOrganizationsWithBudgets();
      expect(orgs).toHaveLength(0);
    });
  });
});
