import { Repository, DeepPartial } from 'typeorm';
import {
  Project,
  ProjectStatus,
} from '../../src/modules/project/entities/project.entity';
import { v4 as uuidv4 } from 'uuid';

/**
 * Test Data Factory for Project entity
 * Provides methods to create test projects with unique names
 */
export class ProjectFactory {
  /**
   * Create project data (not persisted)
   * @param overrides - Partial project data to override defaults
   */
  static create(overrides?: Partial<Project>): DeepPartial<Project> {
    const uniqueId = uuidv4().slice(0, 8);
    return {
      name: `Test_Project_${uniqueId}`,
      description: 'Auto-generated test project',
      status: ProjectStatus.ACTIVE,
      repositoryUrl: 'https://github.com/test/repo',
      workingDirectory: `/tmp/test-project-${uniqueId}`,
      metadata: {},
      ...overrides,
    };
  }

  /**
   * Create and persist project to database
   * @param repo - TypeORM repository for Project
   * @param overrides - Partial project data to override defaults
   */
  static async createPersisted(
    repo: Repository<Project>,
    overrides?: Partial<Project>,
  ): Promise<Project> {
    const project = this.create(overrides);
    return repo.save(project);
  }

  /**
   * Create multiple projects
   * @param count - Number of projects to create
   * @param overrides - Partial project data to override defaults
   */
  static createMany(
    count: number,
    overrides?: Partial<Project>,
  ): DeepPartial<Project>[] {
    return Array.from({ length: count }, () => this.create(overrides));
  }

  /**
   * Create and persist multiple projects
   * @param repo - TypeORM repository for Project
   * @param count - Number of projects to create
   * @param overrides - Partial project data to override defaults
   */
  static async createManyPersisted(
    repo: Repository<Project>,
    count: number,
    overrides?: Partial<Project>,
  ): Promise<Project[]> {
    const projects = this.createMany(count, overrides);
    return repo.save(projects);
  }
}
