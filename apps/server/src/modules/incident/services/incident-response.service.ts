import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Incident,
  IncidentSeverity,
  IncidentStatus,
} from '../entities/incident.entity';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import { MessageService } from '../../message/message.service';
import {
  MessageType,
  ParticipantType,
} from '../../message/entities/message.entity';
import { CreateIncidentDto } from '../dto/incident.dto';

export interface IncidentResponse {
  incident: Incident;
  ownerHollon: Hollon | null;
  pausedTasks: number;
}

@Injectable()
export class IncidentResponseService {
  private readonly logger = new Logger(IncidentResponseService.name);

  constructor(
    @InjectRepository(Incident)
    private readonly incidentRepo: Repository<Incident>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly messageService: MessageService,
  ) {}

  /**
   * 인시던트 처리
   */
  async handleIncident(dto: CreateIncidentDto): Promise<IncidentResponse> {
    this.logger.log(`Handling incident: ${dto.title} (${dto.severity})`);

    // 심각도별 대응 전략 결정
    const strategy = this.getResponseStrategy(dto.severity);

    // 1. 인시던트 생성
    const incident = await this.incidentRepo.save({
      title: dto.title,
      description: dto.description,
      severity: dto.severity,
      organizationId: dto.organizationId,
      reporterHollonId: dto.reporterHollonId || null,
      status: IncidentStatus.REPORTED,
      timeline: [
        {
          timestamp: new Date().toISOString(),
          event: 'incident_reported',
          description: `Incident reported: ${dto.title}`,
        },
      ],
      metadata: {
        responseStrategy: strategy,
        escalationTimeMinutes: strategy.escalationTimeMinutes,
      },
    });

    // 2. 심각도별 자동 대응
    let pausedTasks = 0;

    // P1/P2: 비필수 태스크 일시 중지
    if (strategy.pauseTasks) {
      pausedTasks = await this.pauseNonEssentialTasks(dto.organizationId);
      await this.addTimelineEvent(
        incident.id,
        'tasks_paused',
        `Paused ${pausedTasks} non-essential tasks`,
      );
    }

    // P1/P2: 인간에게 즉시 알림
    if (strategy.notifyHumans) {
      await this.notifyHumans(incident);
      await this.addTimelineEvent(
        incident.id,
        'humans_notified',
        `Human stakeholders notified for ${dto.severity} incident`,
      );
    }

    // 3. Owner 할당 (P4는 자동 할당 안함)
    let owner: Hollon | null = null;
    if (strategy.autoAssign) {
      owner = await this.assignIncidentOwner(incident);

      if (owner) {
        incident.ownerHollonId = owner.id;
        await this.incidentRepo.save(incident);

        // Owner에게 알림
        await this.messageService.send({
          fromType: ParticipantType.SYSTEM,
          toId: owner.id,
          toType: ParticipantType.HOLLON,
          messageType: MessageType.GENERAL,
          content: this.formatIncidentNotification(incident),
          metadata: { incidentId: incident.id },
        });

        await this.addTimelineEvent(
          incident.id,
          'owner_assigned',
          `Owner assigned: ${owner.name}`,
        );
      } else {
        await this.addTimelineEvent(
          incident.id,
          'owner_assignment_failed',
          'No available hollon found for assignment',
        );
      }
    } else {
      await this.addTimelineEvent(
        incident.id,
        'owner_assignment_skipped',
        `Auto-assignment skipped for ${dto.severity} incident`,
      );
    }

    this.logger.log(
      `Incident ${incident.id} created and handled with ${dto.severity} strategy`,
    );

    return {
      incident,
      ownerHollon: owner,
      pausedTasks,
    };
  }

  /**
   * 비필수 태스크 일시 중지
   */
  private async pauseNonEssentialTasks(
    organizationId: string,
  ): Promise<number> {
    const result = await this.taskRepo
      .createQueryBuilder()
      .update(Task)
      .set({ status: TaskStatus.BLOCKED })
      .where('organization_id = :orgId', { orgId: organizationId })
      .andWhere('status = :status', { status: TaskStatus.IN_PROGRESS })
      .andWhere("priority != 'critical'")
      .execute();

    this.logger.log(
      `Paused ${result.affected} non-essential tasks for organization ${organizationId}`,
    );

    return result.affected || 0;
  }

  /**
   * 인간에게 알림
   */
  private async notifyHumans(incident: Incident): Promise<void> {
    // TODO: 인간 사용자에게 실제 알림 전송 (이메일, Slack 등)
    this.logger.warn(
      `HUMAN NOTIFICATION: Incident ${incident.id} (${incident.severity}) - ${incident.title}`,
    );
  }

  /**
   * 인시던트 Owner 할당
   */
  private async assignIncidentOwner(
    incident: Incident,
  ): Promise<Hollon | null> {
    // 가용한 홀론 중에서 선택
    const availableHollons = await this.hollonRepo.find({
      where: {
        organizationId: incident.organizationId,
        status: HollonStatus.IDLE,
      },
      take: 1,
    });

    return availableHollons[0] || null;
  }

