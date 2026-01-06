import { Controller, Get } from '@nestjs/common';
import { HealthService, HealthCheckResult } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  check(): HealthCheckResult {
    return this.healthService.check();
  }

  @Get('ready')
  readiness(): Promise<HealthCheckResult> {
    return this.healthService.readinessCheck();
  }

  @Get('live')
  liveness(): { status: string } {
    return { status: 'ok' };
  }
}
