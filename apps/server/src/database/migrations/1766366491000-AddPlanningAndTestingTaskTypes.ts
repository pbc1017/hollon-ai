import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPlanningAndTestingTaskTypes1766366491000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'planning' and 'testing' to task_type_enum
    await queryRunner.query(`
      ALTER TYPE task_type_enum ADD VALUE IF NOT EXISTS 'planning';
    `);

    await queryRunner.query(`
      ALTER TYPE task_type_enum ADD VALUE IF NOT EXISTS 'testing';
    `);

    // Add 'P0' to task_priority_enum
    await queryRunner.query(`
      ALTER TYPE task_priority_enum ADD VALUE IF NOT EXISTS 'P0';
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Note: PostgreSQL doesn't support removing enum values
    // This migration cannot be reversed automatically
    // Manual intervention required if rollback is needed
    throw new Error('Cannot rollback enum value additions');
  }
}
