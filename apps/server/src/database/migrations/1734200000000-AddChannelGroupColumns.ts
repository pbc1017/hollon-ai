import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChannelGroupColumns1734200000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add 'group' value to channel_type_enum
    await queryRunner.query(`
      ALTER TYPE "channel_type_enum" ADD VALUE IF NOT EXISTS 'group';
    `);

    // Add is_group column
    await queryRunner.query(`
      ALTER TABLE "channels"
      ADD COLUMN IF NOT EXISTS "is_group" boolean NOT NULL DEFAULT false;
    `);

    // Add max_members column
    await queryRunner.query(`
      ALTER TABLE "channels"
      ADD COLUMN IF NOT EXISTS "max_members" integer NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Remove max_members column
    await queryRunner.query(`
      ALTER TABLE "channels"
      DROP COLUMN IF EXISTS "max_members";
    `);

    // Remove is_group column
    await queryRunner.query(`
      ALTER TABLE "channels"
      DROP COLUMN IF EXISTS "is_group";
    `);

    // Note: Cannot remove enum value in PostgreSQL without recreating the type
    // Leaving 'group' value in channel_type_enum
  }
}
