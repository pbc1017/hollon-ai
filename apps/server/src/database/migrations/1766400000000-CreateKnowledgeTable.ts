import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeTable1766400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create knowledge source type enum
    await queryRunner.query(`
      CREATE TYPE "knowledge_source_type_enum" AS ENUM (
        'document',
        'conversation',
        'task_result',
        'code_analysis',
        'external_api',
        'user_input',
        'system_generated'
      )
    `);

    // Create knowledge table
    await queryRunner.query(`
      CREATE TABLE "knowledge" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "title" varchar(500) NOT NULL,
        "content" text NOT NULL,
        "source_type" knowledge_source_type_enum NOT NULL,
        "source_id" uuid,
        "metadata" jsonb,
        "tags" text[],
        "embedding" vector(1536),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Create indexes for optimal query performance
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_source" ON "knowledge" ("source_type", "source_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_created_at" ON "knowledge" ("created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_title" ON "knowledge" ("title")`,
    );
    
    // Create GIN index for tags array search
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_tags" ON "knowledge" USING GIN ("tags")`,
    );
    
    // Create index for vector similarity search (if pgvector is available)
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_embedding" ON "knowledge" USING ivfflat ("embedding" vector_cosine_ops) WITH (lists = 100)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_embedding"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_tags"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_title"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_created_at"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_source"`);

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge"`);

    // Drop enum type
    await queryRunner.query(`DROP TYPE IF EXISTS "knowledge_source_type_enum"`);
  }
}
