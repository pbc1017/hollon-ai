import { MigrationInterface, QueryRunner } from 'typeorm';

export class InitialSchema1733295000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    /**
     * Enable pgvector extension for vector similarity search
     *
     * pgvector provides vector data types and similarity search operators for PostgreSQL.
     * This enables semantic search, knowledge retrieval, and AI-powered features.
     *
     * Features:
     * - Vector data types: vector(n), halfvec(n), bit(n), sparsevec(n)
     * - Distance operators: <=> (cosine), <-> (L2), <#> (inner product)
     * - Index types: HNSW (fast queries), IVFFlat (fast builds)
     *
     * Version: 0.8.1+ recommended for iterative index scans and improved filtering
     * Documentation: https://github.com/pgvector/pgvector
     */
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS vector`);

    // Organizations table
    await queryRunner.query(`
      CREATE TABLE "organizations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "description" text,
        "settings" jsonb DEFAULT '{}',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);

    // Brain Provider Configs table
    await queryRunner.query(`
      CREATE TABLE "brain_provider_configs" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "provider_id" varchar(50) NOT NULL,
        "display_name" varchar(255) NOT NULL,
        "config" jsonb NOT NULL,
        "cost_per_input_token_cents" decimal(10,6) NOT NULL,
        "cost_per_output_token_cents" decimal(10,6) NOT NULL,
        "enabled" boolean NOT NULL DEFAULT true,
        "timeout_seconds" integer NOT NULL DEFAULT 300,
        "max_retries" integer NOT NULL DEFAULT 3,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_brain_provider_org_provider" ON "brain_provider_configs" ("organization_id", "provider_id")`,
    );

    // Roles table
    await queryRunner.query(`
      CREATE TABLE "roles" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "system_prompt" text,
        "capabilities" jsonb DEFAULT '[]',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_roles_organization" ON "roles" ("organization_id")`,
    );

    // Teams table
    await queryRunner.query(`
      CREATE TABLE "teams" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "team_prompt" text,
        "leader_hollon_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_teams_organization" ON "teams" ("organization_id")`,
    );

    // Hollons table
    await queryRunner.query(`
      CREATE TYPE "hollon_status_enum" AS ENUM ('idle', 'working', 'blocked', 'reviewing', 'offline');

      CREATE TABLE "hollons" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" varchar(255) NOT NULL,
        "status" hollon_status_enum NOT NULL DEFAULT 'idle',
        "organization_id" uuid NOT NULL,
        "team_id" uuid,
        "role_id" uuid NOT NULL,
        "brain_provider_id" varchar(50) NOT NULL DEFAULT 'claude_code',
        "system_prompt" text,
        "max_concurrent_tasks" integer NOT NULL DEFAULT 1,
        "tasks_completed" integer NOT NULL DEFAULT 0,
        "average_task_duration" float,
        "success_rate" float,
        "last_active_at" timestamp,
        "current_task_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_hollons_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_hollons_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_hollons_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_hollons_org_status" ON "hollons" ("organization_id", "status")`,
    );

    // Projects table
    await queryRunner.query(`
      CREATE TYPE "project_status_enum" AS ENUM ('planning', 'active', 'on_hold', 'completed', 'archived');

      CREATE TABLE "projects" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "name" varchar(255) NOT NULL,
        "description" text,
        "repository_url" varchar(500),
        "working_directory" varchar(500),
        "status" project_status_enum NOT NULL DEFAULT 'planning',
        "metadata" jsonb DEFAULT '{}',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_projects_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_projects_organization" ON "projects" ("organization_id")`,
    );

    // Tasks table
    await queryRunner.query(`
      CREATE TYPE "task_status_enum" AS ENUM ('todo', 'in_progress', 'blocked', 'review', 'done', 'cancelled');
      CREATE TYPE "task_priority_enum" AS ENUM ('low', 'medium', 'high', 'urgent');

      CREATE TABLE "tasks" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "project_id" uuid NOT NULL,
        "parent_task_id" uuid,
        "assigned_hollon_id" uuid,
        "creator_hollon_id" uuid,
        "title" varchar(500) NOT NULL,
        "description" text,
        "status" task_status_enum NOT NULL DEFAULT 'todo',
        "priority" task_priority_enum NOT NULL DEFAULT 'medium',
        "depth" integer NOT NULL DEFAULT 0,
        "affected_files" jsonb DEFAULT '[]',
        "estimated_complexity" integer,
        "retry_count" integer NOT NULL DEFAULT 0,
        "max_retries" integer NOT NULL DEFAULT 3,
        "blocked_reason" text,
        "result" text,
        "started_at" timestamp,
        "completed_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_tasks_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tasks_parent" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_tasks_assigned_hollon" FOREIGN KEY ("assigned_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_tasks_creator_hollon" FOREIGN KEY ("creator_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_project_status" ON "tasks" ("project_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_assigned_hollon" ON "tasks" ("assigned_hollon_id")`,
    );

    /**
     * Documents table (Memory/Knowledge Base)
     *
     * Stores organizational documents, memories, decisions, and outputs with support
     * for vector embeddings to enable semantic search and knowledge retrieval.
     *
     * Key Features:
     * - Vector embeddings: 1536-dimensional vectors for semantic search
     * - Compatible with OpenAI text-embedding-ada-002 and text-embedding-3-small
     * - JSONB metadata: Flexible storage for custom properties
     * - Multiple document types: memory, decision, output, context
     *
     * Vector Column:
     * - Type: vector(1536)
     * - Storage: ~6 KB per embedding (4 bytes per dimension)
     * - Nullable: Yes (allows documents without embeddings)
     * - Index: Should be added separately via HNSW or IVFFlat when data volume grows
     */
    await queryRunner.query(`
      CREATE TYPE "document_type_enum" AS ENUM ('memory', 'decision', 'output', 'context');

      CREATE TABLE "documents" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "project_id" uuid,
        "task_id" uuid,
        "hollon_id" uuid,
        "title" varchar(500) NOT NULL,
        "content" text NOT NULL,
        "type" document_type_enum NOT NULL DEFAULT 'memory',
        "keywords" jsonb DEFAULT '[]',
        "embedding" vector(1536),  -- Vector embedding for semantic search
        "metadata" jsonb DEFAULT '{}',
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_documents_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_documents_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_documents_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_documents_hollon" FOREIGN KEY ("hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_documents_organization" ON "documents" ("organization_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_documents_project" ON "documents" ("project_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_documents_task" ON "documents" ("task_id")`,
    );

    // Cost Records table
    await queryRunner.query(`
      CREATE TYPE "cost_record_type_enum" AS ENUM ('brain_execution', 'task_analysis', 'quality_check', 'other');

      CREATE TABLE "cost_records" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "hollon_id" uuid,
        "task_id" uuid,
        "type" cost_record_type_enum NOT NULL DEFAULT 'brain_execution',
        "provider_id" varchar(50) NOT NULL,
        "model_used" varchar(100),
        "input_tokens" integer NOT NULL DEFAULT 0,
        "output_tokens" integer NOT NULL DEFAULT 0,
        "cost_cents" decimal(10,4) NOT NULL,
        "execution_time_ms" integer,
        "metadata" text,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_cost_records_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_cost_records_hollon" FOREIGN KEY ("hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_cost_records_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_cost_records_org_created" ON "cost_records" ("organization_id", "created_at")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cost_records_task" ON "cost_records" ("task_id")`,
    );

    // Approval Requests table
    await queryRunner.query(`
      CREATE TYPE "approval_status_enum" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');
      CREATE TYPE "approval_type_enum" AS ENUM ('cost_override', 'task_complexity', 'quality_issue', 'escalation_l5', 'other');

      CREATE TABLE "approval_requests" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "hollon_id" uuid,
        "task_id" uuid,
        "type" approval_type_enum NOT NULL DEFAULT 'other',
        "status" approval_status_enum NOT NULL DEFAULT 'pending',
        "title" varchar(500) NOT NULL,
        "description" text NOT NULL,
        "context" jsonb,
        "requested_by_hollon_id" uuid,
        "reviewed_by_user_id" uuid,
        "reviewed_at" timestamp,
        "review_comment" text,
        "escalation_level" integer NOT NULL DEFAULT 5,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_approval_requests_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_approval_requests_hollon" FOREIGN KEY ("hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL,
        CONSTRAINT "FK_approval_requests_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_approval_requests_requester" FOREIGN KEY ("requested_by_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_approval_requests_org_status" ON "approval_requests" ("organization_id", "status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_approval_requests_task" ON "approval_requests" ("task_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    /**
     * Rollback Migration
     *
     * WARNING: This will drop all tables and the pgvector extension.
     * All data will be lost, including vector embeddings.
     *
     * Rollback order:
     * 1. Drop tables in reverse dependency order
     * 2. Drop enum types
     * 3. Drop pgvector extension
     *
     * Best Practice: Create a backup before running rollback in production
     */
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE IF EXISTS "approval_requests"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "approval_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "approval_status_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "cost_records"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "cost_record_type_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "documents"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "document_type_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "tasks"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "task_priority_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "task_status_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "projects"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "project_status_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "hollons"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "hollon_status_enum"`);

    await queryRunner.query(`DROP TABLE IF EXISTS "teams"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "roles"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "brain_provider_configs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "organizations"`);

    /**
     * Drop pgvector extension
     *
     * Note: Extension can remain installed if other databases use it.
     * The extension is schema-scoped and won't affect other databases.
     */
    await queryRunner.query(`DROP EXTENSION IF EXISTS vector`);
  }
}
