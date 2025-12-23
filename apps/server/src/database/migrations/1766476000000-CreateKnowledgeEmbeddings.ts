import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeEmbeddings1766476000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create knowledge_embeddings table
    await queryRunner.query(`
      CREATE TABLE "knowledge_embeddings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "item_id" uuid NOT NULL,
        "embedding" vector(1536) NOT NULL,
        "model_used" varchar(100) NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_knowledge_embeddings_item" FOREIGN KEY ("item_id") REFERENCES "knowledge_items"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_knowledge_embeddings_item" UNIQUE ("item_id")
      )
    `);

    // Create indexes for vector similarity search
    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_embeddings_item" ON "knowledge_embeddings" ("item_id")
    `);

    // Create vector index for efficient similarity search (using ivfflat algorithm)
    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_embeddings_vector" ON "knowledge_embeddings"
      USING ivfflat ("embedding" vector_cosine_ops)
      WITH (lists = 100)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_knowledge_embeddings_vector"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_knowledge_embeddings_item"`,
    );
    await queryRunner.query(`DROP TABLE IF EXISTS "knowledge_embeddings"`);
  }
}
