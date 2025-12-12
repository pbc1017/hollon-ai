import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKnowledgeVersioning1734400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create change_type enum
    await queryRunner.query(`
      CREATE TYPE "change_type_enum" AS ENUM (
        'created',
        'updated',
        'content_changed',
        'tags_changed',
        'metadata_changed'
      );
    `);

    // Create knowledge_versions table
    await queryRunner.query(`
      CREATE TABLE "knowledge_versions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "document_id" uuid NOT NULL,
        "task_id" uuid NOT NULL,
        "version" integer NOT NULL,
        "title" text NOT NULL,
        "content" text NOT NULL,
        "tags" text[],
        "metadata" jsonb,
        "change_types" change_type_enum[] NOT NULL,
        "change_summary" text,
        "diff" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_versions_document" FOREIGN KEY ("document_id") 
          REFERENCES "documents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_versions_task" FOREIGN KEY ("task_id") 
          REFERENCES "tasks"("id") ON DELETE CASCADE
      );
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_knowledge_versions_document_version" 
        ON "knowledge_versions" ("document_id", "version");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_versions_task_id" 
        ON "knowledge_versions" ("task_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_versions_created_at" 
        ON "knowledge_versions" ("created_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "IDX_knowledge_versions_created_at";`);
    await queryRunner.query(`DROP INDEX "IDX_knowledge_versions_task_id";`);
    await queryRunner.query(
      `DROP INDEX "IDX_knowledge_versions_document_version";`,
    );
    await queryRunner.query(`DROP TABLE "knowledge_versions";`);
    await queryRunner.query(`DROP TYPE "change_type_enum";`);
  }
}
