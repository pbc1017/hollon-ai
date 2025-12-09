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

/**
 * Phase 3.5: Dynamic escalation actions (beyond fixed 5 levels)
 */
export enum EscalationAction {
  RETRY = 'retry',
  REASSIGN = 'reassign',
  DECOMPOSE = 'decompose', // 태스크를 서브태스크로 분해
  SIMPLIFY = 'simplify', // 범위 축소 (일부 요구사항 제거)
  ESCALATE_TO_LEADER = 'escalate_to_leader',
  ESCALATE_TO_ORG = 'escalate_to_org',
  REQUEST_HUMAN = 'request_human',
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

  // ========================================
  // Phase 3.5: Dynamic Escalation Actions
  // ========================================

  /**
   * Phase 3.5: DECOMPOSE - 태스크를 서브태스크로 분해
   *
   * 사용 시점:
   * - Task가 너무 복잡해서 단일 Hollon이 처리하기 어려운 경우
   * - 여러 단계로 나눌 수 있는 경우
   * - 의존성이 복잡한 경우
   *
   * @param request Escalation request
   * @returns Escalation result with decomposed subtasks
   */
  async decomposeTask(request: EscalationRequest): Promise<EscalationResult> {
    this.logger.log(
      `DECOMPOSE action: Breaking down task ${request.taskId} into subtasks`,
    );

    const task = await this.taskRepo.findOne({
      where: { id: request.taskId },
    });

    if (!task) {
      return {
        success: false,
        action: EscalationAction.REQUEST_HUMAN,
        message: 'Task not found',
      };
    }

    // Task를 BLOCKED 상태로 변경 (서브태스크 생성 대기)
    await this.taskRepo.update(task.id, {
      status: TaskStatus.BLOCKED,
      errorMessage: `Decomposition requested: ${request.reason}`,
    });

    this.logger.log(
      `Task ${request.taskId} marked for decomposition. ` +
        `AI or Team Leader should create subtasks.`,
    );

    return {
      success: true,
      action: EscalationAction.DECOMPOSE,
      message:
        'Task marked for decomposition. Create subtasks to break down complexity.',
    };
  }

  /**
   * Phase 3.5: SIMPLIFY - 범위 축소 (일부 요구사항 제거)
   *
   * 사용 시점:
   * - Task 요구사항이 너무 많은 경우
   * - 일부 요구사항은 선택적인 경우
   * - 빠른 MVP 구현이 필요한 경우
   *
   * @param request Escalation request
   * @returns Escalation result with simplified scope
   */
  async simplifyTask(request: EscalationRequest): Promise<EscalationResult> {
    this.logger.log(
      `SIMPLIFY action: Reducing scope of task ${request.taskId}`,
    );

    const task = await this.taskRepo.findOne({
      where: { id: request.taskId },
    });

    if (!task) {
      return {
        success: false,
        action: EscalationAction.REQUEST_HUMAN,
        message: 'Task not found',
      };
    }

    // Task description에 SIMPLIFY 요청 추가
    const simplifyNote =
      '\n\n---\n**SIMPLIFY REQUEST**\n' +
      `Reason: ${request.reason}\n` +
      `Requested by: ${request.hollonId}\n` +
      `Suggested action: Remove optional requirements or reduce scope to core functionality.\n`;

    await this.taskRepo.update(task.id, {
      description: (task.description || '') + simplifyNote,
      status: TaskStatus.IN_REVIEW,
      errorMessage: `Simplification requested: ${request.reason}`,
    });

    this.logger.log(
      `Task ${request.taskId} marked for simplification. ` +
        `Team Leader or AI should review and reduce scope.`,
    );

    return {
      success: true,
      action: EscalationAction.SIMPLIFY,
      message:
        'Task marked for simplification. Review and reduce scope to core requirements.',
    };
  }

