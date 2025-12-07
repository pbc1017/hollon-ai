import { Injectable, Logger } from '@nestjs/common';
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
    });

    // 2. 자동 대응 (ssot.md 정책 기반)
    let pausedTasks = 0;
    if (
      dto.severity === IncidentSeverity.P1 ||
      dto.severity === IncidentSeverity.P2
    ) {
      // P1, P2: 비필수 태스크 일시 중지
      pausedTasks = await this.pauseNonEssentialTasks(dto.organizationId);

      // 인간에게 알림
      await this.notifyHumans(incident);
    }

    // 3. Owner 할당
    const owner = await this.assignIncidentOwner(incident);

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
    }

    // 4. 타임라인 업데이트
    await this.addTimelineEvent(
      incident.id,
      'owner_assigned',
      `Owner assigned: ${owner?.name || 'None'}`,
    );

    this.logger.log(`Incident ${incident.id} created and handled`);

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
      throw new Error(`Incident ${incidentId} not found`);
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
      throw new Error(`Incident ${incidentId} not found`);
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
      throw new Error(`Incident ${incidentId} not found`);
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
}
