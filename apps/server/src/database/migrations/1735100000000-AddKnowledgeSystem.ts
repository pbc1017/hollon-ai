import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phase 4: Knowledge Management System
 *
 * Creates the knowledge and task_knowledge tables for storing and associating
 * knowledge entries with tasks.
 */
export class AddKnowledgeSystem1735100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create knowledge table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "knowledge" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "category" character varying NOT NULL,
        "content" text NOT NULL,
        "tags" text[] NOT NULL DEFAULT '{}',
        "metadata" jsonb,
        "relevance_score" decimal(5,2) NOT NULL DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_knowledge_category" CHECK ("category" IN (
          'technical',
          'business',
          'process',
          'architecture',
          'troubleshooting',
          'best_practice',
          'lesson_learned',
          'documentation'
        )),
        CONSTRAINT "CHK_knowledge_relevance_score" CHECK ("relevance_score" >= 0 AND "relevance_score" <= 100)
      );
    `);

    // Create indexes on knowledge table
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_category"
      ON "knowledge" ("category");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_relevance_score"
      ON "knowledge" ("relevance_score");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_created_at"
      ON "knowledge" ("created_at");
    `);

    // Create task_knowledge join table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "task_knowledge" (
        "task_id" uuid NOT NULL,
        "knowledge_id" uuid NOT NULL,
        "context_notes" text,
        "application_score" decimal(5,2) DEFAULT 0,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_task_knowledge" PRIMARY KEY ("task_id", "knowledge_id"),
        CONSTRAINT "FK_task_knowledge_task" FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "FK_task_knowledge_knowledge" FOREIGN KEY ("knowledge_id")
          REFERENCES "knowledge"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "CHK_task_knowledge_application_score" CHECK ("application_score" >= 0 AND "application_score" <= 100)
      );
    `);

    // Create unique index on task_knowledge
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_task_knowledge_unique"
      ON "task_knowledge" ("task_id", "knowledge_id");
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_task_knowledge_task_id"
      ON "task_knowledge" ("task_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_task_knowledge_knowledge_id"
      ON "task_knowledge" ("knowledge_id");
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_task_knowledge_created_at"
      ON "task_knowledge" ("created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes on task_knowledge
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_task_knowledge_created_at";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_task_knowledge_knowledge_id";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_task_knowledge_task_id";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_task_knowledge_unique";
    `);

    // Drop task_knowledge table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "task_knowledge";
    `);

    // Drop indexes on knowledge
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_knowledge_created_at";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_knowledge_relevance_score";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_knowledge_category";
    `);

    // Drop knowledge table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "knowledge";
    `);
  }
}
