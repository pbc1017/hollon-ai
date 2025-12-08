import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddMessageConversationFields1733950000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add message priority enum
    await queryRunner.query(`
      CREATE TYPE "message_priority_enum" AS ENUM (
        'low',
        'normal',
        'high',
        'urgent'
      );
    `);

    // Add conversation context enum
    await queryRunner.query(`
      CREATE TYPE "conversation_context_enum" AS ENUM (
        'task',
        'collaboration',
        'escalation',
        'review',
        'general'
      );
    `);

    // Add conversation_id column to messages
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN "conversation_id" uuid;
    `);

    // Add FK constraint for conversation_id
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD CONSTRAINT "FK_messages_conversation"
      FOREIGN KEY ("conversation_id")
      REFERENCES "conversations"("id")
      ON DELETE CASCADE;
    `);

    // Add priority column to messages
    await queryRunner.query(`
      ALTER TABLE "messages"
      ADD COLUMN "priority" message_priority_enum NOT NULL DEFAULT 'normal';
    `);

    // Add context column to conversations
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD COLUMN "context" conversation_context_enum NOT NULL DEFAULT 'general';
    `);

    // Add context_id column to conversations
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD COLUMN "context_id" uuid;
    `);

    // Add unread_count column to conversations
    await queryRunner.query(`
      ALTER TABLE "conversations"
      ADD COLUMN "unread_count" integer NOT NULL DEFAULT 0;
    `);

    // Create index for conversation_id on messages
    await queryRunner.query(`
      CREATE INDEX "IDX_messages_conversation"
      ON "messages" ("conversation_id", "created_at" DESC);
    `);

    // Create index for context on conversations
    await queryRunner.query(`
      CREATE INDEX "IDX_conversations_context"
      ON "conversations" ("context", "context_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_conversations_context"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_messages_conversation"`);

    // Drop columns from conversations
    await queryRunner.query(`
      ALTER TABLE "conversations" DROP COLUMN IF EXISTS "unread_count";
    `);
    await queryRunner.query(`
      ALTER TABLE "conversations" DROP COLUMN IF EXISTS "context_id";
    `);
    await queryRunner.query(`
      ALTER TABLE "conversations" DROP COLUMN IF EXISTS "context";
    `);

    // Drop priority column from messages
    await queryRunner.query(`
      ALTER TABLE "messages" DROP COLUMN IF EXISTS "priority";
    `);

    // Drop FK constraint and conversation_id column from messages
    await queryRunner.query(`
      ALTER TABLE "messages" DROP CONSTRAINT IF EXISTS "FK_messages_conversation";
    `);
    await queryRunner.query(`
      ALTER TABLE "messages" DROP COLUMN IF EXISTS "conversation_id";
    `);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "conversation_context_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "message_priority_enum"`);
  }
}
