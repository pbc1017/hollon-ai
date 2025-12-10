import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

/**
 * Phase 3.5: Document에 team_id 컬럼 추가
 * - 팀별 지식 분리를 위한 team_id 필드
 */
export class AddTeamIdToDocuments1734600000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. team_id 컬럼 추가
    await queryRunner.addColumn(
      'documents',
      new TableColumn({
        name: 'team_id',
        type: 'uuid',
        isNullable: true,
      }),
    );

    // 2. team_id 인덱스 추가
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_documents_team_id"
      ON "documents" ("team_id")
    `);

    // 3. team_id 외래 키 추가 (teams 테이블 참조)
    await queryRunner.query(`
      ALTER TABLE "documents"
      ADD CONSTRAINT "FK_documents_team_id"
      FOREIGN KEY ("team_id")
      REFERENCES "teams"("id")
      ON DELETE SET NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. 외래 키 제거
    await queryRunner.query(`
      ALTER TABLE "documents"
      DROP CONSTRAINT IF EXISTS "FK_documents_team_id"
    `);

    // 2. 인덱스 제거
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_documents_team_id"
    `);

    // 3. team_id 컬럼 제거
    await queryRunner.dropColumn('documents', 'team_id');
  }
}
