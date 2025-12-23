import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeSystem1767000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create Knowledge Enums
    await queryRunner.query(`
      CREATE TYPE "knowledge_category_enum" AS ENUM (
        'best_practice',
        'pattern',
        'pitfall',
        'solution',
        'learning',
        'architecture',
        'process'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "knowledge_source_enum" AS ENUM (
        'task_completion',
        'code_review',
        'retrospective',
        'documentation',
        'team_discussion',
        'hollon_learning'
      )
    `);

    // Knowledge table
    await queryRunner.query(`
      CREATE TABLE "knowledge" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "title" varchar(255) NOT NULL,
        "content" text NOT NULL,
        "category" "knowledge_category_enum" NOT NULL,
        "source" "knowledge_source_enum" NOT NULL,
        "organization_id" uuid NOT NULL,
        "relevant_task_id" uuid,
        "created_by_hollon_id" uuid,
        "tags" text[],
        "metadata" jsonb,
        "is_verified" boolean NOT NULL DEFAULT false,
        "verification_count" integer NOT NULL DEFAULT 0,
        "usage_count" integer NOT NULL DEFAULT 0,
        "last_used_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_organization" FOREIGN KEY ("organization_id") 
          REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_task" FOREIGN KEY ("relevant_task_id") 
          REFERENCES "tasks"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_knowledge_hollon" FOREIGN KEY ("created_by_hollon_id") 
          REFERENCES "hollons"("id") ON DELETE SET NULL
      )
    `);

    // Create indexes for knowledge table
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_organization" ON "knowledge" ("organization_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_category_org" ON "knowledge" ("category", "organization_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_source" ON "knowledge" ("source")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_task" ON "knowledge" ("relevant_task_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_hollon" ON "knowledge" ("created_by_hollon_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_tags" ON "knowledge" USING GIN ("tags")`,
    );

    // Create Relation Type Enum
    await queryRunner.query(`
      CREATE TYPE "relation_type_enum" AS ENUM (
        'refines',
        'conflicts',
        'depends_on',
        'related_to',
        'supersedes',
        'complements'
      )
    `);

    // Knowledge Relations table (many-to-many with metadata)
    await queryRunner.query(`
      CREATE TABLE "knowledge_relations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "source_id" uuid NOT NULL,
        "target_id" uuid NOT NULL,
        "type" "relation_type_enum" NOT NULL,
        "description" text,
        "strength" float,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_relations_source" FOREIGN KEY ("source_id") 
          REFERENCES "knowledge"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_knowledge_relations_target" FOREIGN KEY ("target_id") 
          REFERENCES "knowledge"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_knowledge_relations_unique" UNIQUE ("source_id", "target_id", "type")
      )
    `);

    // Create indexes for knowledge relations table
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_relations_source" ON "knowledge_relations" ("source_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_relations_target" ON "knowledge_relations" ("target_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_relations_type" ON "knowledge_relations" ("type")`,
    );

    // Create Embedding Model Enum
    await queryRunner.query(`
      CREATE TYPE "embedding_model_enum" AS ENUM (
        'text-embedding-3-small',
        'text-embedding-3-large',
        'text-embedding-ada-002'
      )
    `);

    // Embeddings table
    await queryRunner.query(`
      CREATE TABLE "embeddings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "knowledge_id" uuid NOT NULL,
        "vector" text NOT NULL,
        "model" "embedding_model_enum" NOT NULL,
        "vector_dimension" integer NOT NULL DEFAULT 1536,
        "input_tokens" integer,
        "content" text,
        "is_active" boolean NOT NULL DEFAULT true,
        "generated_at" timestamp NOT NULL DEFAULT now(),
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_embeddings_knowledge" FOREIGN KEY ("knowledge_id") 
          REFERENCES "knowledge"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for embeddings table
    await queryRunner.query(
      `CREATE INDEX "IDX_embeddings_knowledge" ON "embeddings" ("knowledge_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_embeddings_model" ON "embeddings" ("model")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_embeddings_is_active" ON "embeddings" ("is_active")`,
    );

    // Create Metadata Key Type Enum
    await queryRunner.query(`
      CREATE TYPE "metadata_key_type_enum" AS ENUM (
        'skill',
        'domain',
        'pattern',
        'complexity',
        'time_to_learn',
        'applicability',
        'prerequisite',
        'outcome'
      )
    `);

    // Knowledge Metadata table
    await queryRunner.query(`
      CREATE TABLE "knowledge_metadata" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "knowledge_id" uuid NOT NULL,
        "key_type" "metadata_key_type_enum" NOT NULL,
        "value" text NOT NULL,
        "confidence_score" float,
        "metadata" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_metadata_knowledge" FOREIGN KEY ("knowledge_id") 
          REFERENCES "knowledge"("id") ON DELETE CASCADE
      )
    `);

    // Create indexes for knowledge metadata table
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_metadata_knowledge" ON "knowledge_metadata" ("knowledge_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_metadata_type" ON "knowledge_metadata" ("key_type")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_metadata_type_value" ON "knowledge_metadata" ("key_type", "value")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_metadata"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "metadata_key_type_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "embeddings"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "embedding_model_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_relations"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "relation_type_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "knowledge_source_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "knowledge_category_enum"`);
  }
}
