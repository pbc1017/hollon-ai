import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddOrganizationContextPrompt1734000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add contextPrompt column to organizations table
    await queryRunner.query(`
      ALTER TABLE "organizations"
      ADD COLUMN "context_prompt" text NULL;
    `);

    // Add comment
    await queryRunner.query(`
      COMMENT ON COLUMN "organizations"."context_prompt" IS '조직 수준의 컨텍스트 프롬프트';
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "organizations"
      DROP COLUMN "context_prompt";
    `);
  }
}
