import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CollaborationSession,
  CollaborationStatus,
  CollaborationType,
} from '../entities/collaboration-session.entity';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';
import { MessageService } from '../../message/message.service';
import {
  MessageType,
  ParticipantType,
} from '../../message/entities/message.entity';
import { CollaborationRequestDto } from '../dto/collaboration-request.dto';

@Injectable()
export class CollaborationService {
  private readonly logger = new Logger(CollaborationService.name);

  constructor(
    @InjectRepository(CollaborationSession)
    private readonly sessionRepo: Repository<CollaborationSession>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    private readonly messageService: MessageService,
  ) {}

  /**
   * 협업 요청 생성
   */
  async requestCollaboration(
    requesterHollonId: string,
    request: CollaborationRequestDto,
  ): Promise<CollaborationSession> {
    this.logger.log(
      `Collaboration requested by ${requesterHollonId}: ${request.type}`,
    );

    // 1. 적합한 협력자 찾기
    const collaborator = await this.findSuitableCollaborator(
      request,
      requesterHollonId,
    );

    // 2. 세션 생성
    const session = await this.sessionRepo.save({
      type: request.type,
      requesterHollonId,
      collaboratorHollonId: collaborator?.id || null,
      taskId: request.taskId || null,
      description: request.description || null,
      metadata: request.metadata || {},
      status: CollaborationStatus.PENDING,
    });

    // 3. 협력자에게 요청 전송
    if (collaborator) {
      await this.messageService.send({
        fromId: requesterHollonId,
        fromType: ParticipantType.HOLLON,
        toId: collaborator.id,
        toType: ParticipantType.HOLLON,
        messageType: MessageType.COLLABORATION_REQUEST,
        content: this.formatCollaborationRequest(request, session),
        metadata: { sessionId: session.id },
        requiresResponse: true,
      });
    }

    return session;
  }

  /**
   * 협업 요청 수락
   */
  async acceptCollaboration(sessionId: string): Promise<CollaborationSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['requesterHollon', 'collaboratorHollon'],
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    session.status = CollaborationStatus.ACCEPTED;
    await this.sessionRepo.save(session);

    // 요청자에게 알림
    if (session.collaboratorHollonId) {
      await this.messageService.send({
        fromId: session.collaboratorHollonId,
        fromType: ParticipantType.HOLLON,
        toId: session.requesterHollonId,
        toType: ParticipantType.HOLLON,
        messageType: MessageType.RESPONSE,
        content: `Collaboration request accepted for session ${sessionId}`,
        metadata: { sessionId: session.id },
      });
    }

