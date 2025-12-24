import { Hollon, HollonStatus } from '../../../hollon/entities/hollon.entity';

/**
 * HollonManagement Port Interface
 *
 * Orchestration Context가 Hollon 관리 기능에 접근하기 위한 Port
 * DDD Port/Adapter 패턴의 Port 역할
 */

export interface HollonCriteria {
  role?: string;
  skills?: string[];
  status?: HollonStatus;
  organizationId?: string;
  teamId?: string;
  minExperienceLevel?: string;
}

export interface IHollonManagementPort {
  /**
   * Hollon에게 Task 할당
   */
  assignTaskToHollon(hollonId: string, taskId: string): Promise<void>;

  /**
   * Hollon 상태 업데이트
   */
  updateHollonStatus(hollonId: string, status: HollonStatus): Promise<void>;

  /**
   * 조건에 맞는 사용 가능한 Hollon 찾기
   */
  findAvailableHollon(criteria: HollonCriteria): Promise<Hollon | null>;

  /**
   * Hollon 조회
   */
  findHollonById(hollonId: string): Promise<Hollon>;

  /**
   * 특정 상태의 Hollon 목록 조회
   */
  findHollonsByStatus(status: HollonStatus): Promise<Hollon[]>;
}
