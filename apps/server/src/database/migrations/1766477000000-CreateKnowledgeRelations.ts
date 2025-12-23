import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeRelations1766477000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create knowledge_relations table
    await queryRunner.query(`
      CREATE TYPE "knowledge_relation_type_enum" AS ENUM (
        'references',
        'refines',
        'conflicts_with',
        'extends',
        'depends_on',
        'related_to',
        'supersedes',
        'supplements'
      );

      CREATE TABLE "knowledge_relations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "source_id" uuid NOT NULL,
        "target_id" uuid NOT NULL,
        "relation_type" knowledge_relation_type_enum NOT NULL,
        "description" text,
        "strength" float NOT NULL DEFAULT 1.0,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_relations_source" FOREIGN KEY ("source_id") REFERENCES "knowledge_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_relations_target" FOREIGN KEY ("target_id") REFERENCES "knowledge_items"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_knowledge_relations_not_self" CHECK ("source_id" != "target_id"),
        CONSTRAINT "UQ_knowledge_relations_pair" UNIQUE ("source_id", "target_id", "relation_type")
      )
    `);

    // Create indexes for relation traversal
    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_relations_source" ON "knowledge_relations" ("source_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_relations_target" ON "knowledge_relations" ("target_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_relations_type" ON "knowledge_relations" ("relation_type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_relations_source_type" ON "knowledge_relations" ("source_id", "relation_type")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_relations_source_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_relations_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_relations_target"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_knowledge_relations_source"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_relations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "knowledge_relation_type_enum"`);
  }
}
