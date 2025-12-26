import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddCollaboration1733700000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Collaboration types and statuses
    await queryRunner.query(`
      CREATE TYPE "collaboration_type_enum" AS ENUM (
        'pair_programming',
        'code_review',
        'knowledge_sharing',
        'debugging',
        'architecture_review'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "collaboration_status_enum" AS ENUM (
        'pending',
        'accepted',
        'rejected',
        'active',
        'completed',
        'cancelled'
      );
    `);

    // Collaboration sessions table
    await queryRunner.query(`
      CREATE TABLE "collaboration_sessions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "type" collaboration_type_enum NOT NULL,
        "status" collaboration_status_enum NOT NULL DEFAULT 'pending',
        "requester_hollon_id" uuid NOT NULL,
        "collaborator_hollon_id" uuid,
        "task_id" uuid,
        "description" text,
        "metadata" jsonb DEFAULT '{}',
        "started_at" timestamp,
        "completed_at" timestamp,
        "outcome" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_collaboration_sessions_requester"
          FOREIGN KEY ("requester_hollon_id")
          REFERENCES "hollons"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_collaboration_sessions_collaborator"
          FOREIGN KEY ("collaborator_hollon_id")
          REFERENCES "hollons"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_collaboration_sessions_task"
          FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id")
          ON DELETE CASCADE
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_collaboration_sessions_requester_status"
      ON "collaboration_sessions" ("requester_hollon_id", "status");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_collaboration_sessions_collaborator_status"
      ON "collaboration_sessions" ("collaborator_hollon_id", "status");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_collaboration_sessions_task"
      ON "collaboration_sessions" ("task_id");
    `);

    // Pull request types and statuses
    await queryRunner.query(`
      CREATE TYPE "pr_status_enum" AS ENUM (
        'draft',
        'ready_for_review',
        'changes_requested',
        'approved',
        'merged',
        'closed'
      );
    `);

    await queryRunner.query(`
      CREATE TYPE "reviewer_type_enum" AS ENUM (
        'team_member',
        'security_reviewer',
        'architecture_reviewer',
        'performance_reviewer',
        'code_reviewer'
      );
    `);

    // Task pull requests table
    await queryRunner.query(`
      CREATE TABLE "task_pull_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "task_id" uuid NOT NULL,
        "pr_number" integer NOT NULL,
        "pr_url" varchar(500) NOT NULL,
        "repository" varchar(255) NOT NULL,
        "branch_name" varchar(255),
        "status" pr_status_enum NOT NULL DEFAULT 'draft',
        "author_hollon_id" uuid,
        "reviewer_hollon_id" uuid,
        "reviewer_type" reviewer_type_enum,
        "review_comments" text,
        "approved_at" timestamp,
        "merged_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_task_pull_requests_task"
          FOREIGN KEY ("task_id")
          REFERENCES "tasks"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_task_pull_requests_author"
          FOREIGN KEY ("author_hollon_id")
          REFERENCES "hollons"("id")
          ON DELETE SET NULL,
        CONSTRAINT "FK_task_pull_requests_reviewer"
          FOREIGN KEY ("reviewer_hollon_id")
          REFERENCES "hollons"("id")
          ON DELETE SET NULL
      );
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_task_pull_requests_task"
      ON "task_pull_requests" ("task_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_task_pull_requests_status"
      ON "task_pull_requests" ("status");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_task_pull_requests_author"
      ON "task_pull_requests" ("author_hollon_id");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_task_pull_requests_reviewer"
      ON "task_pull_requests" ("reviewer_hollon_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_task_pull_requests_reviewer"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_task_pull_requests_author"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_task_pull_requests_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_task_pull_requests_task"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_collaboration_sessions_task"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_collaboration_sessions_collaborator_status"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_collaboration_sessions_requester_status"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "task_pull_requests"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "collaboration_sessions"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "reviewer_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "pr_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "collaboration_status_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "collaboration_type_enum"`);
  }
}
