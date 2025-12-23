import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKnowledgeItemTablesWithIndexes1766366600000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create KnowledgeItemRelation table
    await queryRunner.query(`
      CREATE TABLE "knowledge_item_relations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "source_knowledge_item_id" uuid NOT NULL,
        "target_knowledge_item_id" uuid NOT NULL,
        "relation_type" varchar(50) NOT NULL,
        "metadata" jsonb DEFAULT '{}',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_item_relations_source" FOREIGN KEY ("source_knowledge_item_id") 
          REFERENCES "documents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_item_relations_target" FOREIGN KEY ("target_knowledge_item_id") 
          REFERENCES "documents"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_source_target_different" CHECK ("source_knowledge_item_id" != "target_knowledge_item_id")
      )
    `);

    // Create index on relation_type (low cardinality to high cardinality ordering)
    // relation_type has few distinct values, so it goes first
    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_item_relations_type" ON "knowledge_item_relations" ("relation_type")
    `);

    // Create KnowledgeItemMetadata table
    await queryRunner.query(`
      CREATE TABLE "knowledge_item_metadata" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "knowledge_item_id" uuid NOT NULL,
        "metadata_type" varchar(100) NOT NULL,
        "metadata_key" varchar(255) NOT NULL,
        "metadata_value" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_item_metadata_knowledge_item" FOREIGN KEY ("knowledge_item_id") 
          REFERENCES "documents"("id") ON DELETE CASCADE
      )
    `);

    // Create composite index on (metadata_type, metadata_key) ordered by cardinality
    // metadata_type has moderate cardinality, metadata_key has higher cardinality
    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_item_metadata_type_key" ON "knowledge_item_metadata" ("metadata_type", "metadata_key")
    `);

    // Create individual index on metadata_key for queries filtering by key alone
    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_item_metadata_key" ON "knowledge_item_metadata" ("metadata_key")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes in reverse order
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_knowledge_item_metadata_key"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_knowledge_item_metadata_type_key"`,
    );

    // Drop metadata table
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_item_metadata"`);

    // Drop relation type index
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_knowledge_item_relations_type"`,
    );

    // Drop relations table
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_item_relations"`);
  }
}
