import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable pgvector extension for vector storage
 *
 * This migration enables the pgvector extension in PostgreSQL, which provides
 * vector data types and similarity search capabilities. This is required for
 * storing and querying vector embeddings.
 */
export class EnablePgvector1766556720000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Enable pgvector extension
    await queryRunner.query(`
      CREATE EXTENSION IF NOT EXISTS vector;
    `);

    // Add comment for clarity
    await queryRunner.query(`
      COMMENT ON EXTENSION vector IS
        'Vector data type and similarity search operations for PostgreSQL.
         Used for storing and querying embeddings for semantic search and RAG.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop pgvector extension
    // Note: This will fail if any tables are using vector types
    await queryRunner.query(`
      DROP EXTENSION IF EXISTS vector;
    `);
  }
}
