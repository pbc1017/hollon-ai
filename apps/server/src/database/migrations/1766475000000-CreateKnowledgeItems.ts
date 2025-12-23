import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeItems1766475000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create knowledge_items table
    await queryRunner.query(`
      CREATE TYPE "knowledge_item_type_enum" AS ENUM (
        'document',
        'code_snippet',
        'decision',
        'architecture',
        'process',
        'learning',
        'decision_log',
        'technical_spec'
      );

      CREATE TABLE "knowledge_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "content" text NOT NULL,
        "type" knowledge_item_type_enum NOT NULL DEFAULT 'document',
        "source_url" varchar(2048),
        "title" varchar(500),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_items_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for performance
    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_items_organization" ON "knowledge_items" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_items_type" ON "knowledge_items" ("type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_items_created_at" ON "knowledge_items" ("created_at")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_knowledge_items_created_at"`,
    );
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_items_type"`);
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_knowledge_items_organization"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_items"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "knowledge_item_type_enum"`);
  }
}
