import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeTables1766495849000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create knowledge_items table
    await queryRunner.query(`
      CREATE TABLE "knowledge_items" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "source_type" varchar(50) NOT NULL,
        "source_id" uuid,
        "title" varchar(500) NOT NULL,
        "content" text NOT NULL,
        "summary" text,
        "keywords" jsonb DEFAULT '[]',
        "metadata" jsonb DEFAULT '{}',
        "version" integer NOT NULL DEFAULT 1,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_items_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for knowledge_items
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_items_org_source" ON "knowledge_items" ("organization_id", "source_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_items_org_active" ON "knowledge_items" ("organization_id", "is_active")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_items_updated" ON "knowledge_items" ("updated_at")`,
    );

    // Create knowledge_embeddings table (for vector similarity search)
    await queryRunner.query(`
      CREATE TABLE "knowledge_embeddings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "knowledge_item_id" uuid NOT NULL UNIQUE,
        "embedding" vector(1536) NOT NULL,
        "embedding_model" varchar(100) NOT NULL DEFAULT 'text-embedding-3-small',
        "content_hash" varchar(64),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_embeddings_item" FOREIGN KEY ("knowledge_item_id") REFERENCES "knowledge_items"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for knowledge_embeddings (vector similarity search)
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_embeddings_vector" ON "knowledge_embeddings" USING ivfflat ("embedding" vector_cosine_ops)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_embeddings_model" ON "knowledge_embeddings" ("embedding_model")`,
    );

    // Create knowledge_relations table (knowledge item relationships)
    await queryRunner.query(`
      CREATE TYPE "relation_type_enum" AS ENUM ('related', 'dependency', 'precedent', 'similar', 'alternative', 'extends', 'contradicts');

      CREATE TABLE "knowledge_relations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "source_knowledge_id" uuid NOT NULL,
        "target_knowledge_id" uuid NOT NULL,
        "relation_type" relation_type_enum NOT NULL DEFAULT 'related',
        "confidence_score" decimal(3,2) DEFAULT 1.0,
        "discovered_at" timestamp NOT NULL DEFAULT now(),
        "metadata" jsonb DEFAULT '{}',
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_relations_source" FOREIGN KEY ("source_knowledge_id") REFERENCES "knowledge_items"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_relations_target" FOREIGN KEY ("target_knowledge_id") REFERENCES "knowledge_items"("id") ON DELETE CASCADE,
        CONSTRAINT "CHK_knowledge_relations_different" CHECK ("source_knowledge_id" != "target_knowledge_id")
      )
    `);

    // Create indexes for knowledge_relations
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_relations_source" ON "knowledge_relations" ("source_knowledge_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_relations_target" ON "knowledge_relations" ("target_knowledge_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_relations_type" ON "knowledge_relations" ("relation_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_relations_bidirectional" ON "knowledge_relations" ("source_knowledge_id", "target_knowledge_id")`,
    );

    // Create knowledge_metadata table (extended metadata for analysis and filtering)
    await queryRunner.query(`
      CREATE TABLE "knowledge_metadata" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "knowledge_item_id" uuid NOT NULL,
        "access_count" integer NOT NULL DEFAULT 0,
        "last_accessed_at" timestamp,
        "relevance_score" decimal(5,2),
        "quality_score" decimal(5,2),
        "tags" jsonb DEFAULT '[]',
        "context" varchar(50),
        "language" varchar(10) DEFAULT 'en',
        "domain" varchar(100),
        "complexity_level" varchar(20),
        "usage_statistics" jsonb DEFAULT '{}',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_metadata_item" FOREIGN KEY ("knowledge_item_id") REFERENCES "knowledge_items"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_knowledge_metadata_item" UNIQUE ("knowledge_item_id")
      )
    `);

    // Create indexes for knowledge_metadata
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_metadata_access" ON "knowledge_metadata" ("access_count")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_metadata_relevance" ON "knowledge_metadata" ("relevance_score")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_metadata_domain" ON "knowledge_metadata" ("domain")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_metadata_complexity" ON "knowledge_metadata" ("complexity_level")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order of creation
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_metadata"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_relations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "relation_type_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_embeddings"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_items"`);
  }
}
