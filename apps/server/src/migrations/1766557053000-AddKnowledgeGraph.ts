import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Foundation: Knowledge Graph
 *
 * Creates tables for knowledge graph functionality:
 * - knowledge_graph_nodes: Stores graph nodes with flexible properties
 * - knowledge_graph_edges: Stores relationships between nodes
 *
 * Features:
 * - Flexible JSONB properties for extensibility
 * - Comprehensive indexing for query performance
 * - Self-referential relationships via edges
 * - Soft delete pattern (is_active flag)
 */
export class AddKnowledgeGraph1766557053000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create NodeType enum
    await queryRunner.query(`
      CREATE TYPE node_type AS ENUM (
        'person',
        'organization',
        'team',
        'task',
        'document',
        'code',
        'concept',
        'goal',
        'skill',
        'tool',
        'custom'
      )
    `);

    // Create EdgeType enum
    await queryRunner.query(`
      CREATE TYPE edge_type AS ENUM (
        'created_by',
        'belongs_to',
        'manages',
        'collaborates_with',
        'depends_on',
        'references',
        'implements',
        'derives_from',
        'related_to',
        'child_of',
        'part_of',
        'custom'
      )
    `);

    // Create knowledge_graph_nodes table
    await queryRunner.query(`
      CREATE TABLE knowledge_graph_nodes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        type node_type NOT NULL DEFAULT 'custom',
        description TEXT,
        organization_id UUID NOT NULL,
        properties JSONB NOT NULL DEFAULT '{}',
        tags TEXT[] NOT NULL DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);

    // Create indexes for nodes
    await queryRunner.query(`
      CREATE INDEX idx_knowledge_graph_nodes_type
      ON knowledge_graph_nodes(type)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_knowledge_graph_nodes_organization_id
      ON knowledge_graph_nodes(organization_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_knowledge_graph_nodes_created_at
      ON knowledge_graph_nodes(created_at)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_knowledge_graph_nodes_is_active
      ON knowledge_graph_nodes(is_active)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_knowledge_graph_nodes_properties
      ON knowledge_graph_nodes USING gin(properties)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_knowledge_graph_nodes_tags
      ON knowledge_graph_nodes USING gin(tags)
    `);

    // Create knowledge_graph_edges table
    await queryRunner.query(`
      CREATE TABLE knowledge_graph_edges (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        source_node_id UUID NOT NULL,
        target_node_id UUID NOT NULL,
        type edge_type NOT NULL DEFAULT 'related_to',
        organization_id UUID NOT NULL,
        weight FLOAT NOT NULL DEFAULT 1.0,
        properties JSONB NOT NULL DEFAULT '{}',
        is_active BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMP NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
        CONSTRAINT fk_edges_source_node
          FOREIGN KEY (source_node_id)
          REFERENCES knowledge_graph_nodes(id)
          ON DELETE CASCADE,
        CONSTRAINT fk_edges_target_node
          FOREIGN KEY (target_node_id)
          REFERENCES knowledge_graph_nodes(id)
          ON DELETE CASCADE
      )
    `);

    // Create indexes for edges
    await queryRunner.query(`
      CREATE INDEX idx_knowledge_graph_edges_type
      ON knowledge_graph_edges(type)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_knowledge_graph_edges_source_target
      ON knowledge_graph_edges(source_node_id, target_node_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_knowledge_graph_edges_source_type
      ON knowledge_graph_edges(source_node_id, type)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_knowledge_graph_edges_target_type
      ON knowledge_graph_edges(target_node_id, type)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_knowledge_graph_edges_organization_id
      ON knowledge_graph_edges(organization_id)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_knowledge_graph_edges_created_at
      ON knowledge_graph_edges(created_at)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_knowledge_graph_edges_is_active
      ON knowledge_graph_edges(is_active)
    `);

    await queryRunner.query(`
      CREATE INDEX idx_knowledge_graph_edges_properties
      ON knowledge_graph_edges USING gin(properties)
    `);

    // Add comments for documentation
    await queryRunner.query(`
      COMMENT ON TABLE knowledge_graph_nodes IS
      'Nodes in the knowledge graph representing various entities and concepts'
    `);

    await queryRunner.query(`
      COMMENT ON TABLE knowledge_graph_edges IS
      'Edges in the knowledge graph representing relationships between nodes'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS knowledge_graph_edges`);
    await queryRunner.query(`DROP TABLE IF EXISTS knowledge_graph_nodes`);

    // Drop enums
    await queryRunner.query(`DROP TYPE IF EXISTS edge_type`);
    await queryRunner.query(`DROP TYPE IF EXISTS node_type`);
  }
}
