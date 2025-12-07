import { MigrationInterface, QueryRunner } from 'typeorm';

export class MessagingSystem1733400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Messages table - 1:1 direct messages and system notifications
    await queryRunner.query(`
      CREATE TYPE "message_type_enum" AS ENUM (
        'task_assignment',
        'task_update',
        'task_completion',
        'question',
        'response',
        'delegation_request',
        'delegation_approval',
        'collaboration_request',
        'review_request',
        'conflict_notification',
        'general'
      );

      CREATE TYPE "participant_type_enum" AS ENUM ('hollon', 'human', 'system');

      CREATE TABLE "messages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "from_type" participant_type_enum NOT NULL,
        "from_id" uuid,
        "to_type" participant_type_enum NOT NULL,
        "to_id" uuid NOT NULL,
        "message_type" message_type_enum NOT NULL DEFAULT 'general',
        "content" text NOT NULL,
        "metadata" jsonb DEFAULT '{}',
        "requires_response" boolean NOT NULL DEFAULT false,
        "is_read" boolean NOT NULL DEFAULT false,
        "read_at" timestamp,
        "replied_to_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_messages_replied_to" FOREIGN KEY ("replied_to_id") REFERENCES "messages"("id") ON DELETE SET NULL
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_messages_to" ON "messages" ("to_type", "to_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_from" ON "messages" ("from_type", "from_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_messages_unread" ON "messages" ("to_type", "to_id", "is_read") WHERE "is_read" = false`,
    );

    // Conversations table - tracks 1:1 conversation threads
    await queryRunner.query(`
      CREATE TABLE "conversations" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "participant1_type" participant_type_enum NOT NULL,
        "participant1_id" uuid NOT NULL,
        "participant2_type" participant_type_enum NOT NULL,
        "participant2_id" uuid NOT NULL,
        "last_message_id" uuid,
        "last_message_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_conversations_last_message" FOREIGN KEY ("last_message_id") REFERENCES "messages"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_conversations_participants" UNIQUE ("participant1_type", "participant1_id", "participant2_type", "participant2_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_conversations_participant1" ON "conversations" ("participant1_type", "participant1_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_conversations_participant2" ON "conversations" ("participant2_type", "participant2_id")`,
    );

    // Conversation history - links messages to conversations
    await queryRunner.query(`
      CREATE TABLE "conversation_history" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "conversation_id" uuid NOT NULL,
        "message_id" uuid NOT NULL,
        "created_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_conversation_history_conversation" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_conversation_history_message" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_conversation_history_conversation" ON "conversation_history" ("conversation_id", "created_at" DESC)`,
    );

    // Channels table - group communication
    await queryRunner.query(`
      CREATE TYPE "channel_type_enum" AS ENUM ('public', 'private', 'direct');

      CREATE TABLE "channels" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "team_id" uuid,
        "name" varchar(255) NOT NULL,
        "description" text,
        "channel_type" channel_type_enum NOT NULL DEFAULT 'public',
        "created_by_type" participant_type_enum NOT NULL,
        "created_by_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_channels_organization" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_channels_team" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_channels_organization" ON "channels" ("organization_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_channels_team" ON "channels" ("team_id")`,
    );

    // Channel memberships
    await queryRunner.query(`
      CREATE TYPE "channel_role_enum" AS ENUM ('owner', 'admin', 'member');

      CREATE TABLE "channel_memberships" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "channel_id" uuid NOT NULL,
        "member_type" participant_type_enum NOT NULL,
        "member_id" uuid NOT NULL,
        "role" channel_role_enum NOT NULL DEFAULT 'member',
        "joined_at" timestamp NOT NULL DEFAULT now(),
        "last_read_at" timestamp,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_channel_memberships_channel" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE,
        CONSTRAINT "UQ_channel_memberships_member" UNIQUE ("channel_id", "member_type", "member_id")
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_channel_memberships_channel" ON "channel_memberships" ("channel_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_channel_memberships_member" ON "channel_memberships" ("member_type", "member_id")`,
    );

    // Channel messages
    await queryRunner.query(`
      CREATE TABLE "channel_messages" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "channel_id" uuid NOT NULL,
        "sender_type" participant_type_enum NOT NULL,
        "sender_id" uuid,
        "content" text NOT NULL,
        "metadata" jsonb DEFAULT '{}',
        "thread_parent_id" uuid,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_channel_messages_channel" FOREIGN KEY ("channel_id") REFERENCES "channels"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_channel_messages_thread_parent" FOREIGN KEY ("thread_parent_id") REFERENCES "channel_messages"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `CREATE INDEX "IDX_channel_messages_channel" ON "channel_messages" ("channel_id", "created_at" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_channel_messages_thread" ON "channel_messages" ("thread_parent_id", "created_at")`,
    );

    // PostgreSQL NOTIFY trigger functions
    await queryRunner.query(`
      -- Function: Notify new message
      CREATE OR REPLACE FUNCTION notify_new_message()
      RETURNS TRIGGER AS $$
      BEGIN
        PERFORM pg_notify(
          'holon_message_' || NEW.to_id::text,
          json_build_object(
            'id', NEW.id,
            'from_type', NEW.from_type,
            'from_id', NEW.from_id,
            'message_type', NEW.message_type,
            'content', substring(NEW.content, 1, 200),
            'requires_response', NEW.requires_response
          )::text
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trigger_notify_new_message
      AFTER INSERT ON "messages"
      FOR EACH ROW
      EXECUTE FUNCTION notify_new_message();
    `);

    await queryRunner.query(`
      -- Function: Notify hollon status change
      CREATE OR REPLACE FUNCTION notify_holon_status_change()
      RETURNS TRIGGER AS $$
      BEGIN
        IF OLD.status IS DISTINCT FROM NEW.status THEN
          PERFORM pg_notify(
            'holon_status_changed',
            json_build_object(
              'hollon_id', NEW.id,
              'organization_id', NEW.organization_id,
              'old_status', OLD.status,
              'new_status', NEW.status
            )::text
          );
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trigger_notify_holon_status_change
      AFTER UPDATE ON "hollons"
      FOR EACH ROW
      EXECUTE FUNCTION notify_holon_status_change();
    `);

    await queryRunner.query(`
      -- Function: Notify approval request
      CREATE OR REPLACE FUNCTION notify_approval_request()
      RETURNS TRIGGER AS $$
      BEGIN
        PERFORM pg_notify(
          'approval_requested',
          json_build_object(
            'id', NEW.id,
            'organization_id', NEW.organization_id,
            'holon_id', NEW.hollon_id,
            'type', NEW.type,
            'title', NEW.title,
            'escalation_level', NEW.escalation_level
          )::text
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trigger_notify_approval_request
      AFTER INSERT ON "approval_requests"
      FOR EACH ROW
      EXECUTE FUNCTION notify_approval_request();
    `);

    await queryRunner.query(`
      -- Function: Notify channel message
      CREATE OR REPLACE FUNCTION notify_channel_message()
      RETURNS TRIGGER AS $$
      BEGIN
        PERFORM pg_notify(
          'channel_message_' || NEW.channel_id::text,
          json_build_object(
            'id', NEW.id,
            'channel_id', NEW.channel_id,
            'sender_type', NEW.sender_type,
            'sender_id', NEW.sender_id,
            'content', substring(NEW.content, 1, 200),
            'thread_parent_id', NEW.thread_parent_id
          )::text
        );
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      CREATE TRIGGER trigger_notify_channel_message
      AFTER INSERT ON "channel_messages"
      FOR EACH ROW
      EXECUTE FUNCTION notify_channel_message();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_notify_channel_message ON "channel_messages"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_notify_approval_request ON "approval_requests"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_notify_holon_status_change ON "hollons"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trigger_notify_new_message ON "messages"`,
    );

    // Drop functions
    await queryRunner.query(`DROP FUNCTION IF EXISTS notify_channel_message()`);
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS notify_approval_request()`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS notify_holon_status_change()`,
    );
    await queryRunner.query(`DROP FUNCTION IF EXISTS notify_new_message()`);

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "channel_messages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "channel_memberships"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "channel_role_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "channels"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "channel_type_enum"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversation_history"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "conversations"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "messages"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "participant_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "message_type_enum"`);
  }
}
