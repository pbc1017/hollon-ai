import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddConflictResolution1733720000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Conflict enums
    await queryRunner.query(`
      CREATE TYPE "conflict_type_enum" AS ENUM (
        'file_conflict',
        'resource_conflict',
        'priority_conflict',
        'deadline_conflict'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "conflict_status_enum" AS ENUM (
        'detected',
        'resolving',
        'resolved',
        'escalated'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "resolution_strategy_enum" AS ENUM (
        'sequential_execution',
        'resource_reallocation',
        'priority_adjustment',
        'deadline_extension',
        'manual_intervention'
      );
    `);

    // Conflict resolutions table
    await queryRunner.query(`
      CREATE TABLE "conflict_resolutions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "conflict_type" conflict_type_enum NOT NULL,
        "status" conflict_status_enum NOT NULL DEFAULT 'detected',
        "description" text NOT NULL,
        "affected_task_ids" jsonb DEFAULT '[]',
        "affected_hollon_ids" jsonb DEFAULT '[]',
        "conflict_context" jsonb DEFAULT '{}',
        "resolution_strategy" resolution_strategy_enum,
        "resolution_details" text,
        "resolved_at" timestamp,
        "escalated_at" timestamp,
        "escalation_reason" text,
        "metadata" jsonb DEFAULT '{}',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_conflict_resolutions_organization_status"
      ON "conflict_resolutions" ("organization_id", "status");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_conflict_resolutions_type_status"
      ON "conflict_resolutions" ("conflict_type", "status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_conflict_resolutions_type_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_conflict_resolutions_organization_status"`,
    );

    // Drop table
    await queryRunner.query(`DROP TABLE IF EXISTS "conflict_resolutions"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "resolution_strategy_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "conflict_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "conflict_type_enum"`);
  }
}
