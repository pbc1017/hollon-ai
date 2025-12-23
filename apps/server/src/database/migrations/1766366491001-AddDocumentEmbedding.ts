import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Vector Search 설정: DocumentEmbedding 엔티티 및 pgvector 마이그레이션
 * - pgvector 확장 활성화
 * - document_embeddings 테이블 생성 (vector(1536) 타입)
 * - HNSW 인덱스 생성 (벡터 유사도 검색 최적화)
 */
export class AddDocumentEmbedding1766366491001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. pgvector 확장 활성화 (이미 있을 수 있음)
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // 2. document_embeddings 테이블 생성
    await queryRunner.query(`
      CREATE TABLE "document_embeddings" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "document_id" uuid NOT NULL,
        "embedding" vector(1536) NOT NULL,
        "model" varchar(100) NOT NULL DEFAULT 'text-embedding-3-small',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_document_embeddings_document_id" FOREIGN KEY ("document_id")
          REFERENCES "documents"("id") ON DELETE CASCADE
      )
    `);

    // 3. document_id 인덱스 생성 (조회 성능 최적화)
    await queryRunner.query(`
      CREATE INDEX "IDX_document_embeddings_document_id"
      ON "document_embeddings" ("document_id")
    `);

    // 4. document_id와 created_at 복합 인덱스 (최신 임베딩 조회 최적화)
    await queryRunner.query(`
      CREATE INDEX "IDX_document_embeddings_document_created"
      ON "document_embeddings" ("document_id", "created_at" DESC)
    `);

    // 5. HNSW 인덱스 생성 (벡터 유사도 검색 최적화)
    // HNSW는 근사 최근이웃 검색에 최적화된 인덱스
    await queryRunner.query(`
      CREATE INDEX "IDX_document_embeddings_vector_hnsw"
      ON "document_embeddings" USING hnsw (embedding vector_cosine_ops)
      WITH (m = 16, ef_construction = 200)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. 인덱스 삭제
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_document_embeddings_vector_hnsw"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_document_embeddings_document_created"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_document_embeddings_document_id"`,
    );

    // 2. 테이블 삭제
    await queryRunner.query(`DROP TABLE IF EXISTS "document_embeddings"`);
  }
}
