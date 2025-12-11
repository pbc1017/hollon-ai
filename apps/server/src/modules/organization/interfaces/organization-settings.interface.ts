/**
 * Phase 3.7: Organization Settings Interface
 *
 * Settings for autonomous execution control
 */
export interface OrganizationSettings {
  // Existing settings
  costLimitDailyCents?: number;
  costLimitMonthlyCents?: number;
  maxHollonsPerTeam?: number;
  defaultTaskPriority?: string;

  // Phase 3.7: Autonomous execution control
  maxConcurrentHollons?: number;
  autonomousExecutionEnabled?: boolean;
  emergencyStopReason?: string;
}
