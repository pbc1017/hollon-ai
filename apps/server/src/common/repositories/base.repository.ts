import {
  Repository,
  DeepPartial,
  FindOptionsWhere,
  ObjectLiteral,
  QueryRunner,
  DataSource,
  InsertResult,
  UpdateResult,
} from 'typeorm';
import { Logger } from '@nestjs/common';

/**
 * Base repository with batch operations and transaction management
 * Provides efficient bulk insert and update operations with automatic chunking
 */
export class BaseRepository<
  Entity extends ObjectLiteral,
> extends Repository<Entity> {
  protected readonly logger: Logger;
  private readonly DEFAULT_CHUNK_SIZE = 500;

  constructor(
    target: new () => Entity,
    dataSource: DataSource,
    queryRunner?: QueryRunner,
  ) {
    super(target, dataSource.createEntityManager(queryRunner));
    this.logger = new Logger(this.constructor.name);
  }

  /**
   * Batch insert entities with automatic chunking for large datasets
   * Uses a transaction to ensure atomicity
   *
   * @param entities - Array of entities to insert
   * @param chunkSize - Number of entities per batch (default: 500)
   * @returns Array of inserted entities with generated IDs
   *
   * @example
   * ```typescript
   * const tasks = await taskRepo.batchInsert([
   *   { title: 'Task 1', status: TaskStatus.TODO },
   *   { title: 'Task 2', status: TaskStatus.TODO },
   * ]);
   * ```
   */
  async batchInsert(
    entities: DeepPartial<Entity>[],
    chunkSize: number = this.DEFAULT_CHUNK_SIZE,
  ): Promise<Entity[]> {
    if (entities.length === 0) {
      return [];
    }

    const queryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const allInsertedIds: string[] = [];

      // Process in chunks to avoid exceeding database limits
      for (let i = 0; i < entities.length; i += chunkSize) {
        const chunk = entities.slice(i, i + chunkSize);
        const result: InsertResult = await queryRunner.manager.insert(
          this.target,
          chunk,
        );

        const chunkIds = result.identifiers.map(
          (identifier) => identifier.id as string,
        );
        allInsertedIds.push(...chunkIds);
      }

      await queryRunner.commitTransaction();

      // Fetch all inserted entities
      const inserted = await this.findByIds(allInsertedIds);

      this.logger.log(
        `Batch inserted ${entities.length} ${this.metadata.name} entities`,
      );

      return inserted;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to batch insert ${this.metadata.name} entities`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Batch insert without fetching the inserted entities
   * More efficient when you don't need the returned entities
   *
   * @param entities - Array of entities to insert
   * @param chunkSize - Number of entities per batch (default: 500)
   * @returns InsertResult with generated IDs
   */
  async batchInsertRaw(
    entities: DeepPartial<Entity>[],
    chunkSize: number = this.DEFAULT_CHUNK_SIZE,
  ): Promise<InsertResult> {
    if (entities.length === 0) {
      return { identifiers: [], generatedMaps: [], raw: [] };
    }

    const queryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const allIdentifiers: Record<string, unknown>[] = [];
      const allGeneratedMaps: Record<string, unknown>[] = [];

      for (let i = 0; i < entities.length; i += chunkSize) {
        const chunk = entities.slice(i, i + chunkSize);
        const result = await queryRunner.manager.insert(this.target, chunk);

        allIdentifiers.push(...result.identifiers);
        allGeneratedMaps.push(...result.generatedMaps);
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Batch inserted ${entities.length} ${this.metadata.name} entities (raw)`,
      );

      return {
        identifiers: allIdentifiers,
        generatedMaps: allGeneratedMaps,
        raw: allIdentifiers,
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to batch insert ${this.metadata.name} entities (raw)`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Batch update entities with automatic chunking
   * Uses a transaction to ensure atomicity
   *
   * @param criteria - Where conditions for finding entities to update
   * @param partialEntity - Partial entity with fields to update
   * @param chunkSize - Number of entities per batch (default: 500)
   * @returns UpdateResult
   *
   * @example
   * ```typescript
   * await taskRepo.batchUpdate(
   *   { status: TaskStatus.TODO },
   *   { status: TaskStatus.IN_PROGRESS }
   * );
   * ```
   */
  async batchUpdate(
    criteria: FindOptionsWhere<Entity>,
    partialEntity: DeepPartial<Entity>,
    chunkSize: number = this.DEFAULT_CHUNK_SIZE,
  ): Promise<UpdateResult> {
    const queryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Find all matching entities
      const entities = await this.find({ where: criteria });

      if (entities.length === 0) {
        await queryRunner.commitTransaction();
        return { affected: 0, raw: [], generatedMaps: [] };
      }

      let totalAffected = 0;

      // Update in chunks
      for (let i = 0; i < entities.length; i += chunkSize) {
        const chunk = entities.slice(i, i + chunkSize);
        const ids = chunk.map((entity: Entity & { id: string | number }) => entity.id);

        const result = await queryRunner.manager.update(
          this.target,
          ids,
          partialEntity,
        );

        totalAffected += result.affected || 0;
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Batch updated ${totalAffected} ${this.metadata.name} entities`,
      );

      return { affected: totalAffected, raw: [], generatedMaps: [] };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to batch update ${this.metadata.name} entities`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Batch save entities (insert or update based on existence)
   * Uses TypeORM's save method which handles both insert and update
   * Automatically chunks large datasets
   *
   * @param entities - Array of entities to save
   * @param chunkSize - Number of entities per batch (default: 500)
   * @returns Array of saved entities
   *
   * @example
   * ```typescript
   * const tasks = await taskRepo.batchSave([task1, task2, task3]);
   * ```
   */
  async batchSave(
    entities: DeepPartial<Entity>[],
    chunkSize: number = this.DEFAULT_CHUNK_SIZE,
  ): Promise<Entity[]> {
    if (entities.length === 0) {
      return [];
    }

    const queryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const savedEntities: Entity[] = [];

      for (let i = 0; i < entities.length; i += chunkSize) {
        const chunk = entities.slice(i, i + chunkSize);
        const saved = await queryRunner.manager.save(this.target, chunk);
        savedEntities.push(...(saved as Entity[]));
      }

      await queryRunner.commitTransaction();

      this.logger.log(
        `Batch saved ${entities.length} ${this.metadata.name} entities`,
      );

      return savedEntities;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Failed to batch save ${this.metadata.name} entities`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Execute a batch operation within a custom transaction
   * Provides full control over transaction management
   *
   * @param operation - Async function that performs batch operations
   * @returns Result of the operation
   *
   * @example
   * ```typescript
   * const result = await taskRepo.withTransaction(async (repo) => {
   *   const tasks = await repo.batchInsert(newTasks);
   *   const updated = await repo.batchUpdate(criteria, updates);
   *   return { tasks, updated };
   * });
   * ```
   */
  async withTransaction<T>(
    operation: (
      repository: BaseRepository<Entity>,
      queryRunner: QueryRunner,
    ) => Promise<T>,
  ): Promise<T> {
    const queryRunner = this.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Create a repository instance that uses this transaction
      const transactionalRepo = new BaseRepository(
        this.target as new () => Entity,
        this.manager.connection,
        queryRunner,
      );

      const result = await operation(transactionalRepo, queryRunner);
      await queryRunner.commitTransaction();

      return result;
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Transaction failed for ${this.metadata.name}`,
        error,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }
}
