import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateKnowledgeItem1767718321607 implements MigrationInterface {
  name = 'CreateKnowledgeItem1767718321607';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_documents_team_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_documents_hollon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_documents_task"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_documents_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_documents_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" DROP CONSTRAINT "goal_progress_records_recorded_by_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" DROP CONSTRAINT "goal_progress_records_goal_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "goals_created_by_hollon_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "goals_owner_hollon_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "goals_parent_goal_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "goals_team_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "goals_organization_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_assigned_team"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "projects_goal_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_projects_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" DROP CONSTRAINT "FK_cycles_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_reviewer_hollon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_assigned_team"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "tasks_organization_id_fkey"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_cycle"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_creator_hollon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_assigned_hollon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_parent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_tasks_project"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" DROP CONSTRAINT "FK_hollons_manager"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" DROP CONSTRAINT "FK_hollons_role"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" DROP CONSTRAINT "FK_hollons_team"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" DROP CONSTRAINT "FK_hollons_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_manager_hollon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_leader_hollon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP CONSTRAINT "FK_teams_parent_team"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_conversations_last_message"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_messages_conversation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_messages_replied_to"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_history" DROP CONSTRAINT "FK_conversation_history_message"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_history" DROP CONSTRAINT "FK_conversation_history_conversation"`,
    );
    await queryRunner.query(
      `ALTER TABLE "meeting_records" DROP CONSTRAINT "FK_meeting_records_team"`,
    );
    await queryRunner.query(
      `ALTER TABLE "meeting_records" DROP CONSTRAINT "FK_meeting_records_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_items" DROP CONSTRAINT "FK_knowledge_items_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" DROP CONSTRAINT "FK_knowledge_task"`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" DROP CONSTRAINT "FK_knowledge_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" DROP CONSTRAINT "FK_incidents_owner_hollon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" DROP CONSTRAINT "FK_incidents_reporter_hollon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP CONSTRAINT "FK_cross_team_contracts_target_team"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP CONSTRAINT "FK_cross_team_contracts_requester_team"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" DROP CONSTRAINT "FK_cost_records_task"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" DROP CONSTRAINT "FK_cost_records_hollon"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" DROP CONSTRAINT "FK_cost_records_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" DROP CONSTRAINT "FK_task_pull_requests_reviewer"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" DROP CONSTRAINT "FK_task_pull_requests_author"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" DROP CONSTRAINT "FK_task_pull_requests_task"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" DROP CONSTRAINT "FK_collaboration_sessions_task"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" DROP CONSTRAINT "FK_collaboration_sessions_collaborator"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" DROP CONSTRAINT "FK_collaboration_sessions_requester"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" DROP CONSTRAINT "FK_channels_team"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" DROP CONSTRAINT "FK_channels_organization"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_messages" DROP CONSTRAINT "FK_channel_messages_thread_parent"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_messages" DROP CONSTRAINT "FK_channel_messages_channel"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" DROP CONSTRAINT "FK_channel_memberships_channel"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" DROP CONSTRAINT "FK_task_dependencies_depends_on"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" DROP CONSTRAINT "FK_task_dependencies_task"`,
    );
    await queryRunner.query(`DROP INDEX "hollon"."IDX_roles_organization"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_roles_temporary_available"`,
    );
    await queryRunner.query(`DROP INDEX "hollon"."IDX_documents_team_id"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_documents_organization"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_documents_project"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_documents_task"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_goal_progress_goal"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_goal_progress_date"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_goals_org"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_goals_team"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_goals_parent"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_goals_status"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_goals_owner"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_goals_auto_generated"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."idx_projects_assigned_team_id"`,
    );
    await queryRunner.query(`DROP INDEX "hollon"."IDX_projects_organization"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_projects_goal"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_cycles_project"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_cycles_status"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_cycles_project_status"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_tasks_assigned_hollon"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_tasks_cycle"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_tasks_project_status"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_tasks_status_priority"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_tasks_assigned_hollon_status"`,
    );
    await queryRunner.query(`DROP INDEX "hollon"."idx_tasks_organization"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_tasks_project"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_tasks_required_skills"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."idx_tasks_needs_human_approval"`,
    );
    await queryRunner.query(`DROP INDEX "hollon"."IDX_tasks_blocked_until"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_tasks_assigned_team_id"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_tasks_depth"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_tasks_review_status"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_tasks_reviewer_hollon_status"`,
    );
    await queryRunner.query(`DROP INDEX "hollon"."IDX_hollons_org_status"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_hollons_expires_at"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_hollons_manager_id"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."idx_hollons_experience_level"`,
    );
    await queryRunner.query(`DROP INDEX "hollon"."IDX_teams_organization"`);
    await queryRunner.query(`DROP INDEX "hollon"."idx_teams_leader_hollon_id"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."idx_teams_manager_hollon_id"`,
    );
    await queryRunner.query(`DROP INDEX "hollon"."idx_teams_parent_team_id"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_conversations_participant1"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_conversations_participant2"`,
    );
    await queryRunner.query(`DROP INDEX "hollon"."IDX_conversations_context"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_messages_to"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_messages_from"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_messages_unread"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_messages_conversation"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_conversation_history_conversation"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_meeting_records_organization"`,
    );
    await queryRunner.query(`DROP INDEX "hollon"."IDX_meeting_records_team"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_meeting_records_type_date"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."idx_knowledge_items_organization_id"`,
    );
    await queryRunner.query(`DROP INDEX "hollon"."idx_knowledge_items_source"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."idx_knowledge_items_extracted_at"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_knowledge_organization_type"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_knowledge_type_created_at"`,
    );
    await queryRunner.query(`DROP INDEX "hollon"."IDX_knowledge_source_task"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_incidents_organization_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_incidents_severity_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_approval_requests_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_cross_team_contracts_requester_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_cross_team_contracts_target_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_cost_records_org_created"`,
    );
    await queryRunner.query(`DROP INDEX "hollon"."IDX_cost_records_task"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_conflict_resolutions_organization_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_conflict_resolutions_type_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_task_pull_requests_task"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_task_pull_requests_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_task_pull_requests_author"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_task_pull_requests_reviewer"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_collaboration_sessions_requester_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_collaboration_sessions_collaborator_status"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_collaboration_sessions_task"`,
    );
    await queryRunner.query(`DROP INDEX "hollon"."IDX_channels_organization"`);
    await queryRunner.query(`DROP INDEX "hollon"."IDX_channels_team"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_channel_messages_channel"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_channel_messages_thread"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_channel_memberships_channel"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_channel_memberships_member"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_brain_provider_org_provider"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_task_dependencies_task_id"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_task_dependencies_depends_on_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "goals_goal_type_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "goals_status_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "goals_progress_percent_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "goals_priority_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "goals_metric_type_check"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "CHK_tasks_assignment_xor"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" DROP CONSTRAINT "UQ_cycles_project_number"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "UQ_conversations_participants"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" DROP CONSTRAINT "UQ_channel_memberships_member"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" RENAME COLUMN "keywords" TO "embedding"`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_items" RENAME COLUMN "source" TO "type"`,
    );
    await queryRunner.query(`COMMENT ON TABLE "knowledge_items" IS NULL`);
    await queryRunner.query(
      `CREATE TYPE "hollon"."vector_embeddings_source_type_enum" AS ENUM('document', 'task', 'message', 'knowledge_item', 'code_snippet', 'decision_log', 'meeting_record', 'graph_node', 'custom')`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."vector_embeddings_model_type_enum" AS ENUM('openai_ada_002', 'openai_small_3', 'openai_large_3', 'cohere_english_v3', 'custom')`,
    );
    await queryRunner.query(
      `CREATE TABLE "vector_embeddings" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "embedding" text NOT NULL, "source_type" "hollon"."vector_embeddings_source_type_enum" NOT NULL, "source_id" uuid NOT NULL, "model_type" "hollon"."vector_embeddings_model_type_enum" NOT NULL DEFAULT 'openai_ada_002', "dimensions" integer NOT NULL, "content" text, "metadata" jsonb, "tags" text array, "organization_id" uuid NOT NULL, "project_id" uuid, "team_id" uuid, "hollon_id" uuid, CONSTRAINT "PK_b42dabe33bbb7b2aca4426e6e08" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_abbfde60a0f82e46533db64445" ON "vector_embeddings" ("tags") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_d32f506e6d7b769b16436ef3c8" ON "vector_embeddings" ("hollon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_94f321e6925ea0c72ed9e6463c" ON "vector_embeddings" ("team_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7a2c465c2fc3c34b1acafaba09" ON "vector_embeddings" ("project_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_be917cb7b349044bae5bcd5e10" ON "vector_embeddings" ("model_type", "dimensions") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_82165fae4d483ef9bc2e7cf1cd" ON "vector_embeddings" ("source_type", "source_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1a1c0c4a16d0b6327ebe2b5c35" ON "vector_embeddings" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."tech_debts_category_enum" AS ENUM('code_quality', 'architecture', 'documentation', 'testing', 'performance', 'security', 'dependency', 'other')`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."tech_debts_severity_enum" AS ENUM('low', 'medium', 'high', 'critical')`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."tech_debts_status_enum" AS ENUM('identified', 'acknowledged', 'planned', 'in_progress', 'resolved', 'wont_fix')`,
    );
    await queryRunner.query(
      `CREATE TABLE "tech_debts" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "title" character varying(255) NOT NULL, "description" text NOT NULL, "category" "hollon"."tech_debts_category_enum" NOT NULL DEFAULT 'code_quality', "severity" "hollon"."tech_debts_severity_enum" NOT NULL DEFAULT 'medium', "status" "hollon"."tech_debts_status_enum" NOT NULL DEFAULT 'identified', "project_id" uuid NOT NULL, "task_id" uuid, "affected_files" text array NOT NULL DEFAULT '{}', "estimated_effort_hours" integer, "detected_by" character varying(100), "metadata" jsonb, "resolved_at" TIMESTAMP, "resolution_notes" text, CONSTRAINT "PK_9f99c0f4b9fd85dd6f11c7cf461" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_f1e17c7a70f0b085dfa5c8401f" ON "tech_debts" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_6bbf8a3f9a0fbfc52543c72add" ON "tech_debts" ("severity", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1ad4fe841737bf94133e2ba4f3" ON "tech_debts" ("project_id", "status") `,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."knowledge_graph_edges_type_enum" AS ENUM('created_by', 'belongs_to', 'manages', 'collaborates_with', 'depends_on', 'references', 'implements', 'derives_from', 'related_to', 'child_of', 'part_of', 'custom')`,
    );
    await queryRunner.query(
      `CREATE TABLE "knowledge_graph_edges" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "source_node_id" uuid NOT NULL, "target_node_id" uuid NOT NULL, "type" "hollon"."knowledge_graph_edges_type_enum" NOT NULL DEFAULT 'related_to', "organization_id" uuid NOT NULL, "weight" double precision NOT NULL DEFAULT '1', "properties" jsonb NOT NULL DEFAULT '{}', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_42bd671d1559211b4f2254c81f9" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_14b4298254590f991a9889d5ef" ON "knowledge_graph_edges" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ea53e50cff6b3c75ed33aacaa4" ON "knowledge_graph_edges" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_daa6b46c39b209ebb55a8414dc" ON "knowledge_graph_edges" ("target_node_id", "type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e18f64ebe58a067c200a8035a5" ON "knowledge_graph_edges" ("source_node_id", "type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e584786864b43b5f20b010d7de" ON "knowledge_graph_edges" ("source_node_id", "target_node_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_0ee18e7912248113e7a73a1090" ON "knowledge_graph_edges" ("type") `,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."knowledge_graph_nodes_type_enum" AS ENUM('person', 'organization', 'team', 'task', 'document', 'code', 'concept', 'goal', 'skill', 'tool', 'custom')`,
    );
    await queryRunner.query(
      `CREATE TABLE "knowledge_graph_nodes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "created_at" TIMESTAMP NOT NULL DEFAULT now(), "updated_at" TIMESTAMP NOT NULL DEFAULT now(), "name" character varying(255) NOT NULL, "type" "hollon"."knowledge_graph_nodes_type_enum" NOT NULL DEFAULT 'custom', "description" text, "organization_id" uuid NOT NULL, "properties" jsonb NOT NULL DEFAULT '{}', "tags" text array NOT NULL DEFAULT '{}', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_8be2a93b41c3b570d8c3ab94a50" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_791a699bc5c7fe4a37b4e36103" ON "knowledge_graph_nodes" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ddb86fe90c0b9cd501fe79338b" ON "knowledge_graph_nodes" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_68e270a878808d5dcae2fc0de9" ON "knowledge_graph_nodes" ("type") `,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "max_retries"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "result"`);
    await queryRunner.query(`ALTER TABLE "hollons" DROP COLUMN "expires_at"`);
    await queryRunner.query(`ALTER TABLE "teams" DROP COLUMN "team_prompt"`);
    await queryRunner.query(
      `ALTER TABLE "knowledge" DROP COLUMN "organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" DROP COLUMN "source_task_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" DROP COLUMN "version_number"`,
    );
    await queryRunner.query(`ALTER TABLE "knowledge" DROP COLUMN "is_latest"`);
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "request_type"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."approval_request_type_enum"`);
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "metadata"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "approved_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "rejected_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "requested_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "approved_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "rejected_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "rejection_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" DROP COLUMN "affected_task_ids"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" DROP COLUMN "affected_hollon_ids"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" DROP COLUMN "conflict_context"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" ADD "source" character varying(255) NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "incidents" ADD "postmortem" jsonb`);
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "organization_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "hollon_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "task_id" uuid`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."approval_requests_type_enum" AS ENUM('cost_override', 'task_complexity', 'quality_issue', 'escalation_l5', 'other')`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "type" "hollon"."approval_requests_type_enum" NOT NULL DEFAULT 'other'`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "title" character varying(500) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "context" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "requested_by_hollon_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "reviewed_by_user_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "reviewed_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "review_comment" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "escalation_level" integer NOT NULL DEFAULT '5'`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD "title" character varying(255) NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."cross_team_contracts_priority_enum" AS ENUM('critical', 'high', 'medium', 'low')`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD "priority" "hollon"."cross_team_contracts_priority_enum" NOT NULL DEFAULT 'medium'`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD "accepted_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD "rejected_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD "completed_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD "cancelled_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD "accepted_by_hollon_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD "rejected_by_hollon_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD "rejection_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD "cancellation_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD "delivered_items" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD "feedback" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ADD "affectedTaskIds" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ADD "affectedHollonIds" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ADD "conflictContext" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."approval_requests_request_type_enum" AS ENUM('create_permanent_hollon', 'delete_permanent_hollon', 'escalation', 'incident_resolution')`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "request_type" "hollon"."approval_requests_request_type_enum" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "metadata" jsonb NOT NULL DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "requested_by" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "approved_by" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "approved_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "rejected_by" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "rejected_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "rejection_reason" text`,
    );
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "name"`);
    await queryRunner.query(
      `ALTER TABLE "roles" ADD "name" character varying(100) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" ALTER COLUMN "capabilities" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" ALTER COLUMN "available_for_temporary_hollon" SET NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "title"`);
    await queryRunner.query(
      `ALTER TABLE "documents" ADD "title" character varying(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."document_type_enum" RENAME TO "document_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."documents_type_enum" AS ENUM('task_context', 'decision_log', 'knowledge', 'discussion', 'code_review')`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "type" TYPE "hollon"."documents_type_enum" USING "type"::"text"::"hollon"."documents_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "type" SET DEFAULT 'knowledge'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."document_type_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "metadata" DROP DEFAULT`,
    );
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "embedding"`);
    await queryRunner.query(`ALTER TABLE "documents" ADD "embedding" text`);
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" ALTER COLUMN "recorded_at" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" ALTER COLUMN "recorded_at" SET DEFAULT NOW()`,
    );
    await queryRunner.query(`ALTER TABLE "goals" DROP COLUMN "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "goals" ADD "created_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "goals" DROP COLUMN "updated_at"`);
    await queryRunner.query(
      `ALTER TABLE "goals" ADD "updated_at" TIMESTAMP NOT NULL DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ALTER COLUMN "progress_percent" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ALTER COLUMN "progress_percent" SET DEFAULT '0'`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ALTER COLUMN "priority" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ALTER COLUMN "current_value" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ALTER COLUMN "success_criteria" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ALTER COLUMN "auto_decomposed" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ALTER COLUMN "auto_generated" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."project_status_enum" RENAME TO "project_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."projects_status_enum" AS ENUM('active', 'paused', 'completed', 'archived')`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ALTER COLUMN "status" TYPE "hollon"."projects_status_enum" USING "status"::"text"::"hollon"."projects_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'active'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."project_status_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "cycles" ALTER COLUMN "actual_cost_cents" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."cycle_status_enum" RENAME TO "cycle_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."cycles_status_enum" AS ENUM('upcoming', 'active', 'completed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" ALTER COLUMN "status" TYPE "hollon"."cycles_status_enum" USING "status"::"text"::"hollon"."cycles_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" ALTER COLUMN "status" SET DEFAULT 'upcoming'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."cycle_status_enum_old"`);
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "title"`);
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "title" character varying(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "description" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."task_type_enum" RENAME TO "task_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."tasks_type_enum" AS ENUM('team_epic', 'planning', 'analysis', 'implementation', 'review', 'research', 'bug_fix', 'documentation', 'discussion')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "type" TYPE "hollon"."tasks_type_enum" USING "type"::"text"::"hollon"."tasks_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "type" SET DEFAULT 'implementation'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."task_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."task_status_enum" RENAME TO "task_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."tasks_status_enum" AS ENUM('pending', 'ready', 'in_progress', 'ready_for_review', 'in_review', 'blocked', 'waiting_for_hollon', 'completed', 'failed', 'cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "status" TYPE "hollon"."tasks_status_enum" USING "status"::"text"::"hollon"."tasks_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."task_status_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."task_priority_enum" RENAME TO "task_priority_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."tasks_priority_enum" AS ENUM('P1', 'P2', 'P3', 'P4')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "priority" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "priority" TYPE "hollon"."tasks_priority_enum" USING "priority"::"text"::"hollon"."tasks_priority_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "priority" SET DEFAULT 'P3'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."task_priority_enum_old"`);
    await queryRunner.query(
      `COMMENT ON COLUMN "tasks"."assigned_team_id" IS NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "tasks"."depth" IS NULL`);
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "affected_files" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "required_skills" SET NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "tasks"."required_skills" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "needs_human_approval" SET NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "tasks"."needs_human_approval" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "tasks"."working_directory" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."hollon_status_enum" RENAME TO "hollon_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."hollons_status_enum" AS ENUM('idle', 'working', 'blocked', 'reviewing', 'paused', 'error', 'offline')`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "status" TYPE "hollon"."hollons_status_enum" USING "status"::"text"::"hollon"."hollons_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "status" SET DEFAULT 'idle'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."hollon_status_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."hollon_lifecycle_enum" RENAME TO "hollon_lifecycle_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."hollons_lifecycle_enum" AS ENUM('permanent', 'temporary')`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "lifecycle" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "lifecycle" TYPE "hollon"."hollons_lifecycle_enum" USING "lifecycle"::"text"::"hollon"."hollons_lifecycle_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "lifecycle" SET DEFAULT 'permanent'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."hollon_lifecycle_enum_old"`);
    await queryRunner.query(`COMMENT ON COLUMN "hollons"."depth" IS NULL`);
    await queryRunner.query(`COMMENT ON COLUMN "hollons"."manager_id" IS NULL`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."experience_level_enum" RENAME TO "experience_level_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."hollons_experience_level_enum" AS ENUM('junior', 'mid', 'senior', 'lead', 'principal')`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "experience_level" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "experience_level" TYPE "hollon"."hollons_experience_level_enum" USING "experience_level"::"text"::"hollon"."hollons_experience_level_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "experience_level" SET DEFAULT 'mid'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."experience_level_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "experience_level" SET NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "hollons"."experience_level" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "teams"."manager_hollon_id" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "organizations"."context_prompt" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."participant_type_enum" RENAME TO "participant_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."conversations_participant1_type_enum" AS ENUM('hollon', 'human', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "participant1_type" TYPE "hollon"."conversations_participant1_type_enum" USING "participant1_type"::"text"::"hollon"."conversations_participant1_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."participant_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."participant_type_enum" RENAME TO "participant_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."conversations_participant2_type_enum" AS ENUM('hollon', 'human', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "participant2_type" TYPE "hollon"."conversations_participant2_type_enum" USING "participant2_type"::"text"::"hollon"."conversations_participant2_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."participant_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."conversation_context_enum" RENAME TO "conversation_context_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."conversations_context_enum" AS ENUM('task', 'collaboration', 'escalation', 'review', 'general')`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "context" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "context" TYPE "hollon"."conversations_context_enum" USING "context"::"text"::"hollon"."conversations_context_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "context" SET DEFAULT 'general'`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."conversation_context_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "conversation_id" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."participant_type_enum" RENAME TO "participant_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."messages_from_type_enum" AS ENUM('hollon', 'human', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "from_type" TYPE "hollon"."messages_from_type_enum" USING "from_type"::"text"::"hollon"."messages_from_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."participant_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."participant_type_enum" RENAME TO "participant_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."messages_to_type_enum" AS ENUM('hollon', 'human', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "to_type" TYPE "hollon"."messages_to_type_enum" USING "to_type"::"text"::"hollon"."messages_to_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."participant_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."message_type_enum" RENAME TO "message_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."messages_message_type_enum" AS ENUM('task_assignment', 'task_update', 'task_completion', 'question', 'response', 'delegation_request', 'delegation_approval', 'collaboration_request', 'review_request', 'conflict_notification', 'general')`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "message_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "message_type" TYPE "hollon"."messages_message_type_enum" USING "message_type"::"text"::"hollon"."messages_message_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "message_type" SET DEFAULT 'general'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."message_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."message_priority_enum" RENAME TO "message_priority_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."messages_priority_enum" AS ENUM('low', 'normal', 'high', 'urgent')`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "priority" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "priority" TYPE "hollon"."messages_priority_enum" USING "priority"::"text"::"hollon"."messages_priority_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "priority" SET DEFAULT 'normal'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."message_priority_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "metadata" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."meeting_type_enum" RENAME TO "meeting_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."meeting_records_meeting_type_enum" AS ENUM('standup', 'sprint_planning', 'retrospective', 'tech_debt_review', 'ad_hoc')`,
    );
    await queryRunner.query(
      `ALTER TABLE "meeting_records" ALTER COLUMN "meeting_type" TYPE "hollon"."meeting_records_meeting_type_enum" USING "meeting_type"::"text"::"hollon"."meeting_records_meeting_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."meeting_type_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "meeting_records" ALTER COLUMN "metadata" SET NOT NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "knowledge_items"."type" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "knowledge_items"."content" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "knowledge_items"."metadata" IS NULL`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "knowledge_items"."extracted_at" IS NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."knowledge_type_enum" RENAME TO "knowledge_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."knowledge_type_enum" AS ENUM('general', 'technical', 'business', 'process', 'documentation', 'insight', 'best_practice', 'lesson_learned')`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" ALTER COLUMN "type" TYPE "hollon"."knowledge_type_enum" USING "type"::"text"::"hollon"."knowledge_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" ALTER COLUMN "type" SET DEFAULT 'general'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."knowledge_type_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "knowledge" ALTER COLUMN "type" SET DEFAULT 'general'`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" ALTER COLUMN "metadata" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" DROP COLUMN "organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ADD "organization_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."incident_severity_enum" RENAME TO "incident_severity_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."incidents_severity_enum" AS ENUM('P1', 'P2', 'P3', 'P4')`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ALTER COLUMN "severity" TYPE "hollon"."incidents_severity_enum" USING "severity"::"text"::"hollon"."incidents_severity_enum"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."incident_severity_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."incident_status_enum" RENAME TO "incident_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."incidents_status_enum" AS ENUM('reported', 'investigating', 'identified', 'resolving', 'resolved', 'closed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ALTER COLUMN "status" TYPE "hollon"."incidents_status_enum" USING "status"::"text"::"hollon"."incidents_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ALTER COLUMN "status" SET DEFAULT 'reported'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."incident_status_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "incidents" ALTER COLUMN "impact" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ALTER COLUMN "timeline" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ALTER COLUMN "metadata" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."approval_status_enum" RENAME TO "approval_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."approval_requests_status_enum" AS ENUM('pending', 'approved', 'rejected', 'cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ALTER COLUMN "status" TYPE "hollon"."approval_requests_status_enum" USING "status"::"text"::"hollon"."approval_requests_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."approval_status_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ALTER COLUMN "deliverables" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."contract_status_enum" RENAME TO "contract_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."cross_team_contracts_status_enum" AS ENUM('pending', 'negotiating', 'accepted', 'in_progress', 'delivered', 'rejected', 'cancelled', 'completed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ALTER COLUMN "status" TYPE "hollon"."cross_team_contracts_status_enum" USING "status"::"text"::"hollon"."cross_team_contracts_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."contract_status_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ALTER COLUMN "metadata" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."cost_record_type_enum" RENAME TO "cost_record_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."cost_records_type_enum" AS ENUM('brain_execution', 'task_analysis', 'quality_check', 'other')`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" ALTER COLUMN "type" TYPE "hollon"."cost_records_type_enum" USING "type"::"text"::"hollon"."cost_records_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" ALTER COLUMN "type" SET DEFAULT 'brain_execution'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."cost_record_type_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" DROP COLUMN "organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ADD "organization_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."conflict_type_enum" RENAME TO "conflict_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."conflict_resolutions_conflict_type_enum" AS ENUM('file_conflict', 'resource_conflict', 'priority_conflict', 'deadline_conflict')`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ALTER COLUMN "conflict_type" TYPE "hollon"."conflict_resolutions_conflict_type_enum" USING "conflict_type"::"text"::"hollon"."conflict_resolutions_conflict_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."conflict_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."conflict_status_enum" RENAME TO "conflict_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."conflict_resolutions_status_enum" AS ENUM('detected', 'resolving', 'resolved', 'escalated')`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ALTER COLUMN "status" TYPE "hollon"."conflict_resolutions_status_enum" USING "status"::"text"::"hollon"."conflict_resolutions_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ALTER COLUMN "status" SET DEFAULT 'detected'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."conflict_status_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."resolution_strategy_enum" RENAME TO "resolution_strategy_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."conflict_resolutions_resolution_strategy_enum" AS ENUM('sequential_execution', 'resource_reallocation', 'priority_adjustment', 'deadline_extension', 'manual_intervention')`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ALTER COLUMN "resolution_strategy" TYPE "hollon"."conflict_resolutions_resolution_strategy_enum" USING "resolution_strategy"::"text"::"hollon"."conflict_resolutions_resolution_strategy_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."resolution_strategy_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ALTER COLUMN "metadata" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."pr_status_enum" RENAME TO "pr_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."task_pull_requests_status_enum" AS ENUM('draft', 'ready_for_review', 'changes_requested', 'approved', 'merged', 'closed')`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" ALTER COLUMN "status" TYPE "hollon"."task_pull_requests_status_enum" USING "status"::"text"::"hollon"."task_pull_requests_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" ALTER COLUMN "status" SET DEFAULT 'draft'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."pr_status_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."reviewer_type_enum" RENAME TO "reviewer_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."task_pull_requests_reviewer_type_enum" AS ENUM('team_member', 'team_manager', 'security_reviewer', 'architecture_reviewer', 'performance_reviewer', 'code_reviewer')`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" ALTER COLUMN "reviewer_type" TYPE "hollon"."task_pull_requests_reviewer_type_enum" USING "reviewer_type"::"text"::"hollon"."task_pull_requests_reviewer_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."reviewer_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."collaboration_type_enum" RENAME TO "collaboration_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."collaboration_sessions_type_enum" AS ENUM('pair_programming', 'code_review', 'knowledge_sharing', 'debugging', 'architecture_review')`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ALTER COLUMN "type" TYPE "hollon"."collaboration_sessions_type_enum" USING "type"::"text"::"hollon"."collaboration_sessions_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."collaboration_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."collaboration_status_enum" RENAME TO "collaboration_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."collaboration_sessions_status_enum" AS ENUM('pending', 'accepted', 'rejected', 'active', 'completed', 'cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ALTER COLUMN "status" TYPE "hollon"."collaboration_sessions_status_enum" USING "status"::"text"::"hollon"."collaboration_sessions_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."collaboration_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ALTER COLUMN "metadata" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."channel_type_enum" RENAME TO "channel_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."channels_channel_type_enum" AS ENUM('public', 'private', 'direct', 'group')`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" ALTER COLUMN "channel_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" ALTER COLUMN "channel_type" TYPE "hollon"."channels_channel_type_enum" USING "channel_type"::"text"::"hollon"."channels_channel_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" ALTER COLUMN "channel_type" SET DEFAULT 'public'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."channel_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."participant_type_enum" RENAME TO "participant_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."channels_created_by_type_enum" AS ENUM('hollon', 'human', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" ALTER COLUMN "created_by_type" TYPE "hollon"."channels_created_by_type_enum" USING "created_by_type"::"text"::"hollon"."channels_created_by_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."participant_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."participant_type_enum" RENAME TO "participant_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."channel_messages_sender_type_enum" AS ENUM('hollon', 'human', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_messages" ALTER COLUMN "sender_type" TYPE "hollon"."channel_messages_sender_type_enum" USING "sender_type"::"text"::"hollon"."channel_messages_sender_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."participant_type_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "channel_messages" ALTER COLUMN "metadata" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."participant_type_enum" RENAME TO "participant_type_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."channel_memberships_member_type_enum" AS ENUM('hollon', 'human', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" ALTER COLUMN "member_type" TYPE "hollon"."channel_memberships_member_type_enum" USING "member_type"::"text"::"hollon"."channel_memberships_member_type_enum"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."participant_type_enum_old"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."channel_role_enum" RENAME TO "channel_role_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."channel_memberships_role_enum" AS ENUM('owner', 'admin', 'member')`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" ALTER COLUMN "role" TYPE "hollon"."channel_memberships_role_enum" USING "role"::"text"::"hollon"."channel_memberships_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" ALTER COLUMN "role" SET DEFAULT 'member'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."channel_role_enum_old"`);
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" ALTER COLUMN "joined_at" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "brain_provider_configs" DROP COLUMN "organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "brain_provider_configs" ADD "organization_id" character varying NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."approval_status_enum" RENAME TO "approval_status_enum_old"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."approval_requests_status_enum" AS ENUM('pending', 'approved', 'rejected', 'cancelled')`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ALTER COLUMN "status" TYPE "hollon"."approval_requests_status_enum" USING "status"::"text"::"hollon"."approval_requests_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."approval_status_enum_old"`);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_roles_organization_name" ON "roles" ("organization_id", "name") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1b92824619a65e4dfe65bfd5da" ON "documents" ("tags") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_be513f617a218e2f0c515f7a1f" ON "documents" ("type", "organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_a5dc1c25ca5721db8fbbcc0ca9" ON "documents" ("hollon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e59c9e6988cf3ef1621430612a" ON "documents" ("project_id", "type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_69427761f37533ae7767601a64" ON "documents" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4362bbb0dd9d705ba27545bc08" ON "goal_progress_records" ("recorded_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_67e739e523b97ae9f66a803c3e" ON "goal_progress_records" ("goal_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_70983dbcf13f284110ffbca991" ON "goals" ("owner_hollon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e2afa3198d42a36e03b50ca1dd" ON "goals" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2d3938187992341cca444ced14" ON "goals" ("parent_goal_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_722fcbb0807108f33384bba330" ON "goals" ("team_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_5e729ea2b99fa87dc1bd8e6bbc" ON "goals" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_872e923b87368b91706f8f120c" ON "projects" ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c595689e38a9a2b69cdeeba1f4" ON "cycles" ("project_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b2955f55f48939ab154579a83d" ON "tasks" ("status", "priority") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_06799907f8713f1b279282a2fe" ON "tasks" ("assigned_hollon_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8d82387ba026be63046895fe37" ON "tasks" ("project_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_27c2b868de9f873e1a2c7ec981" ON "hollons" ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_74677aa380f53893e8f692881a" ON "conversations" ("participant2_type", "participant2_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_db216addaa251741196c8d0cda" ON "conversations" ("participant1_type", "participant1_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1562120ba46b2253448f5d57a7" ON "messages" ("to_type", "to_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_07e68775f5915a69382eaa4ee5" ON "messages" ("from_type", "from_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_8584a1974e1ca95f4861d975ff" ON "messages" ("conversation_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b5561b258df75f9a6465ed680c" ON "conversation_history" ("conversation_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_352dd3b71e64d65b01066e3b7b" ON "knowledge_items" ("extracted_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cc31f1fa8ed7d934fb930c50bc" ON "knowledge_items" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4da3fddd81fc89219b0b7809e7" ON "knowledge_items" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7e006a68721f51bca4d4916d0c" ON "knowledge" ("type", "source") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_4153dc77fff0993297c6a66c56" ON "knowledge" ("created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_86a8971c02b14662d560e2ef97" ON "knowledge" ("source") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cd593e58cc64b07e4038a7dce3" ON "knowledge" ("type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e2102fc64215f0a1fcb9ad4879" ON "incidents" ("severity", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2f9f3d7edbd918d5f4d9c69f49" ON "incidents" ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1922e3875ea5c9715d992e78a3" ON "approval_requests" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_c8756291cf76c9608f359ca51f" ON "approval_requests" ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1e55784cedcf2d5dbedd09dde5" ON "cross_team_contracts" ("requested_deadline") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b35bd433a263346eed8f97a692" ON "cross_team_contracts" ("status", "priority") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_7d38ef2e61c73f2bd8794a06b6" ON "cross_team_contracts" ("target_team_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_23a73bd1326c5e5378bf26a2dc" ON "cross_team_contracts" ("requester_team_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_bdf84b0636684edf30e857a312" ON "cost_records" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_687924be429d272f2be078944d" ON "cost_records" ("organization_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_815d22c37cef391a72b339f226" ON "conflict_resolutions" ("conflict_type", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_9c871bf7b85031b17c36ebcfab" ON "conflict_resolutions" ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3438e2c4be79302bee2f62b2bd" ON "task_pull_requests" ("reviewer_hollon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1be6b3e7283ba19a6b5ec63009" ON "task_pull_requests" ("author_hollon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_df04461db491ebe294723a196f" ON "task_pull_requests" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_afc8b8b94cec1244154022994a" ON "task_pull_requests" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_e9bf2ade6e5f19428ffe2ef9dd" ON "collaboration_sessions" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_3e72b3398d1b43f9fb19450d0c" ON "collaboration_sessions" ("collaborator_hollon_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_b055a42e05c2c128973f75f718" ON "collaboration_sessions" ("requester_hollon_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_2d9f1ef70e723df40f998c1dba" ON "brain_provider_configs" ("organization_id", "provider_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_1ae6688b1bd90fffe857f4cb70" ON "task_dependencies" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_00047fb689d1f72366034f138f" ON "task_dependencies" ("depends_on_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" ADD CONSTRAINT "CHK_6d57863c1151cf1bd394ae112a" CHECK ("status" IN ('upcoming', 'active', 'completed'))`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "CHK_a58061ea216daae95715c25999" CHECK ("depth" <= 3)`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" ADD CONSTRAINT "FK_c328a1ecd12a5f153a96df4509e" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_69427761f37533ae7767601a64b" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_e156b298c20873e14c362e789bf" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_a5dc1c25ca5721db8fbbcc0ca99" FOREIGN KEY ("hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" ADD CONSTRAINT "FK_67e739e523b97ae9f66a803c3eb" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" ADD CONSTRAINT "FK_cc72d9793af36085cfee26447f5" FOREIGN KEY ("recorded_by") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "FK_5e729ea2b99fa87dc1bd8e6bbc2" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "FK_722fcbb0807108f33384bba330f" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "FK_2d3938187992341cca444ced142" FOREIGN KEY ("parent_goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "FK_70983dbcf13f284110ffbca9910" FOREIGN KEY ("owner_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "FK_71226eeada81526df3c588ff750" FOREIGN KEY ("created_by_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_585c8ce06628c70b70100bfb842" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_4a99044c4dfc22f83a3a75f5cb3" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_639a23e0ef40e60bf1ad9fcb18d" FOREIGN KEY ("assigned_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" ADD CONSTRAINT "FK_f606dbaeac8fdca8371b01a0ef9" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_44a9b5209cdfd6f72fb09a7c994" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_9eecdb5b1ed8c7c2a1b392c28d4" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_20581c6f9b4c1ff349a758817d1" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_6a2f06cea68a86a19a31a2ed3d6" FOREIGN KEY ("assigned_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_262535d2a5bd45ade17fd4195f3" FOREIGN KEY ("assigned_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_54fc42a253a8338488ec1f960ad" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_0fc92f320a753fac019a9315cb5" FOREIGN KEY ("creator_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_0c1d0ec1b93cd23668a7e5ce328" FOREIGN KEY ("reviewer_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ADD CONSTRAINT "FK_f838ddca4ee93f40e779e78fb35" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ADD CONSTRAINT "FK_796bfb6d7972d6960794614a7dd" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ADD CONSTRAINT "FK_59797b31fdd7d4487988e670b35" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ADD CONSTRAINT "FK_5539d3b6215e1eccb1e544b3d37" FOREIGN KEY ("manager_id") REFERENCES "hollons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "FK_fdc736f761896ccc179c823a785" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "FK_321087929f90514584916446cfc" FOREIGN KEY ("parent_team_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "FK_36277c762be1431fcbf4c89330a" FOREIGN KEY ("leader_hollon_id") REFERENCES "hollons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "FK_d150ba1bdb9b4ecb36a666ee54c" FOREIGN KEY ("manager_hollon_id") REFERENCES "hollons"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vector_embeddings" ADD CONSTRAINT "FK_1a1c0c4a16d0b6327ebe2b5c354" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vector_embeddings" ADD CONSTRAINT "FK_7a2c465c2fc3c34b1acafaba09c" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vector_embeddings" ADD CONSTRAINT "FK_94f321e6925ea0c72ed9e6463c2" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vector_embeddings" ADD CONSTRAINT "FK_d32f506e6d7b769b16436ef3c8c" FOREIGN KEY ("hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tech_debts" ADD CONSTRAINT "FK_2927692fa03c5c5083642c97fc7" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tech_debts" ADD CONSTRAINT "FK_f1e17c7a70f0b085dfa5c8401f1" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_a53679287450d522a3f700088e9" FOREIGN KEY ("last_message_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_a9e5d06f1e2e8aafaefc3ff7a21" FOREIGN KEY ("replied_to_id") REFERENCES "messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_history" ADD CONSTRAINT "FK_1afbc437639f5c3a8c083a919d1" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_history" ADD CONSTRAINT "FK_2acb47a45e3aa9d2c20972b3e76" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "meeting_records" ADD CONSTRAINT "FK_d2d1b76c1bbf45d4e1c1e80bcd3" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "meeting_records" ADD CONSTRAINT "FK_aa871bdddcba77b41e994d91b1b" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_graph_edges" ADD CONSTRAINT "FK_0f514a4848a04b2b2e1026af26d" FOREIGN KEY ("source_node_id") REFERENCES "knowledge_graph_nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_graph_edges" ADD CONSTRAINT "FK_f33d5fafb295899847897c993ec" FOREIGN KEY ("target_node_id") REFERENCES "knowledge_graph_nodes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_items" ADD CONSTRAINT "FK_4da3fddd81fc89219b0b7809e7c" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ADD CONSTRAINT "FK_8f3fda4683b922181ae874833f4" FOREIGN KEY ("reporter_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ADD CONSTRAINT "FK_bdaa3ffec599fdb88d38c6b5e58" FOREIGN KEY ("owner_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD CONSTRAINT "FK_48206c45316b368509fa89b7bac" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD CONSTRAINT "FK_1e684f52e7073a5815bfae7ad9b" FOREIGN KEY ("hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD CONSTRAINT "FK_1922e3875ea5c9715d992e78a35" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD CONSTRAINT "FK_5eb105acdd6adcb0a09968d90a4" FOREIGN KEY ("requested_by_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD CONSTRAINT "FK_1597cc1e8e973453072785158da" FOREIGN KEY ("requester_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD CONSTRAINT "FK_4e7ec7423771d2923948b60453b" FOREIGN KEY ("target_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" ADD CONSTRAINT "FK_f1027a3c8b90c39c88afa345e60" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" ADD CONSTRAINT "FK_08b8b39f106bab4612d326a1836" FOREIGN KEY ("hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" ADD CONSTRAINT "FK_bdf84b0636684edf30e857a3129" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" ADD CONSTRAINT "FK_afc8b8b94cec1244154022994af" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" ADD CONSTRAINT "FK_1be6b3e7283ba19a6b5ec630091" FOREIGN KEY ("author_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" ADD CONSTRAINT "FK_3438e2c4be79302bee2f62b2bda" FOREIGN KEY ("reviewer_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ADD CONSTRAINT "FK_db300f3172259b6ffe350641bdf" FOREIGN KEY ("requester_hollon_id") REFERENCES "hollons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ADD CONSTRAINT "FK_21ab29eda34b27ddcde201af3f6" FOREIGN KEY ("collaborator_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ADD CONSTRAINT "FK_e9bf2ade6e5f19428ffe2ef9dd1" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" ADD CONSTRAINT "FK_dcb0c11359ece13fbbcd745c28b" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" ADD CONSTRAINT "FK_82ec8fc4ec07ccb4a35f8eb9abb" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_messages" ADD CONSTRAINT "FK_1fe2ce70d148150a26b64cf1cad" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_messages" ADD CONSTRAINT "FK_50e836cd424848f2038dc3a2917" FOREIGN KEY ("thread_parent_id") REFERENCES "channel_messages"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" ADD CONSTRAINT "FK_55e8a1e1691323b0075ac14f768" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_1ae6688b1bd90fffe857f4cb707" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_00047fb689d1f72366034f138f7" FOREIGN KEY ("depends_on_id") REFERENCES "tasks"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" DROP CONSTRAINT "FK_00047fb689d1f72366034f138f7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" DROP CONSTRAINT "FK_1ae6688b1bd90fffe857f4cb707"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" DROP CONSTRAINT "FK_55e8a1e1691323b0075ac14f768"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_messages" DROP CONSTRAINT "FK_50e836cd424848f2038dc3a2917"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_messages" DROP CONSTRAINT "FK_1fe2ce70d148150a26b64cf1cad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" DROP CONSTRAINT "FK_82ec8fc4ec07ccb4a35f8eb9abb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" DROP CONSTRAINT "FK_dcb0c11359ece13fbbcd745c28b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" DROP CONSTRAINT "FK_e9bf2ade6e5f19428ffe2ef9dd1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" DROP CONSTRAINT "FK_21ab29eda34b27ddcde201af3f6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" DROP CONSTRAINT "FK_db300f3172259b6ffe350641bdf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" DROP CONSTRAINT "FK_3438e2c4be79302bee2f62b2bda"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" DROP CONSTRAINT "FK_1be6b3e7283ba19a6b5ec630091"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" DROP CONSTRAINT "FK_afc8b8b94cec1244154022994af"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" DROP CONSTRAINT "FK_bdf84b0636684edf30e857a3129"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" DROP CONSTRAINT "FK_08b8b39f106bab4612d326a1836"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" DROP CONSTRAINT "FK_f1027a3c8b90c39c88afa345e60"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP CONSTRAINT "FK_4e7ec7423771d2923948b60453b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP CONSTRAINT "FK_1597cc1e8e973453072785158da"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP CONSTRAINT "FK_5eb105acdd6adcb0a09968d90a4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP CONSTRAINT "FK_1922e3875ea5c9715d992e78a35"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP CONSTRAINT "FK_1e684f52e7073a5815bfae7ad9b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP CONSTRAINT "FK_48206c45316b368509fa89b7bac"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" DROP CONSTRAINT "FK_bdaa3ffec599fdb88d38c6b5e58"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" DROP CONSTRAINT "FK_8f3fda4683b922181ae874833f4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_items" DROP CONSTRAINT "FK_4da3fddd81fc89219b0b7809e7c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_graph_edges" DROP CONSTRAINT "FK_f33d5fafb295899847897c993ec"`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_graph_edges" DROP CONSTRAINT "FK_0f514a4848a04b2b2e1026af26d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "meeting_records" DROP CONSTRAINT "FK_aa871bdddcba77b41e994d91b1b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "meeting_records" DROP CONSTRAINT "FK_d2d1b76c1bbf45d4e1c1e80bcd3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_history" DROP CONSTRAINT "FK_2acb47a45e3aa9d2c20972b3e76"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_history" DROP CONSTRAINT "FK_1afbc437639f5c3a8c083a919d1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_a9e5d06f1e2e8aafaefc3ff7a21"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" DROP CONSTRAINT "FK_3bc55a7c3f9ed54b520bb5cfe23"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" DROP CONSTRAINT "FK_a53679287450d522a3f700088e9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tech_debts" DROP CONSTRAINT "FK_f1e17c7a70f0b085dfa5c8401f1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tech_debts" DROP CONSTRAINT "FK_2927692fa03c5c5083642c97fc7"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vector_embeddings" DROP CONSTRAINT "FK_d32f506e6d7b769b16436ef3c8c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vector_embeddings" DROP CONSTRAINT "FK_94f321e6925ea0c72ed9e6463c2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vector_embeddings" DROP CONSTRAINT "FK_7a2c465c2fc3c34b1acafaba09c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "vector_embeddings" DROP CONSTRAINT "FK_1a1c0c4a16d0b6327ebe2b5c354"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP CONSTRAINT "FK_d150ba1bdb9b4ecb36a666ee54c"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP CONSTRAINT "FK_36277c762be1431fcbf4c89330a"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP CONSTRAINT "FK_321087929f90514584916446cfc"`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" DROP CONSTRAINT "FK_fdc736f761896ccc179c823a785"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" DROP CONSTRAINT "FK_5539d3b6215e1eccb1e544b3d37"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" DROP CONSTRAINT "FK_59797b31fdd7d4487988e670b35"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" DROP CONSTRAINT "FK_796bfb6d7972d6960794614a7dd"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" DROP CONSTRAINT "FK_f838ddca4ee93f40e779e78fb35"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_0c1d0ec1b93cd23668a7e5ce328"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_0fc92f320a753fac019a9315cb5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_54fc42a253a8338488ec1f960ad"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_262535d2a5bd45ade17fd4195f3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_6a2f06cea68a86a19a31a2ed3d6"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_20581c6f9b4c1ff349a758817d1"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_9eecdb5b1ed8c7c2a1b392c28d4"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "FK_44a9b5209cdfd6f72fb09a7c994"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" DROP CONSTRAINT "FK_f606dbaeac8fdca8371b01a0ef9"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_639a23e0ef40e60bf1ad9fcb18d"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_4a99044c4dfc22f83a3a75f5cb3"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" DROP CONSTRAINT "FK_585c8ce06628c70b70100bfb842"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "FK_71226eeada81526df3c588ff750"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "FK_70983dbcf13f284110ffbca9910"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "FK_2d3938187992341cca444ced142"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "FK_722fcbb0807108f33384bba330f"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" DROP CONSTRAINT "FK_5e729ea2b99fa87dc1bd8e6bbc2"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" DROP CONSTRAINT "FK_cc72d9793af36085cfee26447f5"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" DROP CONSTRAINT "FK_67e739e523b97ae9f66a803c3eb"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_a5dc1c25ca5721db8fbbcc0ca99"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_e156b298c20873e14c362e789bf"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" DROP CONSTRAINT "FK_69427761f37533ae7767601a64b"`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" DROP CONSTRAINT "FK_c328a1ecd12a5f153a96df4509e"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" DROP CONSTRAINT "CHK_a58061ea216daae95715c25999"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" DROP CONSTRAINT "CHK_6d57863c1151cf1bd394ae112a"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_00047fb689d1f72366034f138f"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_1ae6688b1bd90fffe857f4cb70"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_2d9f1ef70e723df40f998c1dba"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_b055a42e05c2c128973f75f718"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_3e72b3398d1b43f9fb19450d0c"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_e9bf2ade6e5f19428ffe2ef9dd"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_afc8b8b94cec1244154022994a"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_df04461db491ebe294723a196f"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_1be6b3e7283ba19a6b5ec63009"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_3438e2c4be79302bee2f62b2bd"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_9c871bf7b85031b17c36ebcfab"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_815d22c37cef391a72b339f226"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_687924be429d272f2be078944d"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_bdf84b0636684edf30e857a312"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_23a73bd1326c5e5378bf26a2dc"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_7d38ef2e61c73f2bd8794a06b6"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_b35bd433a263346eed8f97a692"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_1e55784cedcf2d5dbedd09dde5"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_c8756291cf76c9608f359ca51f"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_1922e3875ea5c9715d992e78a3"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_2f9f3d7edbd918d5f4d9c69f49"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_e2102fc64215f0a1fcb9ad4879"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_cd593e58cc64b07e4038a7dce3"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_86a8971c02b14662d560e2ef97"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_4153dc77fff0993297c6a66c56"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_7e006a68721f51bca4d4916d0c"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_4da3fddd81fc89219b0b7809e7"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_cc31f1fa8ed7d934fb930c50bc"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_352dd3b71e64d65b01066e3b7b"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_b5561b258df75f9a6465ed680c"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_8584a1974e1ca95f4861d975ff"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_07e68775f5915a69382eaa4ee5"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_1562120ba46b2253448f5d57a7"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_db216addaa251741196c8d0cda"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_74677aa380f53893e8f692881a"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_27c2b868de9f873e1a2c7ec981"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_8d82387ba026be63046895fe37"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_06799907f8713f1b279282a2fe"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_b2955f55f48939ab154579a83d"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_c595689e38a9a2b69cdeeba1f4"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_872e923b87368b91706f8f120c"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_5e729ea2b99fa87dc1bd8e6bbc"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_722fcbb0807108f33384bba330"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_2d3938187992341cca444ced14"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_e2afa3198d42a36e03b50ca1dd"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_70983dbcf13f284110ffbca991"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_67e739e523b97ae9f66a803c3e"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_4362bbb0dd9d705ba27545bc08"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_69427761f37533ae7767601a64"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_e59c9e6988cf3ef1621430612a"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_a5dc1c25ca5721db8fbbcc0ca9"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_be513f617a218e2f0c515f7a1f"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_1b92824619a65e4dfe65bfd5da"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_roles_organization_name"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."approval_status_enum_old" AS ENUM('approved', 'cancelled', 'pending', 'rejected')`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ALTER COLUMN "status" TYPE "hollon"."approval_status_enum_old" USING "status"::"text"::"hollon"."approval_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."approval_requests_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."approval_status_enum_old" RENAME TO "approval_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "brain_provider_configs" DROP COLUMN "organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "brain_provider_configs" ADD "organization_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" ALTER COLUMN "joined_at" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."channel_role_enum_old" AS ENUM('admin', 'member', 'owner')`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" ALTER COLUMN "role" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" ALTER COLUMN "role" TYPE "hollon"."channel_role_enum_old" USING "role"::"text"::"hollon"."channel_role_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" ALTER COLUMN "role" SET DEFAULT 'member'`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."channel_memberships_role_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."channel_role_enum_old" RENAME TO "channel_role_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."participant_type_enum_old" AS ENUM('hollon', 'human', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" ALTER COLUMN "member_type" TYPE "hollon"."participant_type_enum_old" USING "member_type"::"text"::"hollon"."participant_type_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."channel_memberships_member_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."participant_type_enum_old" RENAME TO "participant_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_messages" ALTER COLUMN "metadata" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."participant_type_enum_old" AS ENUM('hollon', 'human', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_messages" ALTER COLUMN "sender_type" TYPE "hollon"."participant_type_enum_old" USING "sender_type"::"text"::"hollon"."participant_type_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."channel_messages_sender_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."participant_type_enum_old" RENAME TO "participant_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."participant_type_enum_old" AS ENUM('hollon', 'human', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" ALTER COLUMN "created_by_type" TYPE "hollon"."participant_type_enum_old" USING "created_by_type"::"text"::"hollon"."participant_type_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."channels_created_by_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."participant_type_enum_old" RENAME TO "participant_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."channel_type_enum_old" AS ENUM('direct', 'group', 'private', 'public')`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" ALTER COLUMN "channel_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" ALTER COLUMN "channel_type" TYPE "hollon"."channel_type_enum_old" USING "channel_type"::"text"::"hollon"."channel_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" ALTER COLUMN "channel_type" SET DEFAULT 'public'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."channels_channel_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."channel_type_enum_old" RENAME TO "channel_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ALTER COLUMN "metadata" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."collaboration_status_enum_old" AS ENUM('accepted', 'active', 'cancelled', 'completed', 'pending', 'rejected')`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ALTER COLUMN "status" TYPE "hollon"."collaboration_status_enum_old" USING "status"::"text"::"hollon"."collaboration_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."collaboration_sessions_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."collaboration_status_enum_old" RENAME TO "collaboration_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."collaboration_type_enum_old" AS ENUM('architecture_review', 'code_review', 'debugging', 'knowledge_sharing', 'pair_programming')`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ALTER COLUMN "type" TYPE "hollon"."collaboration_type_enum_old" USING "type"::"text"::"hollon"."collaboration_type_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."collaboration_sessions_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."collaboration_type_enum_old" RENAME TO "collaboration_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."reviewer_type_enum_old" AS ENUM('architecture_reviewer', 'code_reviewer', 'performance_reviewer', 'security_reviewer', 'team_manager', 'team_member')`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" ALTER COLUMN "reviewer_type" TYPE "hollon"."reviewer_type_enum_old" USING "reviewer_type"::"text"::"hollon"."reviewer_type_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."task_pull_requests_reviewer_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."reviewer_type_enum_old" RENAME TO "reviewer_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."pr_status_enum_old" AS ENUM('approved', 'changes_requested', 'closed', 'draft', 'merged', 'ready_for_review')`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" ALTER COLUMN "status" TYPE "hollon"."pr_status_enum_old" USING "status"::"text"::"hollon"."pr_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" ALTER COLUMN "status" SET DEFAULT 'draft'`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."task_pull_requests_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."pr_status_enum_old" RENAME TO "pr_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ALTER COLUMN "metadata" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."resolution_strategy_enum_old" AS ENUM('deadline_extension', 'manual_intervention', 'priority_adjustment', 'resource_reallocation', 'sequential_execution')`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ALTER COLUMN "resolution_strategy" TYPE "hollon"."resolution_strategy_enum_old" USING "resolution_strategy"::"text"::"hollon"."resolution_strategy_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."conflict_resolutions_resolution_strategy_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."resolution_strategy_enum_old" RENAME TO "resolution_strategy_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."conflict_status_enum_old" AS ENUM('detected', 'escalated', 'resolved', 'resolving')`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ALTER COLUMN "status" TYPE "hollon"."conflict_status_enum_old" USING "status"::"text"::"hollon"."conflict_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ALTER COLUMN "status" SET DEFAULT 'detected'`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."conflict_resolutions_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."conflict_status_enum_old" RENAME TO "conflict_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."conflict_type_enum_old" AS ENUM('deadline_conflict', 'file_conflict', 'priority_conflict', 'resource_conflict')`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ALTER COLUMN "conflict_type" TYPE "hollon"."conflict_type_enum_old" USING "conflict_type"::"text"::"hollon"."conflict_type_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."conflict_resolutions_conflict_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."conflict_type_enum_old" RENAME TO "conflict_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" DROP COLUMN "organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ADD "organization_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."cost_record_type_enum_old" AS ENUM('brain_execution', 'other', 'quality_check', 'task_analysis')`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" ALTER COLUMN "type" TYPE "hollon"."cost_record_type_enum_old" USING "type"::"text"::"hollon"."cost_record_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" ALTER COLUMN "type" SET DEFAULT 'brain_execution'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."cost_records_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."cost_record_type_enum_old" RENAME TO "cost_record_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ALTER COLUMN "metadata" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."contract_status_enum_old" AS ENUM('accepted', 'cancelled', 'delivered', 'in_progress', 'negotiating', 'pending', 'rejected')`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ALTER COLUMN "status" TYPE "hollon"."contract_status_enum_old" USING "status"::"text"::"hollon"."contract_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."cross_team_contracts_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."contract_status_enum_old" RENAME TO "contract_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ALTER COLUMN "deliverables" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."approval_status_enum_old" AS ENUM('approved', 'cancelled', 'pending', 'rejected')`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ALTER COLUMN "status" TYPE "hollon"."approval_status_enum_old" USING "status"::"text"::"hollon"."approval_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."approval_requests_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."approval_status_enum_old" RENAME TO "approval_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ALTER COLUMN "metadata" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ALTER COLUMN "timeline" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ALTER COLUMN "impact" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."incident_status_enum_old" AS ENUM('closed', 'identified', 'investigating', 'reported', 'resolved', 'resolving')`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ALTER COLUMN "status" TYPE "hollon"."incident_status_enum_old" USING "status"::"text"::"hollon"."incident_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ALTER COLUMN "status" SET DEFAULT 'reported'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."incidents_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."incident_status_enum_old" RENAME TO "incident_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."incident_severity_enum_old" AS ENUM('P1', 'P2', 'P3', 'P4')`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ALTER COLUMN "severity" TYPE "hollon"."incident_severity_enum_old" USING "severity"::"text"::"hollon"."incident_severity_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."incidents_severity_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."incident_severity_enum_old" RENAME TO "incident_severity_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" DROP COLUMN "organization_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ADD "organization_id" uuid NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" ALTER COLUMN "metadata" SET DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."knowledge_type_enum_old" AS ENUM('best_practice', 'error_resolution', 'pattern', 'solution')`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" ALTER COLUMN "type" TYPE "hollon"."knowledge_type_enum_old" USING "type"::"text"::"hollon"."knowledge_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."knowledge_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."knowledge_type_enum_old" RENAME TO "knowledge_type_enum"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "knowledge_items"."extracted_at" IS 'Timestamp when the knowledge was extracted.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "knowledge_items"."metadata" IS 'Additional metadata about the extracted knowledge in JSON format.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "knowledge_items"."content" IS 'The extracted knowledge content or text.'`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "knowledge_items"."type" IS 'Source identifier of where the knowledge was extracted from.'`,
    );
    await queryRunner.query(
      `ALTER TABLE "meeting_records" ALTER COLUMN "metadata" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."meeting_type_enum_old" AS ENUM('ad_hoc', 'retrospective', 'sprint_planning', 'standup', 'tech_debt_review')`,
    );
    await queryRunner.query(
      `ALTER TABLE "meeting_records" ALTER COLUMN "meeting_type" TYPE "hollon"."meeting_type_enum_old" USING "meeting_type"::"text"::"hollon"."meeting_type_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."meeting_records_meeting_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."meeting_type_enum_old" RENAME TO "meeting_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "metadata" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."message_priority_enum_old" AS ENUM('high', 'low', 'normal', 'urgent')`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "priority" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "priority" TYPE "hollon"."message_priority_enum_old" USING "priority"::"text"::"hollon"."message_priority_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "priority" SET DEFAULT 'normal'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."messages_priority_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."message_priority_enum_old" RENAME TO "message_priority_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."message_type_enum_old" AS ENUM('collaboration_request', 'conflict_notification', 'delegation_approval', 'delegation_request', 'general', 'question', 'response', 'review_request', 'task_assignment', 'task_completion', 'task_update')`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "message_type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "message_type" TYPE "hollon"."message_type_enum_old" USING "message_type"::"text"::"hollon"."message_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "message_type" SET DEFAULT 'general'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."messages_message_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."message_type_enum_old" RENAME TO "message_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."participant_type_enum_old" AS ENUM('hollon', 'human', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "to_type" TYPE "hollon"."participant_type_enum_old" USING "to_type"::"text"::"hollon"."participant_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."messages_to_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."participant_type_enum_old" RENAME TO "participant_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."participant_type_enum_old" AS ENUM('hollon', 'human', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "from_type" TYPE "hollon"."participant_type_enum_old" USING "from_type"::"text"::"hollon"."participant_type_enum_old"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."messages_from_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."participant_type_enum_old" RENAME TO "participant_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ALTER COLUMN "conversation_id" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."conversation_context_enum_old" AS ENUM('collaboration', 'escalation', 'general', 'review', 'task')`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "context" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "context" TYPE "hollon"."conversation_context_enum_old" USING "context"::"text"::"hollon"."conversation_context_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "context" SET DEFAULT 'general'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."conversations_context_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."conversation_context_enum_old" RENAME TO "conversation_context_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."participant_type_enum_old" AS ENUM('hollon', 'human', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "participant2_type" TYPE "hollon"."participant_type_enum_old" USING "participant2_type"::"text"::"hollon"."participant_type_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."conversations_participant2_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."participant_type_enum_old" RENAME TO "participant_type_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."participant_type_enum_old" AS ENUM('hollon', 'human', 'system')`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ALTER COLUMN "participant1_type" TYPE "hollon"."participant_type_enum_old" USING "participant1_type"::"text"::"hollon"."participant_type_enum_old"`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."conversations_participant1_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."participant_type_enum_old" RENAME TO "participant_type_enum"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "organizations"."context_prompt" IS '조직 수준의 컨텍스트 프롬프트'`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "teams"."manager_hollon_id" IS 'Manager hollon who distributes team tasks to team members using Brain Provider.
         Phase 3.8: Hierarchical task distribution (Level 0 → Level 1).'`);
    await queryRunner.query(`COMMENT ON COLUMN "hollons"."experience_level" IS 'Statistical performance metric for allocation priority.
         NOT individual growth - just allocation score (SSOT 원칙).
         Values: junior, mid, senior, lead, principal'`);
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "experience_level" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."experience_level_enum_old" AS ENUM('junior', 'lead', 'mid', 'principal', 'senior')`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "experience_level" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "experience_level" TYPE "hollon"."experience_level_enum_old" USING "experience_level"::"text"::"hollon"."experience_level_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "experience_level" SET DEFAULT 'mid'`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."hollons_experience_level_enum"`,
    );
    await queryRunner.query(
      `ALTER TYPE "hollon"."experience_level_enum_old" RENAME TO "experience_level_enum"`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "hollons"."manager_id" IS 'Denormalized manager reference - updated when team structure changes.
         Read performance >> Write consistency (에스컬레이션 시 빈번한 조회)'`);
    await queryRunner.query(
      `COMMENT ON COLUMN "hollons"."depth" IS '임시 홀론 재귀 생성 깊이 (영구 홀론은 제한 없음)'`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."hollon_lifecycle_enum_old" AS ENUM('permanent', 'temporary')`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "lifecycle" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "lifecycle" TYPE "hollon"."hollon_lifecycle_enum_old" USING "lifecycle"::"text"::"hollon"."hollon_lifecycle_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "lifecycle" SET DEFAULT 'permanent'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."hollons_lifecycle_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."hollon_lifecycle_enum_old" RENAME TO "hollon_lifecycle_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."hollon_status_enum_old" AS ENUM('blocked', 'idle', 'offline', 'reviewing', 'working')`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "status" TYPE "hollon"."hollon_status_enum_old" USING "status"::"text"::"hollon"."hollon_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ALTER COLUMN "status" SET DEFAULT 'idle'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."hollons_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."hollon_status_enum_old" RENAME TO "hollon_status_enum"`,
    );
    await queryRunner.query(
      `COMMENT ON COLUMN "tasks"."working_directory" IS 'Phase 3.12: Worktree path for this task. Set during execution, cleared after completion/cleanup.'`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "tasks"."needs_human_approval" IS 'Flag for Level 5 escalation - human intervention required.
         Phase 3.5: API approval, Phase 5: UI approval.'`);
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "needs_human_approval" DROP NOT NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "tasks"."required_skills" IS 'Required skills from Role.capabilities for task assignment.
         Used by ResourcePlanner for skill-based matching.'`);
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "required_skills" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "affected_files" DROP NOT NULL`,
    );
    await queryRunner.query(`COMMENT ON COLUMN "tasks"."depth" IS 'Task hierarchy depth: 0 = Team Task (TEAM_EPIC), 1+ = Hollon Task.
         Phase 3.8: Manager distributes Level 0 → Level 1.'`);
    await queryRunner.query(`COMMENT ON COLUMN "tasks"."assigned_team_id" IS 'Team-level task assignment (Level 0, TEAM_EPIC type).
         XOR with assigned_hollon_id - task assigned to team OR hollon, not both.'`);
    await queryRunner.query(
      `CREATE TYPE "hollon"."task_priority_enum_old" AS ENUM('P0', 'P1', 'P2', 'P3', 'P4')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "priority" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "priority" TYPE "hollon"."task_priority_enum_old" USING "priority"::"text"::"hollon"."task_priority_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "priority" SET DEFAULT 'P3'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."tasks_priority_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."task_priority_enum_old" RENAME TO "task_priority_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."task_status_enum_old" AS ENUM('blocked', 'cancelled', 'completed', 'failed', 'in_progress', 'in_review', 'pending', 'ready', 'ready_for_review', 'waiting_for_hollon')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "status" TYPE "hollon"."task_status_enum_old" USING "status"::"text"::"hollon"."task_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'pending'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."tasks_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."task_status_enum_old" RENAME TO "task_status_enum"`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."task_type_enum_old" AS ENUM('bug_fix', 'discussion', 'documentation', 'implementation', 'planning', 'research', 'review', 'team_epic', 'testing')`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "type" TYPE "hollon"."task_type_enum_old" USING "type"::"text"::"hollon"."task_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "type" SET DEFAULT 'implementation'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."tasks_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."task_type_enum_old" RENAME TO "task_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ALTER COLUMN "description" DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "tasks" DROP COLUMN "title"`);
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "title" character varying(500) NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."cycle_status_enum_old" AS ENUM('active', 'completed', 'upcoming')`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" ALTER COLUMN "status" TYPE "hollon"."cycle_status_enum_old" USING "status"::"text"::"hollon"."cycle_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" ALTER COLUMN "status" SET DEFAULT 'upcoming'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."cycles_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."cycle_status_enum_old" RENAME TO "cycle_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" ALTER COLUMN "actual_cost_cents" DROP NOT NULL`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."project_status_enum_old" AS ENUM('active', 'archived', 'completed', 'on_hold', 'planning')`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ALTER COLUMN "status" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ALTER COLUMN "status" TYPE "hollon"."project_status_enum_old" USING "status"::"text"::"hollon"."project_status_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ALTER COLUMN "status" SET DEFAULT 'planning'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."projects_status_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."project_status_enum_old" RENAME TO "project_status_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ALTER COLUMN "auto_generated" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ALTER COLUMN "auto_decomposed" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ALTER COLUMN "success_criteria" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ALTER COLUMN "current_value" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ALTER COLUMN "priority" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ALTER COLUMN "progress_percent" SET DEFAULT 0.0`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ALTER COLUMN "progress_percent" DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "goals" DROP COLUMN "updated_at"`);
    await queryRunner.query(
      `ALTER TABLE "goals" ADD "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(`ALTER TABLE "goals" DROP COLUMN "created_at"`);
    await queryRunner.query(
      `ALTER TABLE "goals" ADD "created_at" TIMESTAMP WITH TIME ZONE DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" ALTER COLUMN "recorded_at" SET DEFAULT now()`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" ALTER COLUMN "recorded_at" DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "embedding"`);
    await queryRunner.query(
      `ALTER TABLE "documents" ADD "embedding" jsonb DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "metadata" SET DEFAULT '{}'`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."document_type_enum_old" AS ENUM('code_review', 'context', 'decision', 'decision_log', 'discussion', 'knowledge', 'memory', 'output', 'task_context')`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "type" DROP DEFAULT`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "type" TYPE "hollon"."document_type_enum_old" USING "type"::"text"::"hollon"."document_type_enum_old"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ALTER COLUMN "type" SET DEFAULT 'memory'`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."documents_type_enum"`);
    await queryRunner.query(
      `ALTER TYPE "hollon"."document_type_enum_old" RENAME TO "document_type_enum"`,
    );
    await queryRunner.query(`ALTER TABLE "documents" DROP COLUMN "title"`);
    await queryRunner.query(
      `ALTER TABLE "documents" ADD "title" character varying(500) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" ALTER COLUMN "available_for_temporary_hollon" DROP NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "roles" ALTER COLUMN "capabilities" DROP NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "roles" DROP COLUMN "name"`);
    await queryRunner.query(
      `ALTER TABLE "roles" ADD "name" character varying(255) NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "rejection_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "rejected_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "rejected_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "approved_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "approved_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "requested_by"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "metadata"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "request_type"`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."approval_requests_request_type_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" DROP COLUMN "conflictContext"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" DROP COLUMN "affectedHollonIds"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" DROP COLUMN "affectedTaskIds"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP COLUMN "feedback"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP COLUMN "delivered_items"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP COLUMN "cancellation_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP COLUMN "rejection_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP COLUMN "rejected_by_hollon_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP COLUMN "accepted_by_hollon_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP COLUMN "cancelled_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP COLUMN "completed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP COLUMN "rejected_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP COLUMN "accepted_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP COLUMN "priority"`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."cross_team_contracts_priority_enum"`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" DROP COLUMN "title"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "escalation_level"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "review_comment"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "reviewed_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "reviewed_by_user_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "requested_by_hollon_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "context"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "title"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "type"`,
    );
    await queryRunner.query(`DROP TYPE "hollon"."approval_requests_type_enum"`);
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "task_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "hollon_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" DROP COLUMN "organization_id"`,
    );
    await queryRunner.query(`ALTER TABLE "incidents" DROP COLUMN "postmortem"`);
    await queryRunner.query(`ALTER TABLE "knowledge" DROP COLUMN "source"`);
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" DROP COLUMN "updated_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" DROP COLUMN "created_at"`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ADD "conflict_context" jsonb DEFAULT '{}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ADD "affected_hollon_ids" jsonb DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "conflict_resolutions" ADD "affected_task_ids" jsonb DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "rejection_reason" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "rejected_by" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "approved_by" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "requested_by" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "rejected_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "approved_at" TIMESTAMP`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "metadata" jsonb DEFAULT '{}'`,
    );
    await queryRunner.query(
      `CREATE TYPE "hollon"."approval_request_type_enum" AS ENUM('create_permanent_hollon', 'delete_permanent_hollon', 'escalation', 'incident_resolution')`,
    );
    await queryRunner.query(
      `ALTER TABLE "approval_requests" ADD "request_type" "hollon"."approval_request_type_enum" NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" ADD "is_latest" boolean NOT NULL DEFAULT true`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" ADD "version_number" integer NOT NULL DEFAULT '1'`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" ADD "source_task_id" uuid`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" ADD "organization_id" uuid NOT NULL`,
    );
    await queryRunner.query(`ALTER TABLE "teams" ADD "team_prompt" text`);
    await queryRunner.query(`ALTER TABLE "hollons" ADD "expires_at" TIMESTAMP`);
    await queryRunner.query(`ALTER TABLE "tasks" ADD "result" text`);
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD "max_retries" integer NOT NULL DEFAULT '3'`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_68e270a878808d5dcae2fc0de9"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_ddb86fe90c0b9cd501fe79338b"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_791a699bc5c7fe4a37b4e36103"`,
    );
    await queryRunner.query(`DROP TABLE "knowledge_graph_nodes"`);
    await queryRunner.query(
      `DROP TYPE "hollon"."knowledge_graph_nodes_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_0ee18e7912248113e7a73a1090"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_e584786864b43b5f20b010d7de"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_e18f64ebe58a067c200a8035a5"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_daa6b46c39b209ebb55a8414dc"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_ea53e50cff6b3c75ed33aacaa4"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_14b4298254590f991a9889d5ef"`,
    );
    await queryRunner.query(`DROP TABLE "knowledge_graph_edges"`);
    await queryRunner.query(
      `DROP TYPE "hollon"."knowledge_graph_edges_type_enum"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_1ad4fe841737bf94133e2ba4f3"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_6bbf8a3f9a0fbfc52543c72add"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_f1e17c7a70f0b085dfa5c8401f"`,
    );
    await queryRunner.query(`DROP TABLE "tech_debts"`);
    await queryRunner.query(`DROP TYPE "hollon"."tech_debts_status_enum"`);
    await queryRunner.query(`DROP TYPE "hollon"."tech_debts_severity_enum"`);
    await queryRunner.query(`DROP TYPE "hollon"."tech_debts_category_enum"`);
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_1a1c0c4a16d0b6327ebe2b5c35"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_82165fae4d483ef9bc2e7cf1cd"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_be917cb7b349044bae5bcd5e10"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_7a2c465c2fc3c34b1acafaba09"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_94f321e6925ea0c72ed9e6463c"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_d32f506e6d7b769b16436ef3c8"`,
    );
    await queryRunner.query(
      `DROP INDEX "hollon"."IDX_abbfde60a0f82e46533db64445"`,
    );
    await queryRunner.query(`DROP TABLE "vector_embeddings"`);
    await queryRunner.query(
      `DROP TYPE "hollon"."vector_embeddings_model_type_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "hollon"."vector_embeddings_source_type_enum"`,
    );
    await queryRunner.query(`COMMENT ON TABLE "knowledge_items" IS 'Stores extracted knowledge items from various sources within the organization.
         Used by the Knowledge Extraction Service for RAG and knowledge management.'`);
    await queryRunner.query(
      `ALTER TABLE "knowledge_items" RENAME COLUMN "type" TO "source"`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" RENAME COLUMN "embedding" TO "keywords"`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" ADD CONSTRAINT "UQ_channel_memberships_member" UNIQUE ("channel_id", "member_type", "member_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "UQ_conversations_participants" UNIQUE ("participant1_type", "participant1_id", "participant2_type", "participant2_id")`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" ADD CONSTRAINT "UQ_cycles_project_number" UNIQUE ("project_id", "number")`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "CHK_tasks_assignment_xor" CHECK ((((type = 'team_epic'::task_type_enum) AND (assigned_team_id IS NOT NULL)) OR ((type <> 'team_epic'::task_type_enum) AND (((assigned_team_id IS NOT NULL) AND (assigned_hollon_id IS NULL)) OR ((assigned_team_id IS NULL) AND (assigned_hollon_id IS NOT NULL)) OR ((assigned_team_id IS NULL) AND (assigned_hollon_id IS NULL))))))`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "goals_metric_type_check" CHECK (((metric_type)::text = ANY ((ARRAY['binary'::character varying, 'numeric'::character varying, 'percentage'::character varying, 'custom'::character varying])::text[])))`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "goals_priority_check" CHECK (((priority)::text = ANY ((ARRAY['low'::character varying, 'medium'::character varying, 'high'::character varying, 'critical'::character varying])::text[])))`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "goals_progress_percent_check" CHECK (((progress_percent >= (0)::numeric) AND (progress_percent <= (100)::numeric)))`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "goals_status_check" CHECK (((status)::text = ANY ((ARRAY['draft'::character varying, 'active'::character varying, 'paused'::character varying, 'completed'::character varying, 'cancelled'::character varying, 'archived'::character varying])::text[])))`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "goals_goal_type_check" CHECK (((goal_type)::text = ANY ((ARRAY['objective'::character varying, 'key_result'::character varying])::text[])))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_dependencies_depends_on_id" ON "task_dependencies" ("depends_on_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_dependencies_task_id" ON "task_dependencies" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_brain_provider_org_provider" ON "brain_provider_configs" ("organization_id", "provider_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_channel_memberships_member" ON "channel_memberships" ("member_type", "member_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_channel_memberships_channel" ON "channel_memberships" ("channel_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_channel_messages_thread" ON "channel_messages" ("thread_parent_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_channel_messages_channel" ON "channel_messages" ("channel_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_channels_team" ON "channels" ("team_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_channels_organization" ON "channels" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collaboration_sessions_task" ON "collaboration_sessions" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collaboration_sessions_collaborator_status" ON "collaboration_sessions" ("status", "collaborator_hollon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collaboration_sessions_requester_status" ON "collaboration_sessions" ("status", "requester_hollon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_pull_requests_reviewer" ON "task_pull_requests" ("reviewer_hollon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_pull_requests_author" ON "task_pull_requests" ("author_hollon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_pull_requests_status" ON "task_pull_requests" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_task_pull_requests_task" ON "task_pull_requests" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conflict_resolutions_type_status" ON "conflict_resolutions" ("conflict_type", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conflict_resolutions_organization_status" ON "conflict_resolutions" ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cost_records_task" ON "cost_records" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cost_records_org_created" ON "cost_records" ("organization_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cross_team_contracts_target_status" ON "cross_team_contracts" ("target_team_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cross_team_contracts_requester_status" ON "cross_team_contracts" ("requester_team_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_approval_requests_status" ON "approval_requests" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_incidents_severity_status" ON "incidents" ("severity", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_incidents_organization_status" ON "incidents" ("organization_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_source_task" ON "knowledge" ("source_task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_type_created_at" ON "knowledge" ("type", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_knowledge_organization_type" ON "knowledge" ("organization_id", "type") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_knowledge_items_extracted_at" ON "knowledge_items" ("extracted_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_knowledge_items_source" ON "knowledge_items" ("source") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_knowledge_items_organization_id" ON "knowledge_items" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meeting_records_type_date" ON "meeting_records" ("meeting_type", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meeting_records_team" ON "meeting_records" ("team_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_meeting_records_organization" ON "meeting_records" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversation_history_conversation" ON "conversation_history" ("conversation_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_conversation" ON "messages" ("created_at", "conversation_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_unread" ON "messages" ("to_type", "to_id", "is_read") WHERE (is_read = false)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_from" ON "messages" ("from_type", "from_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_to" ON "messages" ("to_type", "to_id", "created_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversations_context" ON "conversations" ("context", "context_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversations_participant2" ON "conversations" ("participant2_type", "participant2_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversations_participant1" ON "conversations" ("participant1_type", "participant1_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_teams_parent_team_id" ON "teams" ("parent_team_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_teams_manager_hollon_id" ON "teams" ("manager_hollon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_teams_leader_hollon_id" ON "teams" ("leader_hollon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_teams_organization" ON "teams" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_hollons_experience_level" ON "hollons" ("experience_level") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_hollons_manager_id" ON "hollons" ("manager_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_hollons_expires_at" ON "hollons" ("expires_at") WHERE (expires_at IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_hollons_org_status" ON "hollons" ("status", "organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_reviewer_hollon_status" ON "tasks" ("status", "reviewer_hollon_id") WHERE (reviewer_hollon_id IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_review_status" ON "tasks" ("status", "review_count") WHERE (status = 'ready_for_review'::task_status_enum)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_depth" ON "tasks" ("depth") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_assigned_team_id" ON "tasks" ("assigned_team_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_blocked_until" ON "tasks" ("blocked_until") WHERE (blocked_until IS NOT NULL)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_needs_human_approval" ON "tasks" ("needs_human_approval") WHERE (needs_human_approval = true)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_required_skills" ON "tasks" ("required_skills") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_project" ON "tasks" ("project_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_tasks_organization" ON "tasks" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_assigned_hollon_status" ON "tasks" ("assigned_hollon_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_status_priority" ON "tasks" ("status", "priority") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_project_status" ON "tasks" ("project_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_cycle" ON "tasks" ("cycle_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_tasks_assigned_hollon" ON "tasks" ("assigned_hollon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cycles_project_status" ON "cycles" ("project_id", "status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cycles_status" ON "cycles" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_cycles_project" ON "cycles" ("project_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_projects_goal" ON "projects" ("goal_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_projects_organization" ON "projects" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_projects_assigned_team_id" ON "projects" ("assigned_team_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_goals_auto_generated" ON "goals" ("auto_generated") WHERE (auto_generated = true)`,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_goals_owner" ON "goals" ("owner_hollon_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_goals_status" ON "goals" ("status") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_goals_parent" ON "goals" ("parent_goal_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_goals_team" ON "goals" ("team_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_goals_org" ON "goals" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_goal_progress_date" ON "goal_progress_records" ("recorded_at") `,
    );
    await queryRunner.query(
      `CREATE INDEX "idx_goal_progress_goal" ON "goal_progress_records" ("goal_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_documents_task" ON "documents" ("task_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_documents_project" ON "documents" ("project_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_documents_organization" ON "documents" ("organization_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_documents_team_id" ON "documents" ("team_id") `,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_roles_temporary_available" ON "roles" ("organization_id", "available_for_temporary_hollon") WHERE (available_for_temporary_hollon = true)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_roles_organization" ON "roles" ("organization_id") `,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_task_dependencies_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_dependencies" ADD CONSTRAINT "FK_task_dependencies_depends_on" FOREIGN KEY ("depends_on_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_memberships" ADD CONSTRAINT "FK_channel_memberships_channel" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_messages" ADD CONSTRAINT "FK_channel_messages_channel" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "channel_messages" ADD CONSTRAINT "FK_channel_messages_thread_parent" FOREIGN KEY ("thread_parent_id") REFERENCES "channel_messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" ADD CONSTRAINT "FK_channels_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "channels" ADD CONSTRAINT "FK_channels_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ADD CONSTRAINT "FK_collaboration_sessions_requester" FOREIGN KEY ("requester_hollon_id") REFERENCES "hollons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ADD CONSTRAINT "FK_collaboration_sessions_collaborator" FOREIGN KEY ("collaborator_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collaboration_sessions" ADD CONSTRAINT "FK_collaboration_sessions_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" ADD CONSTRAINT "FK_task_pull_requests_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" ADD CONSTRAINT "FK_task_pull_requests_author" FOREIGN KEY ("author_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "task_pull_requests" ADD CONSTRAINT "FK_task_pull_requests_reviewer" FOREIGN KEY ("reviewer_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" ADD CONSTRAINT "FK_cost_records_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" ADD CONSTRAINT "FK_cost_records_hollon" FOREIGN KEY ("hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cost_records" ADD CONSTRAINT "FK_cost_records_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD CONSTRAINT "FK_cross_team_contracts_requester_team" FOREIGN KEY ("requester_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cross_team_contracts" ADD CONSTRAINT "FK_cross_team_contracts_target_team" FOREIGN KEY ("target_team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ADD CONSTRAINT "FK_incidents_reporter_hollon" FOREIGN KEY ("reporter_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "incidents" ADD CONSTRAINT "FK_incidents_owner_hollon" FOREIGN KEY ("owner_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" ADD CONSTRAINT "FK_knowledge_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge" ADD CONSTRAINT "FK_knowledge_task" FOREIGN KEY ("source_task_id") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "knowledge_items" ADD CONSTRAINT "FK_knowledge_items_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "meeting_records" ADD CONSTRAINT "FK_meeting_records_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "meeting_records" ADD CONSTRAINT "FK_meeting_records_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_history" ADD CONSTRAINT "FK_conversation_history_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversation_history" ADD CONSTRAINT "FK_conversation_history_message" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_messages_replied_to" FOREIGN KEY ("replied_to_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "messages" ADD CONSTRAINT "FK_messages_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_conversations_last_message" FOREIGN KEY ("last_message_id") REFERENCES "messages"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "FK_teams_parent_team" FOREIGN KEY ("parent_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "FK_teams_leader_hollon" FOREIGN KEY ("leader_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "teams" ADD CONSTRAINT "FK_teams_manager_hollon" FOREIGN KEY ("manager_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ADD CONSTRAINT "FK_hollons_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ADD CONSTRAINT "FK_hollons_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ADD CONSTRAINT "FK_hollons_role" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "hollons" ADD CONSTRAINT "FK_hollons_manager" FOREIGN KEY ("manager_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_parent" FOREIGN KEY ("parent_task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_assigned_hollon" FOREIGN KEY ("assigned_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_creator_hollon" FOREIGN KEY ("creator_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_cycle" FOREIGN KEY ("cycle_id") REFERENCES "cycles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "tasks_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_assigned_team" FOREIGN KEY ("assigned_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "tasks" ADD CONSTRAINT "FK_tasks_reviewer_hollon" FOREIGN KEY ("reviewer_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "cycles" ADD CONSTRAINT "FK_cycles_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "projects_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "projects" ADD CONSTRAINT "FK_projects_assigned_team" FOREIGN KEY ("assigned_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "goals_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "goals_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "goals_parent_goal_id_fkey" FOREIGN KEY ("parent_goal_id") REFERENCES "goals"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_hollon_id_fkey" FOREIGN KEY ("owner_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goals" ADD CONSTRAINT "goals_created_by_hollon_id_fkey" FOREIGN KEY ("created_by_hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" ADD CONSTRAINT "goal_progress_records_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "goal_progress_records" ADD CONSTRAINT "goal_progress_records_recorded_by_fkey" FOREIGN KEY ("recorded_by") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_documents_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_documents_project" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_documents_task" FOREIGN KEY ("task_id") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_documents_hollon" FOREIGN KEY ("hollon_id") REFERENCES "hollons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "documents" ADD CONSTRAINT "FK_documents_team_id" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }
}
