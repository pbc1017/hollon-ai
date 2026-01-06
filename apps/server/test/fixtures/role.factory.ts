import { Repository, DeepPartial } from 'typeorm';
import { Role } from '../../src/modules/role/entities/role.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test Data Factory for Role entity
 * Provides methods to create test roles with unique names
 */
export class RoleFactory {
  /**
   * Create role data (not persisted)
   * @param overrides - Partial role data to override defaults
   */
  static create(overrides?: Partial<Role>): DeepPartial<Role> {
    const uniqueId = uuidv4().slice(0, 8);
    return {
      name: `Test_Role_${uniqueId}`,
      description: 'Auto-generated test role',
      capabilities: ['typescript', 'nestjs'],
      systemPrompt: 'You are a backend developer.',
      ...overrides,
    };
  }

  /**
   * Create and persist role to database
   * @param repo - TypeORM repository for Role
   * @param overrides - Partial role data to override defaults
   */
  static async createPersisted(
    repo: Repository<Role>,
    overrides?: Partial<Role>,
  ): Promise<Role> {
    const role = this.create(overrides);
    return repo.save(role);
  }

  /**
   * Create multiple roles
   * @param count - Number of roles to create
   * @param overrides - Partial role data to override defaults
   */
  static createMany(
    count: number,
    overrides?: Partial<Role>,
  ): DeepPartial<Role>[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create and persist multiple roles
   * @param repo - TypeORM repository for Role
   * @param count - Number of roles to create
   * @param overrides - Partial role data to override defaults
   */
  static async createManyPersisted(
    repo: Repository<Role>,
    count: number,
    overrides?: Partial<Role>,
  ): Promise<Role[]> {
    const roles = this.createMany(count, overrides);
    return repo.save(roles);
  }
}
