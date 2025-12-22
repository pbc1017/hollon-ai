import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddWaitingForHollonStatus1735200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Phase 1.5: Add 'waiting_for_hollon' to the task_status_enum
    await queryRunner.query(`
      ALTER TYPE "task_status_enum" ADD VALUE IF NOT EXISTS 'waiting_for_hollon';
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values directly
    // To roll this back, you would need to:
    // 1. Create a new enum without 'waiting_for_hollon'
    // 2. Alter all columns using the old enum to use the new enum
    // 3. Drop the old enum
    // 4. Rename the new enum to the old name
    // This is left as a manual process due to complexity
    throw new Error(
      'Cannot automatically revert enum value addition. Manual intervention required.',
    );
  }
}
