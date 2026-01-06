import { UUID, BaseEntity } from './common';

/**
 * Task 상태
 */
export enum TaskStatus {
  PENDING = 'pending',
  READY = 'ready',
  IN_PROGRESS = 'in_progress',
  IN_REVIEW = 'in_review',
  BLOCKED = 'blocked',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

/**
 * Task 우선순위
 */
export enum TaskPriority {
  P1_CRITICAL = 'P1',
  P2_HIGH = 'P2',
  P3_MEDIUM = 'P3',
  P4_LOW = 'P4',
}

/**
 * Task 유형
 */
export enum TaskType {
  IMPLEMENTATION = 'implementation',
  REVIEW = 'review',
  RESEARCH = 'research',
  BUG_FIX = 'bug_fix',
  DOCUMENTATION = 'documentation',
  DISCUSSION = 'discussion',
}

/**
 * Task 엔티티
 */
export interface Task extends BaseEntity {
  title: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: TaskPriority;

  // 관계
  projectId: UUID;
  assignedHollonId?: UUID;
  parentTaskId?: UUID;
  creatorHollonId?: UUID;

  // 안전장치
  depth: number; // 서브태스크 깊이 (최대 3)
  affectedFiles: string[]; // 예상 수정 파일 목록

  // 메타데이터
  acceptanceCriteria?: string[];
  estimatedComplexity?: 'low' | 'medium' | 'high';
  tags?: string[];

  // 타임스탬프
  startedAt?: Date;
  completedAt?: Date;
  dueDate?: Date;
}

/**
 * Task 생성 DTO
 */
export interface CreateTaskDto {
  title: string;
  description: string;
  type: TaskType;
  priority?: TaskPriority;
  projectId: UUID;
  parentTaskId?: UUID;
  acceptanceCriteria?: string[];
  affectedFiles?: string[];
  tags?: string[];
  dueDate?: Date;
}

/**
 * Task 업데이트 DTO
 */
export interface UpdateTaskDto {
  title?: string;
  description?: string;
  type?: TaskType;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignedHollonId?: UUID;
  acceptanceCriteria?: string[];
  affectedFiles?: string[];
  tags?: string[];
  dueDate?: Date;
}

/**
 * Task 필터
 */
export interface TaskFilter {
  status?: TaskStatus | TaskStatus[];
  priority?: TaskPriority | TaskPriority[];
  type?: TaskType | TaskType[];
  projectId?: UUID;
  assignedHollonId?: UUID;
  parentTaskId?: UUID;
  tags?: string[];
}
