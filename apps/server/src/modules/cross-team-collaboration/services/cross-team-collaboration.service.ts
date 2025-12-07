import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
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
      description: request.description,
      deliverables: request.deliverables,
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
    const contract = await this.contractRepo.findOne({
      where: { id: contractId },
      relations: ['requesterTeam', 'targetTeam'],
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    contract.status = response.status;
    contract.negotiationNotes = response.negotiationNotes || null;

    if (response.agreedDeadline) {
      contract.agreedDeadline = new Date(response.agreedDeadline);
    }

    if (response.status === ContractStatus.ACCEPTED) {
      contract.status = ContractStatus.IN_PROGRESS;
    }

    await this.contractRepo.save(contract);

    this.logger.log(`Contract ${contractId} updated: ${response.status}`);
    return contract;
  }

  /**
   * Contract 이행 확인
   */
  async confirmDelivery(
    contractId: string,
    deliverables: string[],
  ): Promise<void> {
    const contract = await this.contractRepo.findOne({
      where: { id: contractId },
    });

    if (!contract) {
      throw new NotFoundException(`Contract ${contractId} not found`);
    }

    contract.status = ContractStatus.DELIVERED;
    contract.deliveredAt = new Date();
    contract.metadata = {
      ...contract.metadata,
      deliveredItems: deliverables,
    };

    await this.contractRepo.save(contract);

    this.logger.log(`Contract ${contractId} delivered`);
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
    contract.metadata = {
      ...contract.metadata,
      cancellationReason: reason || 'No reason provided',
    };

    await this.contractRepo.save(contract);

    this.logger.log(`Contract ${contractId} cancelled`);
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
          content: `팀 간 의존성 요청이 도착했습니다.\n\n요청 팀: ${requesterTeamId}\n설명: ${request.description}\n산출물: ${request.deliverables.join(', ')}${request.deadline ? `\n요청 마감일: ${request.deadline}` : ''}`,
          metadata: {
            contractId: contract.id,
            requesterTeamId,
            targetTeamId,
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
}
