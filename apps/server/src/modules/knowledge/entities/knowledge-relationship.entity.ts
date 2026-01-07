import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Knowledge } from './knowledge.entity';

/**
 * Enum defining the types of relationships between knowledge items.
 * Supports semantic relationships for knowledge graph construction.
 */
export enum KnowledgeRelationshipType {
  // Basic relationships
  RELATES_TO = 'relates_to', // Generic relationship
  DERIVED_FROM = 'derived_from', // Knowledge derived or extracted from another
  CONTRADICTS = 'contradicts', // Conflicting or contradictory knowledge
  SUPPORTS = 'supports', // Supporting or confirming evidence
  EXTENDS = 'extends', // Builds upon or extends existing knowledge

  // Hierarchical relationships
  PARENT_OF = 'parent_of', // Parent in knowledge hierarchy
  CHILD_OF = 'child_of', // Child in knowledge hierarchy
  PART_OF = 'part_of', // Component of a larger knowledge concept

  // Dependency relationships
  DEPENDS_ON = 'depends_on', // Requires another knowledge item to be understood
  PREREQUISITE_FOR = 'prerequisite_for', // Must be understood before another
  FOLLOWS = 'follows', // Temporal or logical sequence

  // Reference relationships
  REFERENCES = 'references', // Cites or refers to another knowledge item
  CITED_BY = 'cited_by', // Is referenced by another knowledge item
  SIMILAR_TO = 'similar_to', // Similar content or concept

  // Versioning relationships
  SUPERSEDES = 'supersedes', // Replaces outdated knowledge
  SUPERSEDED_BY = 'superseded_by', // Has been replaced by newer knowledge
  VERSION_OF = 'version_of', // Different version of same knowledge

  // Application relationships
  APPLIED_IN = 'applied_in', // Knowledge used in a specific context
  EXAMPLE_OF = 'example_of', // Concrete example of general knowledge
  GENERALIZES = 'generalizes', // General principle from specific cases

  // Custom relationship
  CUSTOM = 'custom', // User-defined relationship type
}

/**
 * Entity representing relationships between knowledge items.
 * Supports bidirectional relationships and self-referential knowledge graphs.
 *
 * Design considerations:
 * - Bidirectional: Create reciprocal relationships when needed (e.g., PARENT_OF <-> CHILD_OF)
 * - Self-referential: Both source and target can reference the same knowledge table
 * - Flexible metadata: JSON column for relationship-specific properties
 * - Indexed for performance: Multiple indexes for common query patterns
 */
@Entity('knowledge_relationships')
@Index(['relationshipType'])
@Index(['sourceId', 'targetId'])
@Index(['sourceId', 'relationshipType'])
@Index(['targetId', 'relationshipType'])
@Index(['sourceId', 'targetId', 'relationshipType'], { unique: true })
@Index(['createdAt'])
@Index(['isActive'])
export class KnowledgeRelationship extends BaseEntity {
  /**
   * UUID of the source knowledge item in the relationship.
   * Foreign key to knowledge.id.
   */
  @Column({ name: 'source_id', type: 'uuid' })
  sourceId: string;

  /**
   * UUID of the target knowledge item in the relationship.
   * Foreign key to knowledge.id.
   * Can be the same as sourceId for self-referential relationships.
   */
  @Column({ name: 'target_id', type: 'uuid' })
  targetId: string;

  /**
   * Type of relationship between source and target knowledge items.
   * Uses KnowledgeRelationshipType enum for semantic meaning.
   */
  @Column({
    name: 'relationship_type',
    type: 'enum',
    enum: KnowledgeRelationshipType,
  })
  relationshipType: KnowledgeRelationshipType;

  /**
   * Flexible JSON metadata for relationship-specific properties.
   * Examples:
   * - confidence: number (0-1) for ML-derived relationships
   * - strength: number for relationship weight
   * - context: string for relationship context
   * - derivedBy: string for automatic relationship creation metadata
   * - customType: string when relationshipType is CUSTOM
   */
  @Column({ type: 'jsonb', default: {} })
  metadata: Record<string, any>;

  /**
   * Optional weight for weighted relationship graphs.
   * Can be used for:
   * - Relationship strength scoring
   * - Graph traversal prioritization
   * - Relevance ranking
   * Default: 1.0
   */
  @Column({ type: 'float', default: 1.0 })
  weight: number;

  /**
   * Soft delete flag for relationship lifecycle management.
   * Allows preserving relationship history while marking as inactive.
   * Default: true
   */
  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  /**
   * Bidirectional flag to indicate if reciprocal relationship exists.
   * If true, implies a corresponding relationship exists with source/target swapped.
   * Useful for symmetric relationships (e.g., SIMILAR_TO, RELATES_TO).
   * Default: false
   */
  @Column({ name: 'is_bidirectional', default: false })
  isBidirectional: boolean;

  // Relations
  /**
   * Many-to-One relationship to source Knowledge entity.
   * Cascade delete: removes relationship when source knowledge is deleted.
   */
  @ManyToOne(() => Knowledge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'source_id' })
  source: Knowledge;

  /**
   * Many-to-One relationship to target Knowledge entity.
   * Cascade delete: removes relationship when target knowledge is deleted.
   */
  @ManyToOne(() => Knowledge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'target_id' })
  target: Knowledge;
}
