import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enable pgvector extension for vector similarity search
 *
 * This migration enables the pgvector extension in PostgreSQL,
 * which provides vector data types and similarity search capabilities
 * for AI/ML applications.
 */
export class EnablePgvector1766556720000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP EXTENSION IF EXISTS vector`);
  }
}
