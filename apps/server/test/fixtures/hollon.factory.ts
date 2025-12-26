import { Repository, DeepPartial } from 'typeorm';
import {
  Hollon,
  HollonStatus,
  HollonLifecycle,
  ExperienceLevel,
} from '../../src/modules/hollon/entities/hollon.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test Data Factory for Hollon entity
 * Provides methods to create test hollons with unique names
 */
export class HollonFactory {
  /**
   * Create hollon data (not persisted)
   * @param overrides - Partial hollon data to override defaults
   */
  static create(overrides?: Partial<Hollon>): DeepPartial<Hollon> {
    const uniqueId = uuidv4().slice(0, 8);
    return {
      name: `Test_Hollon_${uniqueId}`,
      status: HollonStatus.IDLE,
      lifecycle: HollonLifecycle.PERMANENT,
      experienceLevel: ExperienceLevel.MID,
      brainProviderId: 'claude_code',
      maxConcurrentTasks: 1,
      tasksCompleted: 0,
      depth: 0,
      ...overrides,
    };
  }

  /**
   * Create and persist hollon to database
   * @param repo - TypeORM repository for Hollon
   * @param overrides - Partial hollon data to override defaults
   */
  static async createPersisted(
    repo: Repository<Hollon>,
    overrides?: Partial<Hollon>,
  ): Promise<Hollon> {
    const hollon = this.create(overrides);
    return repo.save(hollon);
  }

  /**
   * Create multiple hollons
   * @param count - Number of hollons to create
   * @param overrides - Partial hollon data to override defaults
   */
  static createMany(
    count: number,
    overrides?: Partial<Hollon>,
  ): DeepPartial<Hollon>[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create and persist multiple hollons
   * @param repo - TypeORM repository for Hollon
   * @param count - Number of hollons to create
   * @param overrides - Partial hollon data to override defaults
   */
  static async createManyPersisted(
    repo: Repository<Hollon>,
    count: number,
    overrides?: Partial<Hollon>,
  ): Promise<Hollon[]> {
    const hollons = this.createMany(count, overrides);
    return repo.save(hollons);
  }
}
