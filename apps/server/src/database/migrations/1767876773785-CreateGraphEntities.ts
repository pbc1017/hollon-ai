import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGraphEntities1767876773785 implements MigrationInterface {
  name = 'CreateGraphEntities1767876773785';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create enum types for Node and Edge
    await queryRunner.query(`
      CREATE TYPE "hollon"."knowledge_graph_nodes_type_enum" AS ENUM(
        'person', 'organization', 'team', 'task', 'document', 'code', 
        'concept', 'goal', 'skill', 'tool', 'custom'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "hollon"."knowledge_graph_edges_type_enum" AS ENUM(
        'relates_to', 'derived_from', 'contradicts', 'supports', 'extends',
        'prerequisite_of', 'part_of', 'child_of', 'references', 'implements',
        'manages', 'created_by', 'belongs_to', 'depends_on', 'collaborates_with',
        'refutes', 'similar_to', 'explains', 'exemplifies', 'custom'
      )
    `);

    // Create knowledge_graph_nodes table
    await queryRunner.query(`
      CREATE TABLE "knowledge_graph_nodes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "name" character varying(255) NOT NULL,
        "type" "hollon"."knowledge_graph_nodes_type_enum" NOT NULL DEFAULT 'custom',
        "description" text,
        "organization_id" uuid NOT NULL,
        "properties" jsonb NOT NULL DEFAULT '{}',
        "tags" text array NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "embedding" text,
        CONSTRAINT "PK_knowledge_graph_nodes" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for knowledge_graph_nodes
    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_graph_nodes_type" 
      ON "knowledge_graph_nodes" ("type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_graph_nodes_organization" 
      ON "knowledge_graph_nodes" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_graph_nodes_created_at" 
      ON "knowledge_graph_nodes" ("created_at")
    `);

    // Create GIN index on properties JSONB column for efficient querying
    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_graph_nodes_properties" 
      ON "knowledge_graph_nodes" USING GIN ("properties")
    `);

    // Create knowledge_graph_edges table
    await queryRunner.query(`
      CREATE TABLE "knowledge_graph_edges" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        "source_node_id" uuid NOT NULL,
        "target_node_id" uuid NOT NULL,
        "type" "hollon"."knowledge_graph_edges_type_enum" NOT NULL DEFAULT 'relates_to',
        "organization_id" uuid NOT NULL,
        "weight" double precision NOT NULL DEFAULT '1',
        "properties" jsonb NOT NULL DEFAULT '{}',
        "is_active" boolean NOT NULL DEFAULT true,
        "embedding" text,
        CONSTRAINT "PK_knowledge_graph_edges" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for knowledge_graph_edges
    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_graph_edges_type" 
      ON "knowledge_graph_edges" ("type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_graph_edges_source_target" 
      ON "knowledge_graph_edges" ("source_node_id", "target_node_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_graph_edges_source_type" 
      ON "knowledge_graph_edges" ("source_node_id", "type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_graph_edges_target_type" 
      ON "knowledge_graph_edges" ("target_node_id", "type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_graph_edges_organization" 
      ON "knowledge_graph_edges" ("organization_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_graph_edges_created_at" 
      ON "knowledge_graph_edges" ("created_at")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_graph_edges_org_type" 
      ON "knowledge_graph_edges" ("organization_id", "type")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_graph_edges_org_active" 
      ON "knowledge_graph_edges" ("organization_id", "is_active")
    `);

    // Create GIN index on properties JSONB column for efficient querying
    await queryRunner.query(`
      CREATE INDEX "IDX_knowledge_graph_edges_properties" 
      ON "knowledge_graph_edges" USING GIN ("properties")
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "knowledge_graph_edges" 
      ADD CONSTRAINT "FK_knowledge_graph_edges_source_node" 
      FOREIGN KEY ("source_node_id") 
      REFERENCES "knowledge_graph_nodes"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);

    await queryRunner.query(`
      ALTER TABLE "knowledge_graph_edges" 
      ADD CONSTRAINT "FK_knowledge_graph_edges_target_node" 
      FOREIGN KEY ("target_node_id") 
      REFERENCES "knowledge_graph_nodes"("id") 
      ON DELETE CASCADE ON UPDATE NO ACTION
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "knowledge_graph_edges" 
      DROP CONSTRAINT "FK_knowledge_graph_edges_target_node"
    `);

    await queryRunner.query(`
      ALTER TABLE "knowledge_graph_edges" 
      DROP CONSTRAINT "FK_knowledge_graph_edges_source_node"
    `);

    // Drop indexes for knowledge_graph_edges
    await queryRunner.query(`
      DROP INDEX "hollon"."IDX_knowledge_graph_edges_properties"
    `);

    await queryRunner.query(`
      DROP INDEX "hollon"."IDX_knowledge_graph_edges_org_active"
    `);

    await queryRunner.query(`
      DROP INDEX "hollon"."IDX_knowledge_graph_edges_org_type"
    `);

    await queryRunner.query(`
      DROP INDEX "hollon"."IDX_knowledge_graph_edges_created_at"
    `);

    await queryRunner.query(`
      DROP INDEX "hollon"."IDX_knowledge_graph_edges_organization"
    `);

    await queryRunner.query(`
      DROP INDEX "hollon"."IDX_knowledge_graph_edges_target_type"
    `);

    await queryRunner.query(`
      DROP INDEX "hollon"."IDX_knowledge_graph_edges_source_type"
    `);

    await queryRunner.query(`
      DROP INDEX "hollon"."IDX_knowledge_graph_edges_source_target"
    `);

    await queryRunner.query(`
      DROP INDEX "hollon"."IDX_knowledge_graph_edges_type"
    `);

    // Drop knowledge_graph_edges table
    await queryRunner.query(`DROP TABLE "knowledge_graph_edges"`);

    // Drop indexes for knowledge_graph_nodes
    await queryRunner.query(`
      DROP INDEX "hollon"."IDX_knowledge_graph_nodes_properties"
    `);

    await queryRunner.query(`
      DROP INDEX "hollon"."IDX_knowledge_graph_nodes_created_at"
    `);

    await queryRunner.query(`
      DROP INDEX "hollon"."IDX_knowledge_graph_nodes_organization"
    `);

    await queryRunner.query(`
      DROP INDEX "hollon"."IDX_knowledge_graph_nodes_type"
    `);

    // Drop knowledge_graph_nodes table
    await queryRunner.query(`DROP TABLE "knowledge_graph_nodes"`);

    // Drop enum types
    await queryRunner.query(`
      DROP TYPE "hollon"."knowledge_graph_edges_type_enum"
    `);

    await queryRunner.query(`
      DROP TYPE "hollon"."knowledge_graph_nodes_type_enum"
    `);
  }
}
