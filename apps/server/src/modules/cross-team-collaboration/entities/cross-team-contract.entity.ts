import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Team } from '../../team/entities/team.entity';

/**
 * 팀 간 협업 계약 상태
 */
export enum ContractStatus {
  /** 요청 대기 중 */
  PENDING = 'pending',
  /** 협상 진행 중 */
  NEGOTIATING = 'negotiating',
  /** 수락됨 */
  ACCEPTED = 'accepted',
  /** 작업 진행 중 */
  IN_PROGRESS = 'in_progress',
  /** 산출물 전달 완료 */
  DELIVERED = 'delivered',
  /** 거절됨 */
  REJECTED = 'rejected',
  /** 취소됨 */
  CANCELLED = 'cancelled',
  /** 완료됨 (요청자가 이행 확인) */
  COMPLETED = 'completed',
}

/**
 * 계약 우선순위
 */
export enum ContractPriority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low',
}

/**
 * 팀 간 협업 계약 엔티티
 *
 * 다른 팀에 대한 의존성 요청 및 이행을 추적합니다.
 * - 요청 팀(requesterTeam)이 대상 팀(targetTeam)에게 산출물을 요청
 * - 협상, 수락, 작업, 전달, 완료의 생명주기를 관리
 */
@Entity('cross_team_contracts')
@Index(['requesterTeamId', 'status'])
@Index(['targetTeamId', 'status'])
@Index(['status', 'priority'])
@Index(['requestedDeadline'])
export class CrossTeamContract extends BaseEntity {
  // ─────────────────────────────────────────────────────────────────────────
  // 기본 정보
  // ─────────────────────────────────────────────────────────────────────────

  @Column({ length: 255 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: ContractPriority,
    default: ContractPriority.MEDIUM,
  })
  priority: ContractPriority;

  @Column({ type: 'jsonb', default: [] })
  deliverables: string[];

  // ─────────────────────────────────────────────────────────────────────────
  // 팀 관계
  // ─────────────────────────────────────────────────────────────────────────

  @Column({ name: 'requester_team_id' })
  requesterTeamId: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'requester_team_id' })
  requesterTeam: Team;

  @Column({ name: 'target_team_id' })
  targetTeamId: string;

  @ManyToOne(() => Team, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_team_id' })
  targetTeam: Team;

  // ─────────────────────────────────────────────────────────────────────────
  // 상태 및 진행
  // ─────────────────────────────────────────────────────────────────────────

  @Column({
    type: 'enum',
    enum: ContractStatus,
    default: ContractStatus.PENDING,
  })
  status: ContractStatus;

  @Column({ name: 'negotiation_notes', type: 'text', nullable: true })
  negotiationNotes: string | null;

  // ─────────────────────────────────────────────────────────────────────────
  // 마감일
  // ─────────────────────────────────────────────────────────────────────────

  @Column({ name: 'requested_deadline', type: 'timestamp', nullable: true })
  requestedDeadline: Date | null;

  @Column({ name: 'agreed_deadline', type: 'timestamp', nullable: true })
  agreedDeadline: Date | null;

  // ─────────────────────────────────────────────────────────────────────────
  // 타임스탬프
  // ─────────────────────────────────────────────────────────────────────────

  @Column({ name: 'accepted_at', type: 'timestamp', nullable: true })
  acceptedAt: Date | null;

  @Column({ name: 'rejected_at', type: 'timestamp', nullable: true })
  rejectedAt: Date | null;

  @Column({ name: 'delivered_at', type: 'timestamp', nullable: true })
  deliveredAt: Date | null;

  @Column({ name: 'completed_at', type: 'timestamp', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'cancelled_at', type: 'timestamp', nullable: true })
  cancelledAt: Date | null;

  // ─────────────────────────────────────────────────────────────────────────
  // 담당자 추적
  // ─────────────────────────────────────────────────────────────────────────

  /** 계약을 수락한 홀론 ID */
  @Column({ name: 'accepted_by_hollon_id', type: 'uuid', nullable: true })
  acceptedByHollonId: string | null;

  /** 계약을 거절한 홀론 ID */
  @Column({ name: 'rejected_by_hollon_id', type: 'uuid', nullable: true })
  rejectedByHollonId: string | null;

  /** 거절 사유 */
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  /** 취소 사유 */
  @Column({ name: 'cancellation_reason', type: 'text', nullable: true })
  cancellationReason: string | null;

  // ─────────────────────────────────────────────────────────────────────────
  // 메타데이터
  // ─────────────────────────────────────────────────────────────────────────

  /** 전달된 산출물 목록 (이행 시 기록) */
  @Column({ name: 'delivered_items', type: 'jsonb', default: [] })
  deliveredItems: string[];

  /** 완료 피드백 */
  @Column({ type: 'text', nullable: true })
  feedback: string | null;

  /** 추가 메타데이터 */
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;
}
