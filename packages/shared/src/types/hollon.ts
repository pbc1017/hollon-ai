import { UUID, BaseEntity } from './common';

/**
 * Hollon 상태
 */
export enum HollonStatus {
  IDLE = 'idle',
  WORKING = 'working',
  BLOCKED = 'blocked',
  REVIEWING = 'reviewing',
  OFFLINE = 'offline',
}

/**
 * Hollon 역할
 */
export interface HollonRole {
  id: UUID;
  name: string;
  capabilities: string[];
  description?: string;
}

/**
 * Hollon 엔티티
 */
export interface Hollon extends BaseEntity {
  name: string;
  status: HollonStatus;
  organizationId: UUID;
  teamId?: UUID;
  roleId: UUID;

  // 설정
  brainProviderId?: string;
  systemPrompt?: string;
  maxConcurrentTasks: number;

  // 통계
  tasksCompleted: number;
  averageTaskDuration?: number;
  successRate?: number;

  // 메타데이터
  lastActiveAt?: Date;
  currentTaskId?: UUID;
}

/**
 * Hollon 생성 DTO
 */
export interface CreateHollonDto {
  name: string;
  organizationId: UUID;
  teamId?: UUID;
  roleId: UUID;
  brainProviderId?: string;
  systemPrompt?: string;
  maxConcurrentTasks?: number;
}

/**
 * Hollon 업데이트 DTO
 */
export interface UpdateHollonDto {
  name?: string;
  status?: HollonStatus;
  teamId?: UUID;
  roleId?: UUID;
  brainProviderId?: string;
  systemPrompt?: string;
  maxConcurrentTasks?: number;
}
