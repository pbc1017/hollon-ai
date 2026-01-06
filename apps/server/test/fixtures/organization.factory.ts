import { Repository, DeepPartial } from 'typeorm';
import { Organization } from '../../src/modules/organization/entities/organization.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test Data Factory for Organization entity
 * Provides methods to create test organizations with unique names
 */
export class OrganizationFactory {
  /**
   * Create organization data (not persisted)
   * @param overrides - Partial organization data to override defaults
   */
  static create(overrides?: Partial<Organization>): DeepPartial<Organization> {
    const uniqueId = uuidv4().slice(0, 8);
    return {
      name: `Test_Org_${uniqueId}`,
      description: 'Auto-generated test organization',
      settings: {
        costLimitDailyCents: 10000,
        costLimitMonthlyCents: 100000,
        maxHollonsPerTeam: 10,
        defaultTaskPriority: 'medium',
      },
      ...overrides,
    };
  }

  /**
   * Create and persist organization to database
   * @param repo - TypeORM repository for Organization
   * @param overrides - Partial organization data to override defaults
   */
  static async createPersisted(
    repo: Repository<Organization>,
    overrides?: Partial<Organization>,
  ): Promise<Organization> {
    const org = this.create(overrides);
    return repo.save(org);
  }

  /**
   * Create multiple organizations
   * @param count - Number of organizations to create
   * @param overrides - Partial organization data to override defaults
   */
  static createMany(
    count: number,
    overrides?: Partial<Organization>,
  ): DeepPartial<Organization>[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create and persist multiple organizations
   * @param repo - TypeORM repository for Organization
   * @param count - Number of organizations to create
   * @param overrides - Partial organization data to override defaults
   */
  static async createManyPersisted(
    repo: Repository<Organization>,
    count: number,
    overrides?: Partial<Organization>,
  ): Promise<Organization[]> {
    const orgs = this.createMany(count, overrides);
    return repo.save(orgs);
  }
}
