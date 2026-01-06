import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTeamManagerReviewerType1735100000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'team_manager' to the reviewer_type_enum
    await queryRunner.query(`
      ALTER TYPE "reviewer_type_enum" ADD VALUE IF NOT EXISTS 'team_manager';
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // To roll this back, you would need to:
    // 1. Create a new enum without 'team_manager'
    // 2. Alter all columns using the old enum to use the new enum
    // 3. Drop the old enum
    // 4. Rename the new enum to the old name
    // This is left as a manual process due to complexity
    throw new Error(
      'Cannot automatically revert enum value addition. Manual intervention required.',
    );
  }
}