  /**
   * Phase 3.5: 상황에 맞는 최적의 액션 결정
   *
   * 결정 로직:
   * 1. 재시도 횟수 < 3 → RETRY
   * 2. Task complexity가 높고 subtask 가능 → DECOMPOSE
   * 3. Task 요구사항이 많음 → SIMPLIFY
   * 4. 팀원 있음 → REASSIGN
   * 5. 우선순위 높음 → ESCALATE_TO_ORG
   * 6. 기타 → ESCALATE_TO_LEADER
   */
  async determineOptimalAction(
    taskId: string,
    hollonId: string,
    _failureReason: string,
  ): Promise<EscalationAction> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['subtasks'],
    });

    if (!task) {
      return EscalationAction.REQUEST_HUMAN;
    }

    // 1. 재시도 가능한가?
    if (task.retryCount < 3) {
      this.logger.debug(`Task ${taskId}: RETRY (attempt ${task.retryCount}/3)`);
      return EscalationAction.RETRY;
    }

    // 2. 복잡도가 높고 아직 분해되지 않았는가?
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const isComplex = this.isTaskComplex(task);

    if (isComplex && !hasSubtasks) {
      this.logger.debug(
        `Task ${taskId}: DECOMPOSE (complex task without subtasks)`,
      );
      return EscalationAction.DECOMPOSE;
    }

    // 3. 요구사항이 많고 간소화 가능한가?
    const hasManyrequirements = this.hasMultipleRequirements(task);
    const alreadySimplified = task.description?.includes('SIMPLIFY REQUEST');

    if (hasManyrequirements && !alreadySimplified) {
      this.logger.debug(
        `Task ${taskId}: SIMPLIFY (many requirements, not yet simplified)`,
      );
      return EscalationAction.SIMPLIFY;
    }

    // 4. 팀 내 재할당 가능한가?
    const hollon = await this.hollonRepo.findOne({
      where: { id: hollonId },
    });

    if (hollon?.teamId) {
      const teamHollons = await this.hollonRepo.find({
        where: {
          teamId: hollon.teamId,
          status: HollonStatus.IDLE,
        },
      });

      if (teamHollons.length > 1) {
        this.logger.debug(`Task ${taskId}: REASSIGN (team members available)`);
        return EscalationAction.REASSIGN;
      }
    }

    // 5. 우선순위가 높은가?
    if (task.priority === 'P1' || task.priority === 'P2') {
      this.logger.debug(
        `Task ${taskId}: ESCALATE_TO_ORG (high priority: ${task.priority})`,
      );
      return EscalationAction.ESCALATE_TO_ORG;
    }

    // 6. 기본: 팀 리더 에스컬레이션
    this.logger.debug(`Task ${taskId}: ESCALATE_TO_LEADER (default)`);
    return EscalationAction.ESCALATE_TO_LEADER;
  }

  /**
   * Task가 복잡한지 판단
   */
  private isTaskComplex(task: Task): boolean {
    // 복잡도 판단 기준:
    // 1. Description이 길다 (>500자)
    // 2. Required skills가 많다 (>3개)
    // 3. 여러 파일 영향 (>5개)

    const descriptionLength = task.description?.length || 0;
    const skillsCount = task.requiredSkills?.length || 0;
    const filesCount = task.affectedFiles?.length || 0;

    return descriptionLength > 500 || skillsCount > 3 || filesCount > 5;
  }

  /**
   * Task에 요구사항이 많은지 판단
   */
  private hasMultipleRequirements(task: Task): boolean {
    if (!task.description) return false;

    // 요구사항 패턴 찾기
    const requirementPatterns = [
      /requirements?:/gi,
      /must have:/gi,
      /should have:/gi,
      /features?:/gi,
      /[-*]\s+/g, // 리스트 항목
    ];

    let totalMatches = 0;
    for (const pattern of requirementPatterns) {
      const matches = task.description.match(pattern);
      if (matches) {
        totalMatches += matches.length;
      }
    }

    // 5개 이상의 요구사항 패턴이 있으면 많다고 판단
    return totalMatches >= 5;
  }

  /**
   * Phase 3.5: 액션 실행
   */
  async executeAction(
    action: EscalationAction,
    request: EscalationRequest,
  ): Promise<EscalationResult> {
    this.logger.log(
      `Executing action ${action} for task ${request.taskId}: ${request.reason}`,
    );

    switch (action) {
      case EscalationAction.RETRY:
        return this.selfResolve(request);
      case EscalationAction.REASSIGN:
        return this.teamCollaboration(request);
      case EscalationAction.DECOMPOSE:
        return this.decomposeTask(request);
      case EscalationAction.SIMPLIFY:
        return this.simplifyTask(request);
      case EscalationAction.ESCALATE_TO_LEADER:
        return this.teamLeaderDecision(request);
      case EscalationAction.ESCALATE_TO_ORG:
        return this.organizationLevel(request);
      case EscalationAction.REQUEST_HUMAN:
        return this.humanIntervention(request);
      default:
        throw new Error(`Unknown escalation action: ${action}`);
    }
  }
}
