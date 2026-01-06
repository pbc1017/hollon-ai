import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddApprovalAndWeek121733710000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Hollon lifecycle enum
    await queryRunner.query(`
      CREATE TYPE "hollon_lifecycle_enum" AS ENUM ('permanent', 'temporary');
    `);

    // Add lifecycle and createdByHollonId to hollons table
    await queryRunner.query(`
      ALTER TABLE "hollons"
      ADD COLUMN "lifecycle" hollon_lifecycle_enum NOT NULL DEFAULT 'permanent',
      ADD COLUMN "created_by_hollon_id" uuid;
    `);

    // Drop old approval_requests table from InitialSchema (we'll recreate with new structure)
    await queryRunner.query(`DROP TABLE IF EXISTS "approval_requests" CASCADE`);

    // Approval request type enum (approval_status_enum already exists from InitialSchema)
    await queryRunner.query(`
      CREATE TYPE "approval_request_type_enum" AS ENUM (
        'create_permanent_hollon',
        'delete_permanent_hollon',
        'escalation',
        'incident_resolution'
      );
    `);

    // Approval requests table (recreated with new structure)
    await queryRunner.query(`
      CREATE TABLE "approval_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "request_type" approval_request_type_enum NOT NULL,
        "description" text NOT NULL,
        "metadata" jsonb DEFAULT '{}',
        "requested_by" varchar,
        "status" approval_status_enum NOT NULL DEFAULT 'pending',
        "approved_by" varchar,
        "approved_at" timestamp,
        "rejected_by" varchar,
        "rejected_at" timestamp,
        "rejection_reason" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_approval_requests_status"
      ON "approval_requests" ("status");
    `);

    // Cross-team contract enums
    await queryRunner.query(`
      CREATE TYPE "contract_status_enum" AS ENUM (
        'pending',
        'negotiating',
        'accepted',
        'in_progress',
        'delivered',
        'rejected',
        'cancelled'
      );
    `);

    // Cross-team contracts table
    await queryRunner.query(`
      CREATE TABLE "cross_team_contracts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "requester_team_id" uuid NOT NULL,
        "target_team_id" uuid NOT NULL,
        "description" text NOT NULL,
        "deliverables" jsonb DEFAULT '[]',
        "requested_deadline" timestamp,
        "agreed_deadline" timestamp,
        "status" contract_status_enum NOT NULL DEFAULT 'pending',
        "negotiation_notes" text,
        "delivered_at" timestamp,
        "metadata" jsonb DEFAULT '{}',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_cross_team_contracts_requester_team"
          FOREIGN KEY ("requester_team_id")
          REFERENCES "teams"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_cross_team_contracts_target_team"
          FOREIGN KEY ("target_team_id")
          REFERENCES "teams"("id")
          ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_cross_team_contracts_requester_status"
      ON "cross_team_contracts" ("requester_team_id", "status");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_cross_team_contracts_target_status"
      ON "cross_team_contracts" ("target_team_id", "status");
    `);

    // Incident enums
    await queryRunner.query(`
      CREATE TYPE "incident_severity_enum" AS ENUM ('P1', 'P2', 'P3', 'P4');
    `);

    await queryRunner.query(`
      CREATE TYPE "incident_status_enum" AS ENUM (
        'reported',
        'investigating',
        'identified',
        'resolving',
        'resolved',
        'closed'
      );
    `);

    // Incidents table
    await queryRunner.query(`
      CREATE TABLE "incidents" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "title" varchar(255) NOT NULL,
        "description" text NOT NULL,
        "severity" incident_severity_enum NOT NULL,
        "status" incident_status_enum NOT NULL DEFAULT 'reported',
        "reporter_hollon_id" uuid,
        "owner_hollon_id" uuid,
        "channel_id" uuid,
        "impact" jsonb DEFAULT '{}',
        "timeline" jsonb DEFAULT '[]',
        "resolved_at" timestamp,
        "resolution_summary" text,
        "metadata" jsonb DEFAULT '{}',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_incidents_reporter_hollon"
          FOREIGN KEY ("reporter_hollon_id")
          REFERENCES "hollons"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_incidents_owner_hollon"
          FOREIGN KEY ("owner_hollon_id")
          REFERENCES "hollons"("id")
          ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_incidents_organization_status"
      ON "incidents" ("organization_id", "status");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_incidents_severity_status"
      ON "incidents" ("severity", "status");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_incidents_severity_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_incidents_organization_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cross_team_contracts_target_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_cross_team_contracts_requester_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_approval_requests_status"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "incidents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "cross_team_contracts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "approval_requests"`);

    // Drop hollons columns
    await queryRunner.query(`
      ALTER TABLE "hollons"
      DROP COLUMN IF EXISTS "created_by_hollon_id",
      DROP COLUMN IF EXISTS "lifecycle";
    `);

    // Drop enums (don't drop approval_status_enum as it's from InitialSchema)
    await queryRunner.query(`DROP TYPE IF EXISTS "incident_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "incident_severity_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "contract_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "approval_request_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "hollon_lifecycle_enum"`);
  }
}
