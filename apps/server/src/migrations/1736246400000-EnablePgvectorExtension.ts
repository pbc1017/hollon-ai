import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration: Enable pgvector Extension
 *
 * Enables the PostgreSQL pgvector extension for vector similarity search and
 * semantic operations. This migration is idempotent and includes proper error
 * handling to ensure safe execution in various database states.
 *
 * pgvector Extension Features:
 * - Vector data types: vector(n) for storing embeddings
 * - Distance operators for similarity search:
 *   - <=> (cosine distance)
 *   - <-> (L2 distance/Euclidean)
 *   - <#> (inner product)
 * - Indexing: HNSW and IVFFlat for efficient vector queries
 *
 * Documentation: https://github.com/pgvector/pgvector
 *
 * Prerequisites:
 * - PostgreSQL 11+ with pgvector extension installed on the server
 * - Sufficient database permissions to create extensions
 *
 * @see VectorEmbedding entity for usage examples
 * @see vector-search.service.ts for semantic search implementation
 */
export class EnablePgvectorExtension1736246400000 implements MigrationInterface {
  /**
   * Enables the pgvector extension in the database.
   *
   * Uses IF NOT EXISTS to ensure idempotency - the migration can be run
   * multiple times safely without errors.
   *
   * The extension is created in the current schema (determined by search_path).
   * By default, this will be the 'public' schema unless overridden in the
   * database configuration.
   *
   * @param queryRunner - TypeORM query runner for executing SQL
   * @throws Error if the pgvector extension is not installed on the PostgreSQL server
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    try {
      // Check if the extension is available on the server before attempting to create it
      const extensionAvailable = await queryRunner.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_available_extensions
          WHERE name = 'vector'
        ) as exists
      `);

      if (!extensionAvailable[0]?.exists) {
        throw new Error(
          'pgvector extension is not available on this PostgreSQL server. ' +
            'Please install pgvector before running this migration. ' +
            'Installation instructions: https://github.com/pgvector/pgvector#installation',
        );
      }

      // Enable the pgvector extension (idempotent operation)
      await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

      // Verify the extension was created successfully
      const extensionCreated = await queryRunner.query(`
        SELECT EXISTS (
          SELECT 1
          FROM pg_extension
          WHERE extname = 'vector'
        ) as exists
      `);

      if (!extensionCreated[0]?.exists) {
        throw new Error(
          'Failed to create pgvector extension. Check database permissions ' +
            'and ensure the extension is properly installed.',
        );
      }
    } catch (error) {
      // Re-throw with additional context for debugging
      if (error instanceof Error) {
        throw new Error(
          `Failed to enable pgvector extension: ${error.message}`,
        );
      }
      throw error;
    }
  }

  /**
   * Disables the pgvector extension in the database.
   *
   * WARNING: This will drop all vector columns and indexes that depend on
   * the pgvector extension. Only run this if you are certain no vector
   * data needs to be preserved.
   *
   * Uses IF EXISTS to ensure idempotency - the migration can be rolled back
   * multiple times safely without errors.
   *
   * Note: PostgreSQL will prevent dropping the extension if any database
   * objects (tables, columns, indexes) depend on it. You must drop all
   * dependent objects first.
   *
   * @param queryRunner - TypeORM query runner for executing SQL
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    try {
      // Attempt to drop the extension
      // CASCADE option would drop all dependent objects, but we use RESTRICT
      // to fail safely if there are dependencies
      await queryRunner.query(`DROP EXTENSION IF EXISTS vector RESTRICT`);
    } catch (error) {
      // If the drop fails due to dependencies, provide helpful error message
      if (error instanceof Error && error.message.includes('depends on')) {
        throw new Error(
          'Cannot drop pgvector extension because database objects depend on it. ' +
            'Drop all vector columns and indexes first, or use CASCADE ' +
            '(WARNING: this will drop all dependent objects).',
        );
      }

      // Re-throw with context
      if (error instanceof Error) {
        throw new Error(
          `Failed to disable pgvector extension: ${error.message}`,
        );
      }
      throw error;
    }
  }
}
