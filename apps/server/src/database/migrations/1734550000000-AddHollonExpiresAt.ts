import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddHollonExpiresAt1734550000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add expires_at column to hollons table for temporary hollon cleanup
    await queryRunner.query(`
      ALTER TABLE "hollons"
      ADD COLUMN "expires_at" timestamp;
    `);

    // Create index on expires_at for efficient cleanup queries
    await queryRunner.query(`
      CREATE INDEX "IDX_hollons_expires_at"
      ON "hollons" ("expires_at")
      WHERE "expires_at" IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hollons_expires_at"`);

    // Remove column
    await queryRunner.query(`
      ALTER TABLE "hollons"
      DROP COLUMN IF EXISTS "expires_at";
    `);
  }
}
