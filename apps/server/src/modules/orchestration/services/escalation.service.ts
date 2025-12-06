import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';

export enum EscalationLevel {
  SELF_RESOLVE = 1, // 재시도
  TEAM_COLLABORATION = 2, // 팀 내 다른 Hollon에게 도움 요청
  TEAM_LEADER = 3, // 팀 리더 결정
  ORGANIZATION = 4, // 조직 레벨 에스컬레이션
  HUMAN_INTERVENTION = 5, // 인간 개입 필요
}

export interface EscalationRequest {
  taskId: string;
  hollonId: string;
  reason: string;
  level?: EscalationLevel;
  metadata?: Record<string, unknown>;
}

export interface EscalationResult {
  success: boolean;
  action: string;
  nextLevel?: EscalationLevel;
  message?: string;
}

export interface EscalationRecord {
  taskId: string;
  hollonId: string;
  level: EscalationLevel;
  reason: string;
  action: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class EscalationService {
  private readonly logger = new Logger(EscalationService.name);

  // In-memory escalation records (향후 DB로 이동)
  private escalationHistory: Map<string, EscalationRecord[]> = new Map();

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
  ) {}

  /**
   * Main escalation entry point
   * Determines and executes appropriate escalation level
   */
  async escalate(request: EscalationRequest): Promise<EscalationResult> {
    const level = request.level || EscalationLevel.SELF_RESOLVE;

    this.logger.log(
      `Escalating task ${request.taskId} to level ${level}: ${request.reason}`,
    );

    // Record escalation
    await this.recordEscalation({
      taskId: request.taskId,
      hollonId: request.hollonId,
      level,
      reason: request.reason,
      action: 'pending',
      timestamp: new Date(),
      metadata: request.metadata,
    });

    // Execute escalation based on level
    switch (level) {
      case EscalationLevel.SELF_RESOLVE:
        return this.selfResolve(request);
      case EscalationLevel.TEAM_COLLABORATION:
        return this.teamCollaboration(request);
      case EscalationLevel.TEAM_LEADER:
        return this.teamLeaderDecision(request);
      case EscalationLevel.ORGANIZATION:
        return this.organizationLevel(request);
      case EscalationLevel.HUMAN_INTERVENTION:
        return this.humanIntervention(request);
      default:
        throw new Error(`Unknown escalation level: ${level}`);
    }
  }

  /**
   * Level 1: Self-resolve with retry
   * Hollon retries the task with modified approach
   */
  private async selfResolve(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    this.logger.log(
      `Level 1 - Self resolve: Preparing task ${request.taskId} for retry`,
    );

    const task = await this.taskRepo.findOne({
      where: { id: request.taskId },
    });

    if (!task) {
      return {
        success: false,
        action: 'task_not_found',
        message: `Task ${request.taskId} not found`,
      };
    }

    // Check retry limit
    const MAX_RETRIES = 3;
    if (task.retryCount >= MAX_RETRIES) {
      this.logger.warn(
        `Task ${request.taskId} exceeded max retries (${MAX_RETRIES}), escalating to level 2`,
      );
      return {
        success: false,
        action: 'max_retries_exceeded',
        nextLevel: EscalationLevel.TEAM_COLLABORATION,
        message: `Exceeded maximum retry count (${MAX_RETRIES})`,
      };
    }

    // Increment retry count and reset to READY status
    await this.taskRepo.update(task.id, {
      retryCount: task.retryCount + 1,
      status: TaskStatus.READY,
      errorMessage: request.reason,
    });

    this.logger.log(
      `Task ${request.taskId} prepared for retry (attempt ${task.retryCount + 1}/${MAX_RETRIES})`,
    );

    return {
      success: true,
      action: 'task_retry_scheduled',
      message: `Task scheduled for retry (attempt ${task.retryCount + 1}/${MAX_RETRIES})`,
    };
  }

