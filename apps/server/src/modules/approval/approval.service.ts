import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ApprovalRequest,
  ApprovalRequestType,
  ApprovalStatus,
} from './entities/approval-request.entity';

export interface CreateApprovalRequestDto {
  requestType: ApprovalRequestType;
  description: string;
  metadata: Record<string, any>;
  requestedBy?: string;
}

@Injectable()
export class ApprovalService {
  constructor(
    @InjectRepository(ApprovalRequest)
    private readonly approvalRepo: Repository<ApprovalRequest>,
  ) {}

  async create(dto: CreateApprovalRequestDto): Promise<ApprovalRequest> {
    return this.approvalRepo.save({
      requestType: dto.requestType,
      description: dto.description,
      metadata: dto.metadata,
      requestedBy: dto.requestedBy || null,
      status: ApprovalStatus.PENDING,
    });
  }

  async approve(id: string, approvedBy: string): Promise<ApprovalRequest> {
    const request = await this.approvalRepo.findOne({ where: { id } });
    if (!request) {
      throw new Error(`Approval request ${id} not found`);
    }

    request.status = ApprovalStatus.APPROVED;
    request.approvedBy = approvedBy;
    request.approvedAt = new Date();

    return this.approvalRepo.save(request);
  }

  async reject(
    id: string,
    rejectedBy: string,
    reason?: string,
  ): Promise<ApprovalRequest> {
    const request = await this.approvalRepo.findOne({ where: { id } });
    if (!request) {
      throw new Error(`Approval request ${id} not found`);
    }

    request.status = ApprovalStatus.REJECTED;
    request.rejectedBy = rejectedBy;
    request.rejectedAt = new Date();
    request.rejectionReason = reason || null;

    return this.approvalRepo.save(request);
  }

  async findPending(): Promise<ApprovalRequest[]> {
    return this.approvalRepo.find({
      where: { status: ApprovalStatus.PENDING },
      order: { createdAt: 'ASC' },
    });
  }
}
