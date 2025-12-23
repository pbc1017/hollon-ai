import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Knowledge Metrics Table
 *
 * Creates the knowledge_metrics table to track effectiveness and usage metrics
 * for knowledge documents. This enables:
 * - Identifying valuable knowledge through success rates
 * - Flagging ineffective or outdated knowledge
 * - Tracking knowledge application patterns
 * - Optimizing knowledge retrieval and recommendations
 */
export class CreateKnowledgeMetrics1766400000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create knowledge_metrics table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "knowledge_metrics" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "knowledge_id" uuid NOT NULL,
        "application_count" integer NOT NULL DEFAULT 0,
        "success_count" integer NOT NULL DEFAULT 0,
        "failure_count" integer NOT NULL DEFAULT 0,
        "effectiveness_score" decimal(5,2) NOT NULL DEFAULT 0,
        "last_applied_at" timestamp NULL,
        "is_flagged" boolean NOT NULL DEFAULT false,
        "metadata" jsonb NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "PK_knowledge_metrics" PRIMARY KEY ("id"),
        CONSTRAINT "FK_knowledge_metrics_knowledge" FOREIGN KEY ("knowledge_id")
          REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE NO ACTION,
        CONSTRAINT "UQ_knowledge_metrics_knowledge_id" UNIQUE ("knowledge_id")
      );
    `);

    // Create indexes for query optimization
    // Index for finding metrics by knowledge document
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_metrics_knowledge_id"
      ON "knowledge_metrics" ("knowledge_id");
    `);

    // Index for finding documents by effectiveness score (for recommendations)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_metrics_effectiveness_score"
      ON "knowledge_metrics" ("effectiveness_score" DESC);
    `);

    // Index for finding flagged knowledge (for cleanup/review)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_metrics_is_flagged"
      ON "knowledge_metrics" ("is_flagged")
      WHERE "is_flagged" = true;
    `);

    // Index for finding recently applied knowledge
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_metrics_last_applied_at"
      ON "knowledge_metrics" ("last_applied_at" DESC NULLS LAST);
    `);

    // Composite index for finding high-quality, recently used knowledge
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_knowledge_metrics_score_applied"
      ON "knowledge_metrics" ("effectiveness_score" DESC, "last_applied_at" DESC NULLS LAST)
      WHERE "is_flagged" = false;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_knowledge_metrics_score_applied";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_knowledge_metrics_last_applied_at";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_knowledge_metrics_is_flagged";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_knowledge_metrics_effectiveness_score";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_knowledge_metrics_knowledge_id";
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "knowledge_metrics";
    `);
  }
}
