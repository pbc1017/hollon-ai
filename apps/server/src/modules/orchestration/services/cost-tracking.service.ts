import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import {
  CostRecord,
  CostRecordType,
} from '../../cost-tracking/entities/cost-record.entity';

export interface BudgetLimit {
  daily?: number; // Cents
  monthly?: number; // Cents
  alertThresholdPercent?: number; // 0-100, default 80
  stopThresholdPercent?: number; // 0-100, default 100
}

export interface CostSummary {
  organizationId: string;
  periodStart: Date;
  periodEnd: Date;
  totalCostCents: number;
  totalRecords: number;
  costByType: Record<CostRecordType, number>;
  costByHollon: Record<string, number>;
  averageCostPerExecution: number;
  totalTokens: number;
}

export interface BudgetStatus {
  organizationId: string;
  period: 'daily' | 'monthly';
  limit: number; // Cents
  used: number; // Cents
  remaining: number; // Cents
  usagePercent: number; // 0-100
  status: 'ok' | 'warning' | 'exceeded';
  message: string;
  shouldStopWork: boolean;
}

export interface BudgetCheckResult {
  canProceed: boolean;
  dailyStatus: BudgetStatus | null;
  monthlyStatus: BudgetStatus | null;
  warnings: string[];
  blockers: string[];
}

@Injectable()
export class CostTrackingService {
  private readonly logger = new Logger(CostTrackingService.name);

  // In-memory budget limits (in production, this would be stored in database)
  private budgetLimits: Map<string, BudgetLimit> = new Map();

  // Default thresholds
  private readonly DEFAULT_ALERT_THRESHOLD = 80; // 80%
  private readonly DEFAULT_STOP_THRESHOLD = 100; // 100%

  constructor(
    @InjectRepository(CostRecord)
    private readonly costRecordRepo: Repository<CostRecord>,
  ) {}

  /**
   * Set budget limits for an organization
   */
  setBudgetLimits(organizationId: string, limits: BudgetLimit): void {
    this.budgetLimits.set(organizationId, {
      alertThresholdPercent: this.DEFAULT_ALERT_THRESHOLD,
      stopThresholdPercent: this.DEFAULT_STOP_THRESHOLD,
      ...limits,
    });

    this.logger.log(
      `Budget limits set for org ${organizationId}: ` +
        `daily=${limits.daily || 'none'}, monthly=${limits.monthly || 'none'}`,
    );
  }

  /**
   * Get budget limits for an organization
   */
  getBudgetLimits(organizationId: string): BudgetLimit | null {
    return this.budgetLimits.get(organizationId) || null;
  }

  /**
   * Check if organization can proceed with work
   * Checks both daily and monthly budgets
   */
  async checkBudget(organizationId: string): Promise<BudgetCheckResult> {
    const limits = this.budgetLimits.get(organizationId);

    if (!limits) {
      return {
        canProceed: true,
        dailyStatus: null,
        monthlyStatus: null,
        warnings: [],
        blockers: [],
      };
    }

    const warnings: string[] = [];
    const blockers: string[] = [];

    // Check daily budget
    let dailyStatus: BudgetStatus | null = null;
    if (limits.daily) {
      dailyStatus = await this.checkDailyBudget(organizationId, limits);

      if (dailyStatus.shouldStopWork) {
        blockers.push(dailyStatus.message);
      } else if (dailyStatus.status === 'warning') {
        warnings.push(dailyStatus.message);
      }
    }

    // Check monthly budget
    let monthlyStatus: BudgetStatus | null = null;
    if (limits.monthly) {
      monthlyStatus = await this.checkMonthlyBudget(organizationId, limits);

      if (monthlyStatus.shouldStopWork) {
        blockers.push(monthlyStatus.message);
      } else if (monthlyStatus.status === 'warning') {
        warnings.push(monthlyStatus.message);
      }
    }

    const canProceed = blockers.length === 0;

    if (!canProceed) {
      this.logger.warn(
        `Budget exceeded for org ${organizationId}: ${blockers.join(', ')}`,
      );
    } else if (warnings.length > 0) {
      this.logger.warn(
        `Budget warnings for org ${organizationId}: ${warnings.join(', ')}`,
      );
    }

    return {
      canProceed,
      dailyStatus,
      monthlyStatus,
      warnings,
      blockers,
    };
  }

  /**
   * Check daily budget status
   */
  private async checkDailyBudget(
    organizationId: string,
    limits: BudgetLimit,
  ): Promise<BudgetStatus> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const dailyUsed = await this.getCostForPeriod(
      organizationId,
      today,
      tomorrow,
    );
    const dailyLimit = limits.daily!;
    const remaining = Math.max(0, dailyLimit - dailyUsed);
    const usagePercent = (dailyUsed / dailyLimit) * 100;

    let status: 'ok' | 'warning' | 'exceeded' = 'ok';
    let shouldStopWork = false;
    let message = '';

    const alertThreshold =
      limits.alertThresholdPercent || this.DEFAULT_ALERT_THRESHOLD;
    const stopThreshold =
      limits.stopThresholdPercent || this.DEFAULT_STOP_THRESHOLD;

    if (usagePercent >= stopThreshold) {
      status = 'exceeded';
      shouldStopWork = true;
      message = `Daily budget exceeded: $${(dailyUsed / 100).toFixed(2)}/$${(dailyLimit / 100).toFixed(2)} (${usagePercent.toFixed(1)}%). Work stopped.`;
    } else if (usagePercent >= alertThreshold) {
      status = 'warning';
      message = `Daily budget warning: $${(dailyUsed / 100).toFixed(2)}/$${(dailyLimit / 100).toFixed(2)} (${usagePercent.toFixed(1)}%). Approaching limit.`;
    } else {
      message = `Daily budget OK: $${(dailyUsed / 100).toFixed(2)}/$${(dailyLimit / 100).toFixed(2)} (${usagePercent.toFixed(1)}%)`;
    }

