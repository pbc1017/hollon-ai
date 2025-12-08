import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import {
  CrossTeamContract,
  ContractStatus,
} from '../entities/cross-team-contract.entity';
import { DependencyRequestDto } from '../dto/dependency-request.dto';
import { ContractNegotiationDto } from '../dto/contract-negotiation.dto';
import { MessageService } from '../../message/message.service';
import {
  MessageType,
  ParticipantType,
} from '../../message/entities/message.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';

/**
 * 팀 간 협업 및 의존성 관리를 위한 서비스
 *
 * 이 서비스는 다음 기능을 제공합니다:
 * - 팀 간 의존성 요청 생성 및 관리
 * - Contract 협상, 수락, 거절
 * - 이행 확인 및 완료 처리
 * - 관련 홀론들에게 알림 발송
 */
@Injectable()
export class CrossTeamCollaborationService {
  private readonly logger = new Logger(CrossTeamCollaborationService.name);

  constructor(
    @InjectRepository(CrossTeamContract)
    private readonly contractRepo: Repository<CrossTeamContract>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    private readonly messageService: MessageService,
  ) {}

  /**
   * 팀 간 의존성 요청
   */
  async requestDependency(
    requesterTeamId: string,
    targetTeamId: string,
    request: DependencyRequestDto,
  ): Promise<CrossTeamContract> {
    this.logger.log(
      `Team ${requesterTeamId} requesting dependency from team ${targetTeamId}`,
    );

    // 1. Contract 생성
    const contract = await this.contractRepo.save({
      requesterTeamId,
      targetTeamId,
      title: request.title,
      description: request.description,
      deliverables: request.deliverables,
      priority: request.priority,
      requestedDeadline: request.deadline ? new Date(request.deadline) : null,
      status: ContractStatus.PENDING,
    });

    // 2. 대상 팀의 홀론들에게 알림 발송
    await this.notifyTargetTeamHollons(
      targetTeamId,
      requesterTeamId,
      contract,
      request,
    );

    this.logger.log(`Contract created: ${contract.id}`);
    return contract;
  }

  /**
   * Contract 협상 및 수락
   */
  async negotiateContract(
    contractId: string,
    response: ContractNegotiationDto,
  ): Promise<CrossTeamContract> {
    const contract = await this.getContractById(contractId);

    // 유효한 상태 전이 확인
    const validTransitions: Record<ContractStatus, ContractStatus[]> = {
      [ContractStatus.PENDING]: [
        ContractStatus.NEGOTIATING,
        ContractStatus.ACCEPTED,
        ContractStatus.REJECTED,
      ],
      [ContractStatus.NEGOTIATING]: [
        ContractStatus.ACCEPTED,
        ContractStatus.REJECTED,
      ],
      [ContractStatus.ACCEPTED]: [],
      [ContractStatus.IN_PROGRESS]: [ContractStatus.DELIVERED],
      [ContractStatus.DELIVERED]: [ContractStatus.COMPLETED],
      [ContractStatus.COMPLETED]: [],
      [ContractStatus.REJECTED]: [],
      [ContractStatus.CANCELLED]: [],
    };

    if (!validTransitions[contract.status]?.includes(response.status)) {
      throw new BadRequestException(
        `Invalid status transition from ${contract.status} to ${response.status}`,
      );
    }

    contract.negotiationNotes = response.negotiationNotes || null;

    if (response.agreedDeadline) {
      contract.agreedDeadline = new Date(response.agreedDeadline);
    }

    // ACCEPTED 상태일 경우 바로 IN_PROGRESS로 전환
    if (response.status === ContractStatus.ACCEPTED) {
      contract.status = ContractStatus.IN_PROGRESS;
      contract.acceptedAt = new Date();
    } else {
      contract.status = response.status;
    }

    await this.contractRepo.save(contract);

    // 요청자 팀에 협상 결과 알림
    const statusMessages: Record<ContractStatus, string> = {
      [ContractStatus.NEGOTIATING]: `의존성 요청에 대한 협상이 진행 중입니다.${response.negotiationNotes ? `\n\n협상 내용: ${response.negotiationNotes}` : ''}`,
      [ContractStatus.IN_PROGRESS]: `의존성 요청이 수락되었습니다! 작업이 시작됩니다.${response.agreedDeadline ? `\n\n합의된 마감일: ${response.agreedDeadline}` : ''}`,
      [ContractStatus.REJECTED]: `의존성 요청이 거절되었습니다.${response.negotiationNotes ? `\n\n사유: ${response.negotiationNotes}` : ''}`,
      [ContractStatus.PENDING]: '',
      [ContractStatus.ACCEPTED]: '',
      [ContractStatus.DELIVERED]: '',
      [ContractStatus.COMPLETED]: '',
      [ContractStatus.CANCELLED]: '',
    };

    const notificationMessage = statusMessages[contract.status];
    if (notificationMessage) {
      await this.notifyRequesterTeam(contract, notificationMessage);
    }

    this.logger.log(`Contract ${contractId} updated: ${contract.status}`);
    return contract;
  }

