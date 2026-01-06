import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Knowledge Extraction Module - Create knowledge_items table
 *
 * This migration creates the knowledge_items table for storing extracted knowledge
 * from various sources within the organization.
 */
export class CreateKnowledgeItemsTable1766556710000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create knowledge_items table
    await queryRunner.query(`
      CREATE TABLE "knowledge_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "content" text NOT NULL,
        "source" varchar(255) NOT NULL,
        "extracted_at" timestamp NOT NULL,
        "metadata" jsonb,
        "organization_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_items_organization"
          FOREIGN KEY ("organization_id")
          REFERENCES "organizations"("id")
          ON DELETE CASCADE
      );
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX "idx_knowledge_items_organization_id"
        ON "knowledge_items"("organization_id");

      CREATE INDEX "idx_knowledge_items_source"
        ON "knowledge_items"("source");

      CREATE INDEX "idx_knowledge_items_extracted_at"
        ON "knowledge_items"("extracted_at");
    `);

    // Add comments for clarity
    await queryRunner.query(`
      COMMENT ON TABLE "knowledge_items" IS
        'Stores extracted knowledge items from various sources within the organization.
         Used by the Knowledge Extraction Service for RAG and knowledge management.';

      COMMENT ON COLUMN "knowledge_items"."content" IS
        'The extracted knowledge content or text.';

      COMMENT ON COLUMN "knowledge_items"."source" IS
        'Source identifier of where the knowledge was extracted from.';

      COMMENT ON COLUMN "knowledge_items"."extracted_at" IS
        'Timestamp when the knowledge was extracted.';

      COMMENT ON COLUMN "knowledge_items"."metadata" IS
        'Additional metadata about the extracted knowledge in JSON format.';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "idx_knowledge_items_extracted_at";
      DROP INDEX IF EXISTS "idx_knowledge_items_source";
      DROP INDEX IF EXISTS "idx_knowledge_items_organization_id";
    `);

    // Drop table
    await queryRunner.query(`
      DROP TABLE IF EXISTS "knowledge_items";
    `);
  }
}
