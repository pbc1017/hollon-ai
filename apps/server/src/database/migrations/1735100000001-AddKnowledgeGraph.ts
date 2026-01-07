import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddKnowledgeGraph1735100000001 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Node type enum
    await queryRunner.query(`
      CREATE TYPE "node_type_enum" AS ENUM (
        'concept',
        'entity',
        'event',
        'attribute',
        'task',
        'hollon',
        'document'
      );
    `);

    // Edge type enum
    await queryRunner.query(`
      CREATE TYPE "edge_type_enum" AS ENUM (
        'related_to',
        'depends_on',
        'part_of',
        'causes',
        'assigned_to',
        'created_by',
        'references',
        'follows'
      );
    `);

    // Graph nodes table
    await queryRunner.query(`
      CREATE TABLE "graph_nodes" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "node_type" node_type_enum NOT NULL,
        "label" varchar(255) NOT NULL,
        "description" text,
        "properties" jsonb,
        "external_id" uuid,
        "external_type" varchar(100),
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now()
      );
    `);

    // Graph edges table
    await queryRunner.query(`
      CREATE TABLE "graph_edges" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "organization_id" uuid NOT NULL,
        "source_node_id" uuid NOT NULL,
        "target_node_id" uuid NOT NULL,
        "edge_type" edge_type_enum NOT NULL,
        "weight" float,
        "properties" jsonb,
        "created_at" timestamp NOT NULL DEFAULT now(),
        "updated_at" timestamp NOT NULL DEFAULT now(),
        CONSTRAINT "FK_graph_edges_source_node"
          FOREIGN KEY ("source_node_id") REFERENCES "graph_nodes"("id")
          ON DELETE CASCADE,
        CONSTRAINT "FK_graph_edges_target_node"
          FOREIGN KEY ("target_node_id") REFERENCES "graph_nodes"("id")
          ON DELETE CASCADE
      );
    `);

    // Indexes for graph nodes
    await queryRunner.query(`
      CREATE INDEX "IDX_graph_nodes_organization_node_type"
      ON "graph_nodes" ("organization_id", "node_type");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_graph_nodes_organization_label"
      ON "graph_nodes" ("organization_id", "label");
    `);

    // Indexes for graph edges
    await queryRunner.query(`
      CREATE INDEX "IDX_graph_edges_organization_edge_type"
      ON "graph_edges" ("organization_id", "edge_type");
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_graph_edges_source_target"
      ON "graph_edges" ("source_node_id", "target_node_id");
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop indexes
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_graph_edges_source_target"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_graph_edges_organization_edge_type"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_graph_nodes_organization_label"`,
    );
    await queryRunner.query(
      `DROP INDEX IF EXISTS "IDX_graph_nodes_organization_node_type"`,
    );

    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS "graph_edges"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "graph_nodes"`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS "edge_type_enum"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "node_type_enum"`);
  }
}