  /**
   * Contract 이행 확인 (대상 팀이 산출물 전달 완료 시)
   */
  async confirmDelivery(
    contractId: string,
    deliverables: string[],
  ): Promise<CrossTeamContract> {
    const contract = await this.getContractById(contractId);

    if (contract.status !== ContractStatus.IN_PROGRESS) {
      throw new BadRequestException(
        `Cannot deliver contract with status: ${contract.status}. Contract must be IN_PROGRESS.`,
      );
    }

    contract.status = ContractStatus.DELIVERED;
    contract.deliveredAt = new Date();
    contract.deliveredItems = deliverables;

    await this.contractRepo.save(contract);

    // 요청자 팀에 이행 완료 알림
    await this.notifyRequesterTeam(
      contract,
      `의존성 요청에 대한 산출물이 전달되었습니다!\n\n전달된 산출물:\n${deliverables.map((d) => `- ${d}`).join('\n')}\n\n산출물을 확인하고 Contract를 완료해 주세요.`,
    );

    this.logger.log(`Contract ${contractId} delivered`);
    return contract;
  }

  /**
   * Contract 취소
   */
  async cancelContract(contractId: string, reason?: string): Promise<void> {
    const contract = await this.contractRepo.findOne({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    contract.status = ContractStatus.CANCELLED;
    contract.cancelledAt = new Date();
    contract.cancellationReason = reason || null;

    await this.contractRepo.save(contract);

    this.logger.log(`Contract ${contractId} cancelled`);
  }

  /**
   * 단일 Contract 조회
   */
  async getContractById(contractId: string): Promise<CrossTeamContract> {
    const contract = await this.contractRepo.findOne({
      where: { id: contractId },
      relations: ['requesterTeam', 'targetTeam'],
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    return contract;
  }

  /**
   * 팀의 활성 Contract 조회
   */
  async getActiveContracts(teamId: string): Promise<CrossTeamContract[]> {
    return this.contractRepo.find({
      where: [
        {
          requesterTeamId: teamId,
          status: ContractStatus.IN_PROGRESS,
        },
        {
          targetTeamId: teamId,
          status: ContractStatus.IN_PROGRESS,
        },
      ],
      relations: ['requesterTeam', 'targetTeam'],
      order: { createdAt: 'DESC' },
    });
  }

  /**
   * 팀의 대기 중인 Contract 조회 (응답 필요)
   */
  async getPendingContracts(teamId: string): Promise<CrossTeamContract[]> {
    return this.contractRepo.find({
      where: {
        targetTeamId: teamId,
        status: In([ContractStatus.PENDING, ContractStatus.NEGOTIATING]),
      },
      relations: ['requesterTeam', 'targetTeam'],
      order: { createdAt: 'ASC' },
    });
  }

  /**
   * 팀의 Contract 이력 조회
   */
  async getContractHistory(
    teamId: string,
    options?: {
      status?: ContractStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ contracts: CrossTeamContract[]; total: number }> {
    const queryBuilder = this.contractRepo
      .createQueryBuilder('contract')
      .leftJoinAndSelect('contract.requesterTeam', 'requesterTeam')
      .leftJoinAndSelect('contract.targetTeam', 'targetTeam')
      .where(
        '(contract.requester_team_id = :teamId OR contract.target_team_id = :teamId)',
        { teamId },
      );

    if (options?.status) {
      queryBuilder.andWhere('contract.status = :status', {
        status: options.status,
      });
    }

    const total = await queryBuilder.getCount();

    queryBuilder
      .orderBy('contract.created_at', 'DESC')
      .skip(options?.offset ?? 0)
      .take(options?.limit ?? 20);

    const contracts = await queryBuilder.getMany();

    return { contracts, total };
  }

  /**
   * Contract 거절
   */
  async rejectContract(
    contractId: string,
    reason?: string,
  ): Promise<CrossTeamContract> {
    const contract = await this.getContractById(contractId);

    if (contract.status !== ContractStatus.PENDING) {
      throw new BadRequestException(
        `Cannot reject contract with status: ${contract.status}`,
      );
    }

    contract.status = ContractStatus.REJECTED;
    contract.rejectedAt = new Date();
    contract.rejectionReason = reason || null;

    await this.contractRepo.save(contract);

    // 요청자 팀에 거절 알림 발송
    await this.notifyRequesterTeam(
      contract,
      `의존성 요청이 거절되었습니다.\n\n사유: ${reason || '사유 없음'}`,
    );

    this.logger.log(`Contract ${contractId} rejected`);
    return contract;
  }

  /**
   * Contract 완료 처리 (요청자가 이행 확인 후 완료)
   */
  async completeContract(
    contractId: string,
    feedback?: string,
  ): Promise<CrossTeamContract> {
    const contract = await this.getContractById(contractId);

    if (contract.status !== ContractStatus.DELIVERED) {
      throw new BadRequestException(
        `Cannot complete contract with status: ${contract.status}. Contract must be in DELIVERED status.`,
      );
    }

    contract.status = ContractStatus.COMPLETED;
    contract.completedAt = new Date();
    contract.feedback = feedback || null;

    await this.contractRepo.save(contract);

    // 대상 팀에 완료 알림 발송
    await this.notifyTargetTeamContractUpdate(
      contract,
      `Contract가 성공적으로 완료되었습니다!${feedback ? `\n\n피드백: ${feedback}` : ''}`,
    );

    this.logger.log(`Contract ${contractId} completed`);
    return contract;
  }

  /**
   * 대상 팀의 모든 홀론들에게 의존성 요청 알림 발송
   */
  private async notifyTargetTeamHollons(
    targetTeamId: string,
    requesterTeamId: string,
    contract: CrossTeamContract,
    request: DependencyRequestDto,
  ): Promise<void> {
    // 대상 팀의 홀론 목록 조회
    const targetHollons = await this.hollonRepo.find({
      where: { teamId: targetTeamId },
    });

    if (targetHollons.length === 0) {
      this.logger.warn(
        `No hollons found in target team ${targetTeamId} for dependency request notification`,
      );
      return;
    }

    // 각 홀론에게 알림 메시지 발송
    const notificationPromises = targetHollons.map((hollon) =>
      this.messageService
        .send({
          fromType: ParticipantType.SYSTEM,
          fromId: undefined,
          toType: ParticipantType.HOLLON,
          toId: hollon.id,
          messageType: MessageType.DELEGATION_REQUEST,
          content: `팀 간 의존성 요청이 도착했습니다.\n\n제목: ${request.title}\n요청 팀: ${requesterTeamId}\n설명: ${request.description}\n산출물: ${request.deliverables.join(', ')}${request.priority ? `\n우선순위: ${request.priority}` : ''}${request.deadline ? `\n요청 마감일: ${request.deadline}` : ''}`,
          metadata: {
            contractId: contract.id,
            requesterTeamId,
            targetTeamId,
            title: request.title,
            priority: request.priority,
            deliverables: request.deliverables,
            requestedDeadline: request.deadline,
          },
          requiresResponse: true,
        })
        .catch((error) => {
          this.logger.error(
            `Failed to send notification to hollon ${hollon.id}: ${error.message}`,
          );
        }),
    );

    await Promise.all(notificationPromises);

    this.logger.log(
      `Dependency request notifications sent to ${targetHollons.length} hollons in team ${targetTeamId} for contract ${contract.id}`,
    );
  }

  /**
   * 요청자 팀의 모든 홀론들에게 Contract 상태 변경 알림 발송
   */
  private async notifyRequesterTeam(
    contract: CrossTeamContract,
    message: string,
  ): Promise<void> {
    const requesterHollons = await this.hollonRepo.find({
      where: { teamId: contract.requesterTeamId },
    });

    if (requesterHollons.length === 0) {
      this.logger.warn(
        `No hollons found in requester team ${contract.requesterTeamId} for contract update notification`,
      );
      return;
    }

    const notificationPromises = requesterHollons.map((hollon) =>
      this.messageService
        .send({
          fromType: ParticipantType.SYSTEM,
          fromId: undefined,
          toType: ParticipantType.HOLLON,
          toId: hollon.id,
          messageType: MessageType.GENERAL,
          content: message,
          metadata: {
            contractId: contract.id,
            contractStatus: contract.status,
            requesterTeamId: contract.requesterTeamId,
            targetTeamId: contract.targetTeamId,
          },
          requiresResponse: false,
        })
        .catch((error) => {
          this.logger.error(
            `Failed to send notification to hollon ${hollon.id}: ${error.message}`,
          );
        }),
    );

    await Promise.all(notificationPromises);

    this.logger.log(
      `Contract update notifications sent to ${requesterHollons.length} hollons in requester team ${contract.requesterTeamId}`,
    );
  }

  /**
   * 대상 팀의 모든 홀론들에게 Contract 상태 변경 알림 발송
   */
  private async notifyTargetTeamContractUpdate(
    contract: CrossTeamContract,
    message: string,
  ): Promise<void> {
    const targetHollons = await this.hollonRepo.find({
      where: { teamId: contract.targetTeamId },
    });

    if (targetHollons.length === 0) {
      this.logger.warn(
        `No hollons found in target team ${contract.targetTeamId} for contract update notification`,
      );
      return;
    }

    const notificationPromises = targetHollons.map((hollon) =>
      this.messageService
        .send({
          fromType: ParticipantType.SYSTEM,
          fromId: undefined,
          toType: ParticipantType.HOLLON,
          toId: hollon.id,
          messageType: MessageType.GENERAL,
          content: message,
          metadata: {
            contractId: contract.id,
            contractStatus: contract.status,
            requesterTeamId: contract.requesterTeamId,
            targetTeamId: contract.targetTeamId,
          },
          requiresResponse: false,
        })
        .catch((error) => {
          this.logger.error(
            `Failed to send notification to hollon ${hollon.id}: ${error.message}`,
          );
        }),
    );

    await Promise.all(notificationPromises);

    this.logger.log(
      `Contract update notifications sent to ${targetHollons.length} hollons in target team ${contract.targetTeamId}`,
    );
  }
}