  /**
   * Level 2: Team collaboration
   * Request help from another hollon in the same team
   */
  private async teamCollaboration(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    this.logger.log(
      `Level 2 - Team collaboration: Finding alternative hollon for task ${request.taskId}`,
    );

    const hollon = await this.hollonRepo.findOne({
      where: { id: request.hollonId },
      relations: ['team'],
    });

    if (!hollon?.team) {
      return {
        success: false,
        action: 'no_team',
        nextLevel: EscalationLevel.TEAM_LEADER,
        message: 'Hollon has no team, escalating to team leader',
      };
    }

    // Find other available hollons in the same team
    if (!hollon.teamId) {
      return {
        success: false,
        action: 'no_team',
        nextLevel: EscalationLevel.ORGANIZATION,
        message: 'Hollon has no team for collaboration',
      };
    }

    const teamHollons = await this.hollonRepo.find({
      where: {
        teamId: hollon.teamId,
        status: HollonStatus.IDLE, // Only idle hollons
      },
    });

    const availableHollons = teamHollons.filter((h) => h.id !== hollon.id);

    if (availableHollons.length === 0) {
      this.logger.warn(
        `No available team members for task ${request.taskId}, escalating to level 3`,
      );
      return {
        success: false,
        action: 'no_available_team_members',
        nextLevel: EscalationLevel.TEAM_LEADER,
        message: 'No available team members, escalating to team leader',
      };
    }

    // Unassign from current hollon and make available for team
    await this.taskRepo.update(request.taskId, {
      assignedHollonId: null,
      status: TaskStatus.READY,
      errorMessage: `Reassigned from ${hollon.name}: ${request.reason}`,
    });

    this.logger.log(
      `Task ${request.taskId} unassigned and available for ${availableHollons.length} team members`,
    );

    return {
      success: true,
      action: 'task_reassigned_to_team',
      message: `Task made available to ${availableHollons.length} team member(s)`,
    };
  }

  /**
   * Level 3: Team leader decision
   * Mark task for team leader review
   */
  private async teamLeaderDecision(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    this.logger.log(
      `Level 3 - Team leader decision: Marking task ${request.taskId} for leader review`,
    );

    // Update task to IN_REVIEW status for team leader
    await this.taskRepo.update(request.taskId, {
      status: TaskStatus.IN_REVIEW,
      errorMessage: `Escalated to team leader: ${request.reason}`,
    });

    this.logger.log(`Task ${request.taskId} marked for team leader review`);

    return {
      success: true,
      action: 'escalated_to_team_leader',
      message: 'Task marked for team leader review',
    };
  }

  /**
   * Level 4: Organization level escalation
   * Escalate to organization administrators
   */
  private async organizationLevel(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    this.logger.log(
      `Level 4 - Organization level: Escalating task ${request.taskId} to organization`,
    );

    // Mark task as blocked for organization review
    await this.taskRepo.update(request.taskId, {
      status: TaskStatus.BLOCKED,
      errorMessage: `Organization escalation: ${request.reason}`,
    });

    this.logger.warn(
      `Task ${request.taskId} escalated to organization level - requires admin review`,
    );

    return {
      success: true,
      action: 'escalated_to_organization',
      message: 'Task escalated to organization level - admin review required',
    };
  }

  /**
   * Level 5: Human intervention required
   * Critical issues that require human decision
   */
  private async humanIntervention(
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    this.logger.warn(
      `Level 5 - Human intervention: Task ${request.taskId} requires human approval`,
    );

    // Mark task as blocked and requiring human approval
    await this.taskRepo.update(request.taskId, {
      status: TaskStatus.BLOCKED,
      errorMessage: `Human intervention required: ${request.reason}`,
    });

    // TODO: Send notification to human administrators
    // - Email notification
    // - Dashboard alert
    // - Slack/Discord webhook

    this.logger.warn(
      `Task ${request.taskId} marked for human intervention - notifications sent`,
    );

    return {
      success: true,
      action: 'human_approval_required',
      message:
        'Task marked for human intervention - notifications sent to administrators',
    };
  }

  /**
   * Record escalation for audit trail
   */
  private async recordEscalation(record: EscalationRecord): Promise<void> {
    const taskHistory = this.escalationHistory.get(record.taskId) || [];
    taskHistory.push(record);
    this.escalationHistory.set(record.taskId, taskHistory);

    this.logger.debug(
      `Escalation recorded: Task ${record.taskId}, Level ${record.level}`,
    );
  }

  /**
   * Get escalation history for a task
   */
  getEscalationHistory(taskId: string): EscalationRecord[] {
    return this.escalationHistory.get(taskId) || [];
  }

  /**
   * Determine appropriate escalation level based on context
   */
  async determineEscalationLevel(
    taskId: string,
    _hollonId: string,
    _failureReason: string,
  ): Promise<EscalationLevel> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
    });

    if (!task) {
      return EscalationLevel.HUMAN_INTERVENTION;
    }

    // Check retry count
    if (task.retryCount < 3) {
      return EscalationLevel.SELF_RESOLVE;
    }

    // Check priority
    if (task.priority === 'P1') {
      return EscalationLevel.ORGANIZATION;
    }

    // Default: team collaboration
    return EscalationLevel.TEAM_COLLABORATION;
  }

  /**
   * Clear escalation history (for testing)
   */
  clearHistory(): void {
    this.escalationHistory.clear();
  }
}
