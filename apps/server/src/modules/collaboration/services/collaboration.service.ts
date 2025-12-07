import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CollaborationSession,
  CollaborationStatus,
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
    const collaborator = await this.findSuitableCollaborator(request);

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
   */
  private async findSuitableCollaborator(
    _request: CollaborationRequestDto,
  ): Promise<Hollon | null> {
    // 가용한 홀론 중에서 선택 (간단한 버전)
    const availableHollons = await this.hollonRepo.find({
      where: { status: HollonStatus.IDLE },
      take: 10,
    });

    if (availableHollons.length === 0) {
      this.logger.warn('No available hollons for collaboration');
      return null;
    }

    // 단순하게 첫 번째 가용 홀론 선택
    // TODO: 역할, 스킬, 가용성 기반으로 매칭 개선
    return availableHollons[0];
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
