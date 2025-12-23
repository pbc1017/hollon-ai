import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeMetadata1766478000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create knowledge_metadata table
    await queryRunner.query(`
      CREATE TABLE "knowledge_metadata" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "item_id" uuid NOT NULL,
        "metadata_key" varchar(255) NOT NULL,
        "metadata_value" text NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_metadata_item" FOREIGN KEY ("item_id") REFERENCES "knowledge_items"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_knowledge_metadata_item_key" UNIQUE ("item_id", "metadata_key")
      )
    `);

    // Create indexes for metadata queries
    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_metadata_item" ON "knowledge_metadata" ("item_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_metadata_key" ON "knowledge_metadata" ("metadata_key")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_metadata_key_value" ON "knowledge_metadata" ("metadata_key", "metadata_value"(255))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_metadata_key_value"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_metadata_key"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_metadata_item"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_metadata"`);
  }
}