  /**
   * 타임라인 이벤트 추가
   */
  async addTimelineEvent(
    incidentId: string,
    event: string,
    description: string,
  ): Promise<void> {
    const incident = await this.incidentRepo.findOne({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    incident.timeline.push({
      timestamp: new Date().toISOString(),
      event,
      description,
    });

    await this.incidentRepo.save(incident);
  }

  /**
   * 인시던트 해결
   */
  async resolveIncident(
    incidentId: string,
    resolutionSummary: string,
  ): Promise<Incident> {
    const incident = await this.incidentRepo.findOne({
      where: { id: incidentId },
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    incident.status = IncidentStatus.RESOLVED;
    incident.resolvedAt = new Date();
    incident.resolutionSummary = resolutionSummary;

    await this.addTimelineEvent(
      incidentId,
      'incident_resolved',
      resolutionSummary,
    );

    await this.incidentRepo.save(incident);

    this.logger.log(`Incident ${incidentId} resolved`);
    return incident;
  }

  /**
   * Postmortem 데이터 조회
   */
  async getIncidentWithTimeline(incidentId: string): Promise<Incident> {
    const incident = await this.incidentRepo.findOne({
      where: { id: incidentId },
      relations: ['reporterHollon', 'ownerHollon'],
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    return incident;
  }

  /**
   * 인시던트 알림 포맷
   */
  private formatIncidentNotification(incident: Incident): string {
    return `
INCIDENT ALERT

Severity: ${incident.severity}
Title: ${incident.title}
Description: ${incident.description}

You have been assigned as the owner of this incident.
Please investigate and respond as soon as possible.
    `.trim();
  }

  /**
   * 포스트모템 자동 생성
   * 인시던트 해결 후 자동으로 포스트모템 문서를 생성합니다.
   */
  async generatePostmortem(incidentId: string): Promise<Incident> {
    const incident = await this.incidentRepo.findOne({
      where: { id: incidentId },
      relations: ['reporterHollon', 'ownerHollon'],
    });

    if (!incident) {
      throw new NotFoundException(`Incident ${incidentId} not found`);
    }

    if (incident.status !== IncidentStatus.RESOLVED) {
      throw new Error(
        `Cannot generate postmortem for unresolved incident. Current status: ${incident.status}`,
      );
    }

    // 타임라인 분석
    const timelineNarrative = this.buildTimelineNarrative(incident.timeline);
    const duration = this.calculateIncidentDuration(incident);

    // 포스트모템 자동 생성
    incident.postmortem = {
      summary: this.generateSummary(incident),
      rootCause: this.extractRootCause(incident),
      impactAssessment: this.assessImpact(incident, duration),
      timelineNarrative,
      lessonsLearned: this.generateLessonsLearned(incident),
      actionItems: this.generateActionItems(incident),
      generatedAt: new Date().toISOString(),
    };

    await this.addTimelineEvent(
      incidentId,
      'postmortem_generated',
      'Postmortem document automatically generated',
    );

    await this.incidentRepo.save(incident);

    this.logger.log(`Postmortem generated for incident ${incidentId}`);

    // P1/P2 인시던트는 인간에게 포스트모템 알림
    if (
      incident.severity === IncidentSeverity.P1 ||
      incident.severity === IncidentSeverity.P2
    ) {
      await this.notifyHumansAboutPostmortem(incident);
    }

    return incident;
  }

  /**
   * 인시던트 해결 및 포스트모템 자동 생성
   */
  async resolveAndGeneratePostmortem(
    incidentId: string,
    resolutionSummary: string,
  ): Promise<Incident> {
    const resolvedIncident = await this.resolveIncident(
      incidentId,
      resolutionSummary,
    );
    return this.generatePostmortem(resolvedIncident.id);
  }

  /**
   * 타임라인 서술 생성
   */
  private buildTimelineNarrative(
    timeline: Array<{ timestamp: string; event: string; description: string }>,
  ): string {
    if (timeline.length === 0) {
      return 'No timeline events recorded.';
    }

    return timeline
      .map((entry, index) => {
        const date = new Date(entry.timestamp);
        const formattedTime = date.toISOString();
        return `${index + 1}. [${formattedTime}] ${entry.event}: ${entry.description}`;
      })
      .join('\n');
  }

  /**
   * 인시던트 지속 시간 계산
   */
  private calculateIncidentDuration(incident: Incident): number {
    if (!incident.resolvedAt) {
      return 0;
    }
    const startTime = new Date(incident.createdAt).getTime();
    const endTime = new Date(incident.resolvedAt).getTime();
    return Math.round((endTime - startTime) / (1000 * 60)); // 분 단위
  }

  /**
   * 요약 생성
   */
  private generateSummary(incident: Incident): string {
    const duration = this.calculateIncidentDuration(incident);
    return `${incident.severity} incident "${incident.title}" was reported and resolved in ${duration} minutes. ${incident.resolutionSummary || 'Resolution details not provided.'}`;
  }

  /**
   * 근본 원인 추출
   */
  private extractRootCause(incident: Incident): string {
    // 타임라인에서 'identified' 이벤트 찾기
    const identifiedEvent = incident.timeline.find(
      (e) => e.event === 'root_cause_identified' || e.event === 'identified',
    );

    if (identifiedEvent) {
      return identifiedEvent.description;
    }

    return incident.metadata?.rootCause || 'Root cause analysis pending.';
  }

  /**
   * 영향 평가
   */
  private assessImpact(incident: Incident, durationMinutes: number): string {
    const severityImpact: Record<IncidentSeverity, string> = {
      [IncidentSeverity.P1]:
        'Critical - Complete system outage affecting all users',
      [IncidentSeverity.P2]:
        'Major - Significant functionality impaired for many users',
      [IncidentSeverity.P3]:
        'Moderate - Partial functionality affected for some users',
      [IncidentSeverity.P4]:
        'Minor - Limited impact on non-critical functionality',
    };

    const impactDesc = severityImpact[incident.severity];
    const impactDetails = incident.impact
      ? JSON.stringify(incident.impact)
      : 'No additional impact details recorded.';

    return `${impactDesc}. Duration: ${durationMinutes} minutes. ${impactDetails}`;
  }

  /**
   * 학습 사항 생성
   */
  private generateLessonsLearned(incident: Incident): string[] {
    const lessons: string[] = [];

    // 심각도 기반 기본 교훈
    if (incident.severity === IncidentSeverity.P1) {
      lessons.push(
        'Consider implementing additional monitoring for early detection',
      );
      lessons.push('Review disaster recovery procedures');
    } else if (incident.severity === IncidentSeverity.P2) {
      lessons.push('Evaluate redundancy for affected components');
    }

    // 지속 시간 기반 교훈
    const duration = this.calculateIncidentDuration(incident);
    if (duration > 60) {
      lessons.push(
        'Response time exceeded target - review escalation procedures',
      );
    }

    // 기본 교훈
    lessons.push('Document runbooks for similar incidents');
    lessons.push('Consider automation opportunities for faster resolution');

    return lessons;
  }

  /**
   * 액션 아이템 생성
   */
  private generateActionItems(incident: Incident): Array<{
    description: string;
    assignee?: string;
    dueDate?: string;
    status: 'pending' | 'in_progress' | 'completed';
  }> {
    const actionItems: Array<{
      description: string;
      assignee?: string;
      dueDate?: string;
      status: 'pending' | 'in_progress' | 'completed';
    }> = [];

    // P1/P2는 더 많은 액션 아이템
    if (
      incident.severity === IncidentSeverity.P1 ||
      incident.severity === IncidentSeverity.P2
    ) {
      actionItems.push({
        description: 'Schedule postmortem review meeting with stakeholders',
        status: 'pending',
      });
      actionItems.push({
        description: 'Update monitoring and alerting configurations',
        status: 'pending',
      });
      actionItems.push({
        description: 'Review and update runbook documentation',
        status: 'pending',
      });
    }

    // 공통 액션 아이템
    actionItems.push({
      description: 'Verify resolution and monitor for recurrence',
      status: 'pending',
    });

    return actionItems;
  }

  /**
   * 포스트모템에 대해 인간에게 알림
   */
  private async notifyHumansAboutPostmortem(incident: Incident): Promise<void> {
    this.logger.warn(
      `HUMAN NOTIFICATION: Postmortem ready for ${incident.severity} incident ${incident.id} - ${incident.title}`,
    );
    // TODO: 실제 알림 구현 (이메일, Slack 등)
  }

  /**
   * 심각도별 대응 전략 반환
   */
  getResponseStrategy(severity: IncidentSeverity): {
    notifyHumans: boolean;
    pauseTasks: boolean;
    escalationTimeMinutes: number;
    autoAssign: boolean;
  } {
    switch (severity) {
      case IncidentSeverity.P1:
        return {
          notifyHumans: true,
          pauseTasks: true,
          escalationTimeMinutes: 5,
          autoAssign: true,
        };
      case IncidentSeverity.P2:
        return {
          notifyHumans: true,
          pauseTasks: true,
          escalationTimeMinutes: 15,
          autoAssign: true,
        };
      case IncidentSeverity.P3:
        return {
          notifyHumans: false,
          pauseTasks: false,
          escalationTimeMinutes: 60,
          autoAssign: true,
        };
      case IncidentSeverity.P4:
        return {
          notifyHumans: false,
          pauseTasks: false,
          escalationTimeMinutes: 240,
          autoAssign: false,
        };
    }
  }
}
