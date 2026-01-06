import { MigrationInterface, QueryRunner } from 'typeorm';

export class MeetingSystem1733500000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Meeting records table
    await queryRunner.query(`
      CREATE TYPE "meeting_type_enum" AS ENUM (
        'standup',
        'sprint_planning',
        'retrospective',
        'tech_debt_review',
        'ad_hoc'
      );

      CREATE TABLE "meeting_records" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "team_id" uuid,
        "meeting_type" meeting_type_enum NOT NULL,
        "title" varchar(500) NOT NULL,
        "content" text NOT NULL,
        "metadata" jsonb DEFAULT '{}',
        "scheduled_at" timestamp,
        "completed_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_meeting_records_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_meeting_records_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_meeting_records_organization" ON "meeting_records" ("organization_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meeting_records_team" ON "meeting_records" ("team_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meeting_records_type_date" ON "meeting_records" ("meeting_type", "created_at" DESC)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "meeting_records"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "meeting_type_enum"`);
  }
}