    return {
      organizationId,
      period: 'daily',
      limit: dailyLimit,
      used: dailyUsed,
      remaining,
      usagePercent,
      status,
      message,
      shouldStopWork,
    };
  }

  /**
   * Check monthly budget status
   */
  private async checkMonthlyBudget(
    organizationId: string,
    limits: BudgetLimit,
  ): Promise<BudgetStatus> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    const monthlyUsed = await this.getCostForPeriod(
      organizationId,
      monthStart,
      monthEnd,
    );
    const monthlyLimit = limits.monthly!;
    const remaining = Math.max(0, monthlyLimit - monthlyUsed);
    const usagePercent = (monthlyUsed / monthlyLimit) * 100;

    let status: 'ok' | 'warning' | 'exceeded' = 'ok';
    let shouldStopWork = false;
    let message = '';

    const alertThreshold =
      limits.alertThresholdPercent || this.DEFAULT_ALERT_THRESHOLD;
    const stopThreshold =
      limits.stopThresholdPercent || this.DEFAULT_STOP_THRESHOLD;

    if (usagePercent >= stopThreshold) {
      status = 'exceeded';
      shouldStopWork = true;
      message = `Monthly budget exceeded: $${(monthlyUsed / 100).toFixed(2)}/$${(monthlyLimit / 100).toFixed(2)} (${usagePercent.toFixed(1)}%). Work stopped.`;
    } else if (usagePercent >= alertThreshold) {
      status = 'warning';
      message = `Monthly budget warning: $${(monthlyUsed / 100).toFixed(2)}/$${(monthlyLimit / 100).toFixed(2)} (${usagePercent.toFixed(1)}%). Approaching limit.`;
    } else {
      message = `Monthly budget OK: $${(monthlyUsed / 100).toFixed(2)}/$${(monthlyLimit / 100).toFixed(2)} (${usagePercent.toFixed(1)}%)`;
    }

    return {
      organizationId,
      period: 'monthly',
      limit: monthlyLimit,
      used: monthlyUsed,
      remaining,
      usagePercent,
      status,
      message,
      shouldStopWork,
    };
  }

  /**
   * Get total cost for a time period
   */
  async getCostForPeriod(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const result = await this.costRecordRepo
      .createQueryBuilder('cost')
      .select('SUM(cost.cost_cents)', 'total')
      .where('cost.organization_id = :organizationId', { organizationId })
      .andWhere('cost.created_at >= :startDate', { startDate })
      .andWhere('cost.created_at < :endDate', { endDate })
      .getRawOne();

    return parseFloat(result?.total || '0');
  }

  /**
   * Get cost summary for a period
   */
  async getCostSummary(
    organizationId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<CostSummary> {
    const records = await this.costRecordRepo.find({
      where: {
        organizationId,
        createdAt: Between(startDate, endDate),
      },
    });

    const totalCostCents = records.reduce((sum, r) => sum + r.costCents, 0);
    const totalTokens = records.reduce(
      (sum, r) => sum + r.inputTokens + r.outputTokens,
      0,
    );

    // Group by type
    const costByType = records.reduce(
      (acc, r) => {
        acc[r.type] = (acc[r.type] || 0) + r.costCents;
        return acc;
      },
      {} as Record<CostRecordType, number>,
    );

    // Group by hollon
    const costByHollon = records.reduce(
      (acc, r) => {
        if (r.hollonId) {
          acc[r.hollonId] = (acc[r.hollonId] || 0) + r.costCents;
        }
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      organizationId,
      periodStart: startDate,
      periodEnd: endDate,
      totalCostCents,
      totalRecords: records.length,
      costByType,
      costByHollon,
      averageCostPerExecution:
        records.length > 0 ? totalCostCents / records.length : 0,
      totalTokens,
    };
  }

  /**
   * Get daily cost summary for today
   */
  async getDailySummary(organizationId: string): Promise<CostSummary> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    return this.getCostSummary(organizationId, today, tomorrow);
  }

  /**
   * Get monthly cost summary for current month
   */
  async getMonthlySummary(organizationId: string): Promise<CostSummary> {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 1);

    return this.getCostSummary(organizationId, monthStart, monthEnd);
  }

  /**
   * Get cost records for a specific task
   */
  async getTaskCosts(taskId: string): Promise<CostRecord[]> {
    return this.costRecordRepo.find({
      where: { taskId },
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Get total cost for a task
   */
  async getTaskTotalCost(taskId: string): Promise<number> {
    const records = await this.getTaskCosts(taskId);
    return records.reduce((sum, r) => sum + r.costCents, 0);
  }

  /**
   * Get cost records for a specific hollon
   */
  async getHollonCosts(
    hollonId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<CostRecord[]> {
    const where: any = { hollonId };

    if (startDate && endDate) {
      where.createdAt = Between(startDate, endDate);
    }

    return this.costRecordRepo.find({
      where,
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * Clear all budget limits (useful for testing)
   */
  clearBudgetLimits(): void {
    this.budgetLimits.clear();
    this.logger.log('All budget limits cleared');
  }

  /**
   * Get all organizations with budget limits
   */
  getOrganizationsWithBudgets(): string[] {
    return Array.from(this.budgetLimits.keys());
  }
}
