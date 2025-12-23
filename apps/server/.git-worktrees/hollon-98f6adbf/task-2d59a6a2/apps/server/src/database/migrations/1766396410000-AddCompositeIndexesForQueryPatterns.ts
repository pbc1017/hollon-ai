import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Composite Indexes for Common Query Patterns
 *
 * Phase 4: Establishes composite (multi-column) indexes optimized for the
 * most frequent query patterns in the Hollon AI system.
 *
 * This migration supports:
 * - Task assignment and prioritization (WHERE + ORDER BY combinations)
 * - Goal hierarchy and status filtering
 * - Message routing and reading patterns
 * - Code review workflows
 * - Incident severity tracking
 * - Progress record queries
 *
 * Naming convention: IDX_table_col1_col2_col3
 */
export class AddCompositeIndexesForQueryPatterns1766396410000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // ========== TASK TABLE INDEXES ==========
    // Most common: Filter by project + status + prioritize by priority and creation time
    // Query: Find tasks for project with specific statuses, order by priority then created
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tasks_project_status_priority_created"
      ON "tasks" ("project_id", "status", "priority", "created_at");
    `);

    // Task assignment + status filtering
    // Query: Get all tasks assigned to a hollon with specific statuses
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tasks_assigned_hollon_status_blocked"
      ON "tasks" ("assigned_hollon_id", "status", "blocked_until")
      WHERE "assigned_hollon_id" IS NOT NULL;
    `);

    // Task status + priority ordering
    // Query: Get all tasks with status in (READY, PENDING) ordered by priority
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tasks_status_priority_created"
      ON "tasks" ("status", "priority", "created_at");
    `);

    // Cycle + status + completion time
    // Query: Find completed tasks in a cycle for sprint planning analytics
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tasks_cycle_status_completed"
      ON "tasks" ("cycle_id", "status", "completed_at")
      WHERE "cycle_id" IS NOT NULL;
    `);

    // Task parent hierarchy + status
    // Query: Find subtasks by parent and filter by status
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tasks_parent_status"
      ON "tasks" ("parent_task_id", "status")
      WHERE "parent_task_id" IS NOT NULL;
    `);

    // Team assignment + status
    // Query: Get all team tasks with specific statuses for distribution
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_tasks_assigned_team_status"
      ON "tasks" ("assigned_team_id", "status")
      WHERE "assigned_team_id" IS NOT NULL;
    `);

    // ========== GOAL TABLE INDEXES ==========
    // Organization + status + timestamp
    // Query: Fetch organization goals by status, ordered by creation
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_goals_org_status_created"
      ON "goals" ("organization_id", "status", "created_at");
    `);

    // Team + status + parent hierarchy
    // Query: Find team goals and their decomposition
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_goals_team_status_parent"
      ON "goals" ("team_id", "status", "parent_goal_id");
    `);

    // Owner + status
    // Query: Get all goals owned by a hollon with specific statuses
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_goals_owner_status"
      ON "goals" ("owner_hollon_id", "status");
    `);

    // Status + creation time (for filtering active/completed goals)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_goals_status_created"
      ON "goals" ("status", "created_at");
    `);

    // ========== GOAL PROGRESS RECORD TABLE INDEXES ==========
    // Goal + recorded timestamp (descending for latest progress)
    // Query: Get latest progress records for a goal
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_goal_progress_records_goal_recorded"
      ON "goal_progress_records" ("goal_id", "recorded_at" DESC);
    `);

    // ========== MESSAGE TABLE INDEXES ==========
    // Recipient type + ID + read status + timestamp
    // Query: Get unread messages for a participant, ordered by recency
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_messages_to_type_to_id_read_created"
      ON "messages" ("to_type", "to_id", "is_read", "created_at" DESC)
      WHERE "to_id" IS NOT NULL;
    `);

    // Conversation + timestamp (for pagination)
    // Query: Get messages from conversation ordered by creation
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_messages_conversation_created"
      ON "messages" ("conversation_id", "created_at" DESC);
    `);

    // Sender type + ID (for message history)
    // Query: Find messages from specific sender
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_messages_from_type_from_id"
      ON "messages" ("from_type", "from_id", "created_at" DESC)
      WHERE "from_id" IS NOT NULL;
    `);

    // ========== TASK PULL REQUEST TABLE INDEXES ==========
    // Reviewer + status + approval time
    // Query: Get approved/merged PRs for specific reviewer for metrics
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_task_pull_requests_reviewer_status_approved"
      ON "task_pull_requests" ("reviewer_hollon_id", "status", "approved_at")
      WHERE "reviewer_hollon_id" IS NOT NULL;
    `);

    // Task + status
    // Query: Get PR status for a specific task
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_task_pull_requests_task_status"
      ON "task_pull_requests" ("task_id", "status");
    `);

    // Status + creation time (for PR dashboards and metrics)
    // Query: Get recent PRs with specific statuses
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_task_pull_requests_status_created"
      ON "task_pull_requests" ("status", "created_at" DESC);
    `);

    // Author + status
    // Query: Get PRs authored by specific hollon
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_task_pull_requests_author_status"
      ON "task_pull_requests" ("author_hollon_id", "status");
    `);

    // ========== COLLABORATION SESSION TABLE INDEXES ==========
    // Requester + status
    // Query: Get active collaboration sessions for a hollon
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_collaboration_sessions_requester_status"
      ON "collaboration_sessions" ("requester_hollon_id", "status");
    `);

    // Collaborator + status
    // Query: Find pending collaboration requests for a hollon
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_collaboration_sessions_collaborator_status"
      ON "collaboration_sessions" ("collaborator_hollon_id", "status");
    `);

    // Task + status
    // Query: Get collaboration sessions for specific task
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_collaboration_sessions_task_status"
      ON "collaboration_sessions" ("task_id", "status");
    `);

    // ========== HOLLON TABLE INDEXES ==========
    // Organization + status + team
    // Query: Get team members by organization and hollon status
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hollons_org_status_team"
      ON "hollons" ("organization_id", "status", "team_id");
    `);

    // Team + status
    // Query: Get active members of a team
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hollons_team_status"
      ON "hollons" ("team_id", "status");
    `);

    // Manager relationships
    // Query: Find all subordinates of a manager
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_hollons_manager_status"
      ON "hollons" ("manager_id", "status")
      WHERE "manager_id" IS NOT NULL;
    `);

    // ========== INCIDENT TABLE INDEXES ==========
    // Organization + status + severity
    // Query: Get incidents by org filtered by status and severity
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_incidents_org_status_severity"
      ON "incidents" ("organization_id", "status", "severity");
    `);

    // Status + severity (for incident dashboards)
    // Query: Get critical/high severity incidents
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_incidents_status_severity"
      ON "incidents" ("status", "severity", "created_at" DESC);
    `);

    // ========== CHANNEL TABLE INDEXES ==========
    // Organization + type (for channel discovery)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_channels_org_type"
      ON "channels" ("organization_id", "is_public")
      WHERE "is_public" = true;
    `);

    // ========== CYCLE TABLE INDEXES ==========
    // Project + status + completion time
    // Query: Get completed cycles for project analytics
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_cycles_project_status_completed"
      ON "cycles" ("project_id", "status", "completed_at");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop composite indexes for cycles
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_cycles_project_status_completed";
    `);

    // Drop composite indexes for channels
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_channels_org_type";
    `);

    // Drop composite indexes for incidents
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_incidents_status_severity";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_incidents_org_status_severity";
    `);

    // Drop composite indexes for hollons
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_hollons_manager_status";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_hollons_team_status";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_hollons_org_status_team";
    `);

    // Drop composite indexes for collaboration sessions
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_collaboration_sessions_task_status";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_collaboration_sessions_collaborator_status";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_collaboration_sessions_requester_status";
    `);

    // Drop composite indexes for task pull requests
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_task_pull_requests_author_status";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_task_pull_requests_status_created";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_task_pull_requests_task_status";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_task_pull_requests_reviewer_status_approved";
    `);

    // Drop composite indexes for messages
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_messages_from_type_from_id";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_messages_conversation_created";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_messages_to_type_to_id_read_created";
    `);

    // Drop composite indexes for goal progress records
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_goal_progress_records_goal_recorded";
    `);

    // Drop composite indexes for goals
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_goals_status_created";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_goals_owner_status";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_goals_team_status_parent";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_goals_org_status_created";
    `);

    // Drop composite indexes for tasks
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tasks_assigned_team_status";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tasks_parent_status";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tasks_cycle_status_completed";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tasks_status_priority_created";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tasks_assigned_hollon_status_blocked";
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_tasks_project_status_priority_created";
    `);
  }
}
