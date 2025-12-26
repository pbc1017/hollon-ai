import { IsString, IsOptional } from 'class-validator';

/**
 * DTO for Emergency Stop operation
 *
 * Phase 3.7: Kill switch for autonomous execution
 * Sets autonomousExecutionEnabled = false
 */
export class EmergencyStopDto {
  @IsString()
  @IsOptional()
  reason?: string;
}

/**
 * DTO for Resume Execution operation
 *
 * Phase 3.7: Resume autonomous execution after Emergency Stop
 * Sets autonomousExecutionEnabled = true
 */
export class ResumeExecutionDto {
  // No body needed - just POST to resume
}
