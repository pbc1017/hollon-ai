import { Repository, DeepPartial } from 'typeorm';
import { Team } from '../../src/modules/team/entities/team.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test Data Factory for Team entity
 * Provides methods to create test teams with unique names
 */
export class TeamFactory {
  /**
   * Create team data (not persisted)
   * @param organizationId - Required organization ID
   * @param overrides - Partial team data to override defaults
   */
  static create(
    organizationId: string,
    overrides?: Partial<Team>,
  ): DeepPartial<Team> {
    const uniqueId = uuidv4().slice(0, 8);
    return {
      name: `Test_Team_${uniqueId}`,
      description: 'Auto-generated test team',
      organizationId,
      ...overrides,
    };
  }

  /**
   * Create and persist team to database
   * @param repo - TypeORM repository for Team
   * @param organizationId - Required organization ID
   * @param overrides - Partial team data to override defaults
   */
  static async createPersisted(
    repo: Repository<Team>,
    organizationId: string,
    overrides?: Partial<Team>,
  ): Promise<Team> {
    const team = this.create(organizationId, overrides);
    return repo.save(team);
  }

  /**
   * Create multiple teams
   * @param organizationId - Required organization ID
   * @param count - Number of teams to create
   * @param overrides - Partial team data to override defaults
   */
  static createMany(
    organizationId: string,
    count: number,
    overrides?: Partial<Team>,
  ): DeepPartial<Team>[] {
    return Array.from({ length: count }, () =>
      this.create(organizationId, overrides),
    );
  }

  /**
   * Create and persist multiple teams
   * @param repo - TypeORM repository for Team
   * @param organizationId - Required organization ID
   * @param count - Number of teams to create
   * @param overrides - Partial team data to override defaults
   */
  static async createManyPersisted(
    repo: Repository<Team>,
    organizationId: string,
    count: number,
    overrides?: Partial<Team>,
  ): Promise<Team[]> {
    const teams = this.createMany(organizationId, count, overrides);
    return repo.save(teams);
  }
}
