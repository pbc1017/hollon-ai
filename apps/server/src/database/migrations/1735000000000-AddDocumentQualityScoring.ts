import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Add quality scoring fields to documents table
 * - quality_score: Weighted score based on completeness, usage, ratings, and freshness
 * - view_count: Number of times the document has been accessed
 * - rating_sum: Sum of all user ratings
 * - rating_count: Number of user ratings
 * - last_accessed_at: Timestamp of last access
 */
export class AddDocumentQualityScoring1735000000000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add quality_score column (0-100 scale)
    await queryRunner.addColumn(
      'documents',
      new TableColumn({
        name: 'quality_score',
        type: 'decimal',
        precision: 5,
        scale: 2,
        default: 0,
        isNullable: false,
        comment: 'Weighted quality score (0-100)',
      }),
    );

    // 2. Add view_count column
    await queryRunner.addColumn(
      'documents',
      new TableColumn({
        name: 'view_count',
        type: 'integer',
        default: 0,
        isNullable: false,
        comment: 'Number of times document has been accessed',
      }),
    );

    // 3. Add rating_sum column
    await queryRunner.addColumn(
      'documents',
      new TableColumn({
        name: 'rating_sum',
        type: 'integer',
        default: 0,
        isNullable: false,
        comment: 'Sum of all user ratings (1-5 scale)',
      }),
    );

    // 4. Add rating_count column
    await queryRunner.addColumn(
      'documents',
      new TableColumn({
        name: 'rating_count',
        type: 'integer',
        default: 0,
        isNullable: false,
        comment: 'Number of user ratings',
      }),
    );

    // 5. Add last_accessed_at column
    await queryRunner.addColumn(
      'documents',
      new TableColumn({
        name: 'last_accessed_at',
        type: 'timestamp',
        isNullable: true,
        comment: 'Timestamp of last access',
      }),
    );

    // 6. Create index on quality_score for efficient ranking
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_quality_score"
      ON "documents" ("quality_score" DESC)
    `);

    // 7. Create composite index for type + quality_score
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_type_quality_score"
      ON "documents" ("type", "quality_score" DESC)
    `);

    // 8. Create composite index for organization_id + quality_score
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_org_quality_score"
      ON "documents" ("organization_id", "quality_score" DESC)
    `);

    // 9. Initialize quality scores for existing documents
    await queryRunner.query(`
      UPDATE "documents"
      SET "quality_score" = 50.0,
          "last_accessed_at" = COALESCE("updated_at", "created_at")
      WHERE "quality_score" = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop indexes
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_documents_org_quality_score"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_documents_type_quality_score"
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_documents_quality_score"
    `);

    // 2. Drop columns
    await queryRunner.dropColumn('documents', 'last_accessed_at');
    await queryRunner.dropColumn('documents', 'rating_count');
    await queryRunner.dropColumn('documents', 'rating_sum');
    await queryRunner.dropColumn('documents', 'view_count');
    await queryRunner.dropColumn('documents', 'quality_score');
  }
}
