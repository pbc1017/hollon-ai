import { Hollon, HollonStatus } from '../entities/hollon.entity';
import { CreateHollonDto } from '../dto/create-hollon.dto';
import { UpdateHollonDto } from '../dto/update-hollon.dto';
import { CreateTemporaryHollonDto } from '../dto/create-temporary-hollon.dto';

/**
 * Hollon Service Interface
 *
 * Hollon Management Context의 서비스 계약
 * DDD에서 Service 인터페이스 역할
 */
export interface IHollonService {
  /**
   * ID로 Hollon 조회
   */
  findById(id: string): Promise<Hollon>;

  /**
   * Hollon 상태 업데이트
   */
  updateStatus(id: string, status: HollonStatus): Promise<Hollon>;

  /**
   * Hollon에게 Task 할당
   */
  assignTask(hollonId: string, taskId: string): Promise<void>;

  /**
   * 특정 상태의 Hollon 목록 조회
   */
  findByStatus(status: HollonStatus): Promise<Hollon[]>;

  /**
   * IDLE 상태의 Hollon 조회
   */
  findIdleHollons(organizationId: string): Promise<Hollon[]>;

  /**
   * Hollon 생성
   */
  create(dto: CreateHollonDto): Promise<Hollon>;

  /**
   * Hollon 업데이트
   */
  update(id: string, dto: UpdateHollonDto): Promise<Hollon>;

  /**
   * 임시 Hollon 생성
   */
  createTemporaryHollon(dto: CreateTemporaryHollonDto): Promise<Hollon>;

  /**
   * 임시 Hollon 해제 (IDLE -> 삭제)
   */
  releaseTemporaryHollon(hollonId: string): Promise<void>;
}
