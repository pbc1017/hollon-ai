/**
 * Relationship Types for Knowledge Graph Edges
 *
 * Comprehensive enumeration of semantic relationship types that can exist between
 * knowledge graph nodes. These types define the nature and meaning of connections
 * in the knowledge graph, enabling sophisticated reasoning and inference.
 *
 * @remarks
 * This enum serves as the single source of truth (SSOT) for all relationship types
 * used throughout the knowledge graph system. Each type has specific semantics that
 * should be consistently applied across the application.
 */
export enum RelationshipType {
  /**
   * General association between two entities without specific semantic meaning.
   * Use when a relationship exists but doesn't fit other specific types.
   *
   * @example NodeA RELATES_TO NodeB (general connection)
   */
  RELATES_TO = 'relates_to',

  /**
   * Indicates that the target entity is derived, extracted, or originated from the source.
   * Represents a lineage or provenance relationship.
   *
   * @example Summary DERIVED_FROM OriginalDocument
   * @example Insight DERIVED_FROM DataAnalysis
   */
  DERIVED_FROM = 'derived_from',

  /**
   * Indicates logical contradiction or mutual exclusivity between entities.
   * Useful for conflict detection and consistency checking.
   *
   * @example Hypothesis1 CONTRADICTS Hypothesis2
   * @example Statement1 CONTRADICTS Statement2
   */
  CONTRADICTS = 'contradicts',

  /**
   * Indicates that the source provides evidence or reinforcement for the target.
   * Represents an evidential or corroborative relationship.
   *
   * @example Evidence SUPPORTS Claim
   * @example DataPoint SUPPORTS Theory
   */
  SUPPORTS = 'supports',

  /**
   * Indicates that the source builds upon or enhances the target entity.
   * Represents an extension or enhancement relationship.
   *
   * @example AdvancedConcept EXTENDS BasicConcept
   * @example NewFeature EXTENDS ExistingFeature
   */
  EXTENDS = 'extends',

  /**
   * Indicates that the target must be understood or completed before the source.
   * Represents a dependency in learning or execution order.
   *
   * @example AdvancedTopic PREREQUISITE_OF BasicTopic
   * @example Task1 PREREQUISITE_OF Task2
   */
  PREREQUISITE_OF = 'prerequisite_of',

  /**
   * Indicates that the source is a component or member of the target.
   * Represents a part-whole relationship.
   *
   * @example Chapter PART_OF Book
   * @example Module PART_OF System
   */
  PART_OF = 'part_of',

  /**
   * Indicates that the source is a more specific instance of the target category.
   * Represents a subtype or subclass relationship.
   *
   * @example Car CHILD_OF Vehicle
   * @example SubCategory CHILD_OF Category
   */
  CHILD_OF = 'child_of',

  /**
   * Indicates that the source cites, mentions, or points to the target.
   * Represents a citation or reference relationship.
   *
   * @example Document REFERENCES Source
   * @example Article REFERENCES Study
   */
  REFERENCES = 'references',

  /**
   * Indicates that the source realizes or fulfills the specification of the target.
   * Represents an implementation relationship.
   *
   * @example ConcreteClass IMPLEMENTS Interface
   * @example Solution IMPLEMENTS Specification
   */
  IMPLEMENTS = 'implements',

  /**
   * Indicates that the source has control, authority, or responsibility over the target.
   * Represents a management or oversight relationship.
   *
   * @example Manager MANAGES Project
   * @example System MANAGES Resources
   */
  MANAGES = 'manages',

  /**
   * Indicates that the source was responsible for creating the target.
   * Represents an authorship or creation relationship.
   *
   * @example Author CREATED_BY Document
   * @example User CREATED_BY Account
   */
  CREATED_BY = 'created_by',

  /**
   * Indicates that the source is associated with or owned by the target organization/group.
   * Represents an ownership or membership relationship.
   *
   * @example Resource BELONGS_TO Organization
   * @example Member BELONGS_TO Group
   */
  BELONGS_TO = 'belongs_to',

  /**
   * Indicates that the source has a dependency on the target.
   * Represents a functional or operational dependency.
   *
   * @example Service DEPENDS_ON Library
   * @example Task DEPENDS_ON Resource
   */
  DEPENDS_ON = 'depends_on',

  /**
   * Indicates that the source works together with the target.
   * Represents a collaborative or cooperative relationship.
   *
   * @example TeamA COLLABORATES_WITH TeamB
   * @example Agent1 COLLABORATES_WITH Agent2
   */
  COLLABORATES_WITH = 'collaborates_with',

  /**
   * Indicates that the source negates or refutes the target.
   * Represents a contradictory or oppositional relationship.
   *
   * @example Evidence REFUTES Claim
   * @example Study REFUTES Theory
   */
  REFUTES = 'refutes',

  /**
   * Indicates that the source is functionally equivalent to the target.
   * Represents a similarity or equivalence relationship.
   *
   * @example Concept1 SIMILAR_TO Concept2
   * @example Approach1 SIMILAR_TO Approach2
   */
  SIMILAR_TO = 'similar_to',

  /**
   * Indicates that the source provides clarification or explanation of the target.
   * Represents an explanatory relationship.
   *
   * @example Definition EXPLAINS Term
   * @example Tutorial EXPLAINS Concept
   */
  EXPLAINS = 'explains',

  /**
   * Indicates that the source serves as a practical demonstration of the target.
   * Represents an exemplification relationship.
   *
   * @example UseCase EXEMPLIFIES Pattern
   * @example Example EXEMPLIFIES Principle
   */
  EXEMPLIFIES = 'exemplifies',

  /**
   * Custom relationship type for domain-specific relationships not covered by predefined types.
   * Additional semantics should be stored in the edge properties.
   *
   * @example CustomRelationship CUSTOM AnotherEntity (with properties defining the custom type)
   */
  CUSTOM = 'custom',
}
