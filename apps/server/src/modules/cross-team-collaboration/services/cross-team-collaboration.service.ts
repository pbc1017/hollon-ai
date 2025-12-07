import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CrossTeamContract,
  ContractStatus,
} from '../entities/cross-team-contract.entity';
import { DependencyRequestDto } from '../dto/dependency-request.dto';
import { ContractNegotiationDto } from '../dto/contract-negotiation.dto';

@Injectable()
export class CrossTeamCollaborationService {
  private readonly logger = new Logger(CrossTeamCollaborationService.name);

  constructor(
    @InjectRepository(CrossTeamContract)
    private readonly contractRepo: Repository<CrossTeamContract>,
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

    // 2. 대상 팀에게 알림 (팀 채널로 전송하거나 팀의 첫 번째 홀론에게 전송)
    // TODO: 팀 리더 개념 추가 시 수정 필요
    // 현재는 시스템 알림으로만 처리
    this.logger.log(
      `Dependency request sent to team ${targetTeamId}: ${contract.id}`,
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
}
