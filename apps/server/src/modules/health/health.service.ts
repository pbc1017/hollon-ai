import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Hollon, HollonStatus } from '../hollon/entities/hollon.entity';
import { Task, TaskStatus } from '../task/entities/task.entity';

export interface MemoryUsage {
  heapUsed: number;
  heapTotal: number;
  external: number;
  rss: number;
  heapUsedMB: string;
  heapTotalMB: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  checks: {
    database: {
      status: 'up' | 'down';
      latency?: number;
      error?: string;
    };
  };
  hollons?: {
    total: number;
    active: number;
    byStatus: Record<string, number>;
  };
  tasks?: {
    total: number;
    inProgress: number;
    byStatus: Record<string, number>;
  };
  memory?: MemoryUsage;
}

@Injectable()
export class HealthService {
  private readonly startTime = Date.now();

  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  check(): HealthCheckResult {
    const memory = this.getMemoryUsage();

    return {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {
        database: {
          status: this.dataSource.isInitialized ? 'up' : 'down',
        },
      },
      memory,
    };
  }

  async readinessCheck(): Promise<HealthCheckResult> {
    const [dbCheck, hollonStats, taskStats] = await Promise.all([
      this.checkDatabase(),
      this.getHollonStats(),
      this.getTaskStats(),
    ]);

    const memory = this.getMemoryUsage();
    const isHealthy = dbCheck.status === 'up';

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '0.1.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks: {
        database: dbCheck,
      },
      hollons: hollonStats,
      tasks: taskStats,
      memory,
    };
  }

  private async checkDatabase(): Promise<{
    status: 'up' | 'down';
    latency?: number;
    error?: string;
  }> {
    try {
      const startTime = Date.now();
      await this.dataSource.query('SELECT 1');
      const latency = Date.now() - startTime;

      return {
        status: 'up',
        latency,
      };
    } catch (error) {
      return {
        status: 'down',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async getHollonStats(): Promise<{
    total: number;
    active: number;
    byStatus: Record<string, number>;
  }> {
    try {
      const hollonRepo = this.dataSource.getRepository(Hollon);

      // 상태별 집계
      const statusCounts = await hollonRepo
        .createQueryBuilder('hollon')
        .select('hollon.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('hollon.status')
        .getRawMany<{ status: string; count: string }>();

      const byStatus: Record<string, number> = {};
      let total = 0;
      let active = 0;

      for (const row of statusCounts) {
        const count = parseInt(row.count, 10);
        byStatus[row.status] = count;
        total += count;

        // 활성 홀론: WORKING 또는 REVIEWING 상태
        if (
          row.status === HollonStatus.WORKING ||
          row.status === HollonStatus.REVIEWING
        ) {
          active += count;
        }
      }

      return { total, active, byStatus };
    } catch {
      return { total: 0, active: 0, byStatus: {} };
    }
  }

  private async getTaskStats(): Promise<{
    total: number;
    inProgress: number;
    byStatus: Record<string, number>;
  }> {
    try {
      const taskRepo = this.dataSource.getRepository(Task);

      // 상태별 집계
      const statusCounts = await taskRepo
        .createQueryBuilder('task')
        .select('task.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .groupBy('task.status')
        .getRawMany<{ status: string; count: string }>();

      const byStatus: Record<string, number> = {};
      let total = 0;
      let inProgress = 0;

      for (const row of statusCounts) {
        const count = parseInt(row.count, 10);
        byStatus[row.status] = count;
        total += count;

        // 진행중인 태스크: IN_PROGRESS 또는 IN_REVIEW 상태
        if (
          row.status === TaskStatus.IN_PROGRESS ||
          row.status === TaskStatus.IN_REVIEW
        ) {
          inProgress += count;
        }
      }

      return { total, inProgress, byStatus };
    } catch {
      return { total: 0, inProgress: 0, byStatus: {} };
    }
  }

  private getMemoryUsage(): MemoryUsage {
    const memoryUsage = process.memoryUsage();

    return {
      heapUsed: memoryUsage.heapUsed,
      heapTotal: memoryUsage.heapTotal,
      external: memoryUsage.external,
      rss: memoryUsage.rss,
      heapUsedMB: (memoryUsage.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: (memoryUsage.heapTotal / 1024 / 1024).toFixed(2),
    };
  }
}
