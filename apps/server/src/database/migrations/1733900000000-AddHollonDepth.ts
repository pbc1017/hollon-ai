import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHollonDepth1733900000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add depth column to hollons table
    await queryRunner.query(`
      ALTER TABLE "hollons"
      ADD COLUMN "depth" integer NOT NULL DEFAULT 0;
    `);

    // Add comment
    await queryRunner.query(`
      COMMENT ON COLUMN "hollons"."depth" IS '임시 홀론 재귀 생성 깊이 (영구 홀론은 제한 없음)';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "hollons"
      DROP COLUMN "depth";
    `);
  }
}
