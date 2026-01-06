import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable pgvector extension for vector similarity search
 *
 * This migration enables the pgvector extension in PostgreSQL,
 * which provides vector data types and similarity search capabilities
 * for AI/ML applications.
 *
 * ## Purpose
 * The pgvector extension is required for:
 * - Knowledge graph embeddings storage and retrieval
 * - Semantic search across documents and task descriptions
 * - AI-powered recommendation systems for task assignment
 * - Similarity-based hollon skill matching
 *
 * ## Prerequisites
 * - PostgreSQL 11+ (recommended: PostgreSQL 16)
 * - pgvector extension installed in PostgreSQL
 *   - When using Docker: pgvector/pgvector:pg16 image (already configured)
 *   - Manual installation: https://github.com/pgvector/pgvector#installation
 *
 * ## Usage
 * After this migration, you can:
 * 1. Create columns with vector data type: `embedding vector(1536)`
 * 2. Use vector similarity operators: <->, <#>, <=>
 * 3. Create vector indexes: USING ivfflat or USING hnsw
 *
 * ## Example
 * ```sql
 * -- Create a table with vector column
 * CREATE TABLE knowledge_items (
 *   id UUID PRIMARY KEY,
 *   content TEXT,
 *   embedding vector(1536)  -- 1536 dimensions for OpenAI embeddings
 * );
 *
 * -- Query for similar items (L2 distance)
 * SELECT * FROM knowledge_items
 * ORDER BY embedding <-> '[0.1, 0.2, ...]'::vector
 * LIMIT 10;
 * ```
 *
 * ## Notes
 * - The extension is created in the public schema by default
 * - IF NOT EXISTS prevents errors on repeated runs
 * - This migration is idempotent and safe to run multiple times
 *
 * @see https://github.com/pgvector/pgvector
 * @see apps/server/src/modules/knowledge-extraction/entities/knowledge-item.entity.ts
 */
export class EnablePgvector1766556720000 implements MigrationInterface {
  /**
   * Run migration - Enable pgvector extension
   *
   * This will enable the vector extension in PostgreSQL, allowing the use of
   * vector data types and similarity search operations throughout the database.
   */
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
  }

  /**
   * Revert migration - Disable pgvector extension
   *
   * WARNING: This will remove the vector extension and all vector columns.
   * Only run this if you're sure no tables are using vector data types.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS vector`);
  }
}