    this.logger.log(`Collaboration session ${sessionId} accepted`);
    return session;
  }

  /**
   * 협업 요청 거절
   */
  async rejectCollaboration(
    sessionId: string,
    reason?: string,
  ): Promise<CollaborationSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    session.status = CollaborationStatus.REJECTED;
    session.metadata = { ...session.metadata, rejectionReason: reason };
    await this.sessionRepo.save(session);

    // 요청자에게 알림
    if (session.collaboratorHollonId) {
      await this.messageService.send({
        fromId: session.collaboratorHollonId,
        fromType: ParticipantType.HOLLON,
        toId: session.requesterHollonId,
        toType: ParticipantType.HOLLON,
        messageType: MessageType.RESPONSE,
        content: `Collaboration request rejected: ${reason || 'No reason provided'}`,
        metadata: { sessionId: session.id },
      });
    }

    this.logger.log(`Collaboration session ${sessionId} rejected`);
    return session;
  }

  /**
   * 협업 세션 시작
   */
  async startSession(sessionId: string): Promise<CollaborationSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    session.status = CollaborationStatus.ACTIVE;
    session.startedAt = new Date();
    await this.sessionRepo.save(session);

    // 양쪽 홀론에게 세션 시작 알림
    await this.notifySessionStart(session);

    this.logger.log(`Collaboration session ${sessionId} started`);
    return session;
  }

  /**
   * 협업 세션 완료
   */
  async completeSession(
    sessionId: string,
    outcome?: string,
  ): Promise<CollaborationSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    session.status = CollaborationStatus.COMPLETED;
    session.completedAt = new Date();
    session.outcome = outcome || null;
    await this.sessionRepo.save(session);

    this.logger.log(`Collaboration session ${sessionId} completed`);
    return session;
  }

  /**
   * 협업 세션 취소
   */
  async cancelSession(sessionId: string): Promise<CollaborationSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    session.status = CollaborationStatus.CANCELLED;
    await this.sessionRepo.save(session);

    this.logger.log(`Collaboration session ${sessionId} cancelled`);
    return session;
  }

  /**
   * 협력자 찾기
   * 우선순위:
   * 1. 요청자 자신은 제외
   * 2. 같은 팀 내 홀론 우선 (+10점)
   * 3. 협업 유형에 따라 적합한 역할/스킬 기반 매칭 (+5~15점)
   */
  private async findSuitableCollaborator(
    request: CollaborationRequestDto,
    requesterHollonId: string,
  ): Promise<Hollon | null> {
    // 1. 가용한 홀론 조회 (IDLE 상태, role과 team 관계 포함)
    const availableHollons = await this.hollonRepo.find({
      where: { status: HollonStatus.IDLE },
      relations: ['role', 'team'],
      take: 50, // 충분한 후보군 확보
    });

    if (availableHollons.length === 0) {
      this.logger.warn('No available hollons for collaboration');
      return null;
    }

    // 2. 요청자 자신을 제외
    const candidates = availableHollons.filter(
      (h) => h.id !== requesterHollonId,
    );

    if (candidates.length === 0) {
      this.logger.warn(
        'No available collaborators (all candidates are requester)',
      );
      return null;
    }

    // 3. 협업 유형별 선호 capability 정의
    const preferredCapabilities = this.getPreferredCapabilities(request.type);

    // 4. 협업 유형에 따른 우선순위 정렬
    const prioritized = candidates.sort((a, b) => {
      let scoreA = 0;
      let scoreB = 0;

      // 같은 팀이면 +10점
      if (request.preferredTeamId) {
        if (a.teamId === request.preferredTeamId) scoreA += 10;
        if (b.teamId === request.preferredTeamId) scoreB += 10;
      }

      // 역할 기반 점수: capability 매칭
      scoreA += this.calculateCapabilityScore(
        a.role?.capabilities,
        preferredCapabilities,
      );
      scoreB += this.calculateCapabilityScore(
        b.role?.capabilities,
        preferredCapabilities,
      );

      return scoreB - scoreA;
    });

    this.logger.debug(
      `Found ${prioritized.length} candidates for collaboration, selected: ${prioritized[0].name}`,
    );

    return prioritized[0];
  }

  /**
   * 협업 유형별 선호하는 capabilities 반환
   */
  private getPreferredCapabilities(type: CollaborationType): string[] {
    switch (type) {
      case CollaborationType.CODE_REVIEW:
        return [
          'code-review',
          'testing',
          'quality-assurance',
          'typescript',
          'java',
        ];
      case CollaborationType.PAIR_PROGRAMMING:
        return ['typescript', 'nestjs', 'java', 'react', 'programming'];
      case CollaborationType.DEBUGGING:
        return ['debugging', 'testing', 'troubleshooting', 'monitoring'];
      case CollaborationType.KNOWLEDGE_SHARING:
        return ['documentation', 'mentoring', 'architecture', 'design'];
      case CollaborationType.ARCHITECTURE_REVIEW:
        return [
          'architecture',
          'system-design',
          'design-patterns',
          'infrastructure',
        ];
      default:
        return [];
    }
  }

  /**
   * capability 매칭 점수 계산
   * 매칭되는 capability가 많을수록 높은 점수
   */
  private calculateCapabilityScore(
    hollonCapabilities: string[] | undefined,
    preferredCapabilities: string[],
  ): number {
    if (!hollonCapabilities || hollonCapabilities.length === 0) {
      return 0;
    }

    const normalizedHollonCaps = hollonCapabilities.map((c) => c.toLowerCase());
    const normalizedPreferredCaps = preferredCapabilities.map((c) =>
      c.toLowerCase(),
    );

    let matchCount = 0;
    for (const cap of normalizedPreferredCaps) {
      if (
        normalizedHollonCaps.some((hc) => hc.includes(cap) || cap.includes(hc))
      ) {
        matchCount++;
      }
    }

    // 매칭 하나당 5점, 최대 15점
    return Math.min(matchCount * 5, 15);
  }

  /**
   * 협업 요청 메시지 포맷
   */
  private formatCollaborationRequest(
    request: CollaborationRequestDto,
    session: CollaborationSession,
  ): string {
    return `
Collaboration Request

Type: ${request.type}
Session ID: ${session.id}
${request.taskId ? `Task ID: ${request.taskId}` : ''}
${request.description ? `Description: ${request.description}` : ''}

Please accept or reject this collaboration request.
    `.trim();
  }

  /**
   * 세션 시작 알림
   */
  private async notifySessionStart(
    session: CollaborationSession,
  ): Promise<void> {
    const message = `Collaboration session ${session.id} has started (Type: ${session.type})`;

    // 요청자에게 알림
    await this.messageService.send({
      fromType: ParticipantType.SYSTEM,
      toId: session.requesterHollonId,
      toType: ParticipantType.HOLLON,
      messageType: MessageType.GENERAL,
      content: message,
      metadata: { sessionId: session.id },
    });

    // 협력자에게 알림
    if (session.collaboratorHollonId) {
      await this.messageService.send({
        fromType: ParticipantType.SYSTEM,
        toId: session.collaboratorHollonId,
        toType: ParticipantType.HOLLON,
        messageType: MessageType.GENERAL,
        content: message,
        metadata: { sessionId: session.id },
      });
    }
  }

  /**
   * 홀론의 활성 협업 세션 조회
   */
  async getActiveSessions(hollonId: string): Promise<CollaborationSession[]> {
    return this.sessionRepo.find({
      where: [
        { requesterHollonId: hollonId, status: CollaborationStatus.ACTIVE },
        { collaboratorHollonId: hollonId, status: CollaborationStatus.ACTIVE },
      ],
      relations: ['requesterHollon', 'collaboratorHollon', 'task'],
    });
  }

  /**
   * 세션 조회
   */
  async getSession(sessionId: string): Promise<CollaborationSession> {
    const session = await this.sessionRepo.findOne({
      where: { id: sessionId },
      relations: ['requesterHollon', 'collaboratorHollon', 'task'],
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} not found`);
    }

    return session;
  }
}
