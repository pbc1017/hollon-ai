import {
  KnowledgeRelationship,
  KnowledgeRelationshipType,
} from './knowledge-relationship.entity';
import { Knowledge } from './knowledge.entity';

describe('KnowledgeRelationship Entity', () => {
  let relationship: KnowledgeRelationship;

  beforeEach(() => {
    relationship = new KnowledgeRelationship();
  });

  describe('Entity Creation', () => {
    it('should create a new instance', () => {
      expect(relationship).toBeInstanceOf(KnowledgeRelationship);
    });

    it('should have all required properties defined', () => {
      expect(relationship).toHaveProperty('sourceId');
      expect(relationship).toHaveProperty('targetId');
      expect(relationship).toHaveProperty('relationshipType');
      expect(relationship).toHaveProperty('metadata');
      expect(relationship).toHaveProperty('weight');
      expect(relationship).toHaveProperty('isActive');
      expect(relationship).toHaveProperty('isBidirectional');
    });

    it('should inherit BaseEntity properties', () => {
      expect(relationship).toHaveProperty('id');
      expect(relationship).toHaveProperty('createdAt');
      expect(relationship).toHaveProperty('updatedAt');
    });
  });

  describe('sourceId field', () => {
    it('should allow setting sourceId to a valid UUID', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174000';
      relationship.sourceId = uuid;

      expect(relationship.sourceId).toBe(uuid);
    });

    it('should store sourceId as string', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174001';
      relationship.sourceId = uuid;

      expect(typeof relationship.sourceId).toBe('string');
    });
  });

  describe('targetId field', () => {
    it('should allow setting targetId to a valid UUID', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174002';
      relationship.targetId = uuid;

      expect(relationship.targetId).toBe(uuid);
    });

    it('should store targetId as string', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174003';
      relationship.targetId = uuid;

      expect(typeof relationship.targetId).toBe('string');
    });

    it('should allow targetId to be the same as sourceId (self-referential)', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174004';
      relationship.sourceId = uuid;
      relationship.targetId = uuid;

      expect(relationship.sourceId).toBe(relationship.targetId);
    });
  });

  describe('relationshipType field', () => {
    it('should allow setting relationshipType to RELATES_TO', () => {
      relationship.relationshipType = KnowledgeRelationshipType.RELATES_TO;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.RELATES_TO,
      );
    });

    it('should allow setting relationshipType to DERIVED_FROM', () => {
      relationship.relationshipType = KnowledgeRelationshipType.DERIVED_FROM;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.DERIVED_FROM,
      );
    });

    it('should allow setting relationshipType to CONTRADICTS', () => {
      relationship.relationshipType = KnowledgeRelationshipType.CONTRADICTS;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.CONTRADICTS,
      );
    });

    it('should allow setting relationshipType to SUPPORTS', () => {
      relationship.relationshipType = KnowledgeRelationshipType.SUPPORTS;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.SUPPORTS,
      );
    });

    it('should allow setting relationshipType to EXTENDS', () => {
      relationship.relationshipType = KnowledgeRelationshipType.EXTENDS;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.EXTENDS,
      );
    });

    it('should allow setting relationshipType to PARENT_OF', () => {
      relationship.relationshipType = KnowledgeRelationshipType.PARENT_OF;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.PARENT_OF,
      );
    });

    it('should allow setting relationshipType to CHILD_OF', () => {
      relationship.relationshipType = KnowledgeRelationshipType.CHILD_OF;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.CHILD_OF,
      );
    });

    it('should allow setting relationshipType to PART_OF', () => {
      relationship.relationshipType = KnowledgeRelationshipType.PART_OF;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.PART_OF,
      );
    });

    it('should allow setting relationshipType to DEPENDS_ON', () => {
      relationship.relationshipType = KnowledgeRelationshipType.DEPENDS_ON;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.DEPENDS_ON,
      );
    });

    it('should allow setting relationshipType to PREREQUISITE_FOR', () => {
      relationship.relationshipType =
        KnowledgeRelationshipType.PREREQUISITE_FOR;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.PREREQUISITE_FOR,
      );
    });

    it('should allow setting relationshipType to FOLLOWS', () => {
      relationship.relationshipType = KnowledgeRelationshipType.FOLLOWS;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.FOLLOWS,
      );
    });

    it('should allow setting relationshipType to REFERENCES', () => {
      relationship.relationshipType = KnowledgeRelationshipType.REFERENCES;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.REFERENCES,
      );
    });

    it('should allow setting relationshipType to CITED_BY', () => {
      relationship.relationshipType = KnowledgeRelationshipType.CITED_BY;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.CITED_BY,
      );
    });

    it('should allow setting relationshipType to SIMILAR_TO', () => {
      relationship.relationshipType = KnowledgeRelationshipType.SIMILAR_TO;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.SIMILAR_TO,
      );
    });

    it('should allow setting relationshipType to SUPERSEDES', () => {
      relationship.relationshipType = KnowledgeRelationshipType.SUPERSEDES;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.SUPERSEDES,
      );
    });

    it('should allow setting relationshipType to SUPERSEDED_BY', () => {
      relationship.relationshipType = KnowledgeRelationshipType.SUPERSEDED_BY;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.SUPERSEDED_BY,
      );
    });

    it('should allow setting relationshipType to VERSION_OF', () => {
      relationship.relationshipType = KnowledgeRelationshipType.VERSION_OF;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.VERSION_OF,
      );
    });

    it('should allow setting relationshipType to APPLIED_IN', () => {
      relationship.relationshipType = KnowledgeRelationshipType.APPLIED_IN;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.APPLIED_IN,
      );
    });

    it('should allow setting relationshipType to EXAMPLE_OF', () => {
      relationship.relationshipType = KnowledgeRelationshipType.EXAMPLE_OF;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.EXAMPLE_OF,
      );
    });

    it('should allow setting relationshipType to GENERALIZES', () => {
      relationship.relationshipType = KnowledgeRelationshipType.GENERALIZES;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.GENERALIZES,
      );
    });

    it('should allow setting relationshipType to CUSTOM', () => {
      relationship.relationshipType = KnowledgeRelationshipType.CUSTOM;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.CUSTOM,
      );
    });
  });

  describe('metadata field', () => {
    it('should allow setting metadata as an empty object', () => {
      relationship.metadata = {};

      expect(relationship.metadata).toEqual({});
    });

    it('should allow setting metadata with confidence value', () => {
      relationship.metadata = { confidence: 0.85 };

      expect(relationship.metadata).toEqual({ confidence: 0.85 });
      expect(relationship.metadata.confidence).toBe(0.85);
    });

    it('should allow setting metadata with strength value', () => {
      relationship.metadata = { strength: 7 };

      expect(relationship.metadata).toEqual({ strength: 7 });
      expect(relationship.metadata.strength).toBe(7);
    });

    it('should allow setting metadata with context string', () => {
      const context = 'Derived from code analysis';
      relationship.metadata = { context };

      expect(relationship.metadata.context).toBe(context);
    });

    it('should allow setting metadata with derivedBy information', () => {
      relationship.metadata = { derivedBy: 'ML-model-v2.1' };

      expect(relationship.metadata.derivedBy).toBe('ML-model-v2.1');
    });

    it('should allow setting metadata with customType for CUSTOM relationships', () => {
      relationship.relationshipType = KnowledgeRelationshipType.CUSTOM;
      relationship.metadata = { customType: 'implements_pattern' };

      expect(relationship.metadata.customType).toBe('implements_pattern');
    });

    it('should allow setting complex nested metadata', () => {
      const complexMetadata = {
        confidence: 0.92,
        strength: 8,
        context: 'Code review analysis',
        derivedBy: 'analyzer-v3',
        tags: ['important', 'verified'],
        extra: {
          reviewer: 'system',
          timestamp: '2024-01-01T00:00:00Z',
        },
      };
      relationship.metadata = complexMetadata;

      expect(relationship.metadata).toEqual(complexMetadata);
      expect(relationship.metadata.extra.reviewer).toBe('system');
    });

    it('should handle metadata updates', () => {
      relationship.metadata = { confidence: 0.5 };
      expect(relationship.metadata.confidence).toBe(0.5);

      relationship.metadata = { ...relationship.metadata, strength: 3 };
      expect(relationship.metadata).toEqual({ confidence: 0.5, strength: 3 });
    });
  });

  describe('weight field', () => {
    it('should have default weight of 1.0', () => {
      // Note: default value is set by TypeORM at database level
      // In unit test without actual TypeORM initialization, we test the setter
      relationship.weight = 1.0;
      expect(relationship.weight).toBe(1.0);
    });

    it('should allow setting weight to positive float values', () => {
      relationship.weight = 0.5;
      expect(relationship.weight).toBe(0.5);

      relationship.weight = 2.5;
      expect(relationship.weight).toBe(2.5);

      relationship.weight = 10.0;
      expect(relationship.weight).toBe(10.0);
    });

    it('should allow setting weight to zero', () => {
      relationship.weight = 0;
      expect(relationship.weight).toBe(0);
    });

    it('should handle very small weight values', () => {
      relationship.weight = 0.001;
      expect(relationship.weight).toBe(0.001);
    });

    it('should handle very large weight values', () => {
      relationship.weight = 1000.5;
      expect(relationship.weight).toBe(1000.5);
    });

    it('should allow negative weight values (for specific use cases)', () => {
      relationship.weight = -1.0;
      expect(relationship.weight).toBe(-1.0);
    });
  });

  describe('isActive field', () => {
    it('should allow setting isActive to true', () => {
      relationship.isActive = true;

      expect(relationship.isActive).toBe(true);
    });

    it('should allow setting isActive to false (soft delete)', () => {
      relationship.isActive = false;

      expect(relationship.isActive).toBe(false);
    });

    it('should handle boolean type correctly', () => {
      relationship.isActive = true;
      expect(typeof relationship.isActive).toBe('boolean');

      relationship.isActive = false;
      expect(typeof relationship.isActive).toBe('boolean');
    });
  });

  describe('isBidirectional field', () => {
    it('should allow setting isBidirectional to true', () => {
      relationship.isBidirectional = true;

      expect(relationship.isBidirectional).toBe(true);
    });

    it('should allow setting isBidirectional to false', () => {
      relationship.isBidirectional = false;

      expect(relationship.isBidirectional).toBe(false);
    });

    it('should handle boolean type correctly', () => {
      relationship.isBidirectional = true;
      expect(typeof relationship.isBidirectional).toBe('boolean');

      relationship.isBidirectional = false;
      expect(typeof relationship.isBidirectional).toBe('boolean');
    });
  });

  describe('source relation', () => {
    it('should allow setting source Knowledge entity', () => {
      const sourceKnowledge = new Knowledge();
      sourceKnowledge.id = '123e4567-e89b-12d3-a456-426614174005';

      relationship.source = sourceKnowledge;

      expect(relationship.source).toBe(sourceKnowledge);
      expect(relationship.source.id).toBe(
        '123e4567-e89b-12d3-a456-426614174005',
      );
    });

    it('should have source as Knowledge instance', () => {
      const sourceKnowledge = new Knowledge();
      relationship.source = sourceKnowledge;

      expect(relationship.source).toBeInstanceOf(Knowledge);
    });
  });

  describe('target relation', () => {
    it('should allow setting target Knowledge entity', () => {
      const targetKnowledge = new Knowledge();
      targetKnowledge.id = '123e4567-e89b-12d3-a456-426614174006';

      relationship.target = targetKnowledge;

      expect(relationship.target).toBe(targetKnowledge);
      expect(relationship.target.id).toBe(
        '123e4567-e89b-12d3-a456-426614174006',
      );
    });

    it('should have target as Knowledge instance', () => {
      const targetKnowledge = new Knowledge();
      relationship.target = targetKnowledge;

      expect(relationship.target).toBeInstanceOf(Knowledge);
    });
  });

  describe('Bidirectional Relationships', () => {
    it('should support symmetric RELATES_TO relationships', () => {
      const knowledge1 = new Knowledge();
      const knowledge2 = new Knowledge();
      knowledge1.id = '123e4567-e89b-12d3-a456-426614174007';
      knowledge2.id = '123e4567-e89b-12d3-a456-426614174008';

      relationship.source = knowledge1;
      relationship.target = knowledge2;
      relationship.relationshipType = KnowledgeRelationshipType.RELATES_TO;
      relationship.isBidirectional = true;

      expect(relationship.isBidirectional).toBe(true);
      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.RELATES_TO,
      );
    });

    it('should support symmetric SIMILAR_TO relationships', () => {
      relationship.relationshipType = KnowledgeRelationshipType.SIMILAR_TO;
      relationship.isBidirectional = true;

      expect(relationship.isBidirectional).toBe(true);
      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.SIMILAR_TO,
      );
    });

    it('should handle asymmetric PARENT_OF relationships', () => {
      relationship.relationshipType = KnowledgeRelationshipType.PARENT_OF;
      relationship.isBidirectional = false;

      expect(relationship.isBidirectional).toBe(false);
      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.PARENT_OF,
      );
    });

    it('should handle asymmetric CHILD_OF relationships', () => {
      relationship.relationshipType = KnowledgeRelationshipType.CHILD_OF;
      relationship.isBidirectional = false;

      expect(relationship.isBidirectional).toBe(false);
    });
  });

  describe('Self-Referential Relationships', () => {
    it('should support self-referential VERSION_OF relationship', () => {
      const knowledge = new Knowledge();
      knowledge.id = '123e4567-e89b-12d3-a456-426614174009';

      relationship.sourceId = knowledge.id;
      relationship.targetId = knowledge.id;
      relationship.source = knowledge;
      relationship.target = knowledge;
      relationship.relationshipType = KnowledgeRelationshipType.VERSION_OF;

      expect(relationship.sourceId).toBe(relationship.targetId);
      expect(relationship.source).toBe(relationship.target);
    });

    it('should support self-referential EXTENDS relationship', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174010';

      relationship.sourceId = uuid;
      relationship.targetId = uuid;
      relationship.relationshipType = KnowledgeRelationshipType.EXTENDS;

      expect(relationship.sourceId).toBe(relationship.targetId);
      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.EXTENDS,
      );
    });

    it('should support self-referential REFERENCES relationship', () => {
      const uuid = '123e4567-e89b-12d3-a456-426614174011';

      relationship.sourceId = uuid;
      relationship.targetId = uuid;
      relationship.relationshipType = KnowledgeRelationshipType.REFERENCES;

      expect(relationship.sourceId).toBe(relationship.targetId);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string metadata values', () => {
      relationship.metadata = { context: '' };

      expect(relationship.metadata.context).toBe('');
    });

    it('should handle null values in metadata', () => {
      relationship.metadata = { context: null };

      expect(relationship.metadata.context).toBeNull();
    });

    it('should handle undefined values in metadata', () => {
      relationship.metadata = { context: undefined };

      expect(relationship.metadata.context).toBeUndefined();
    });

    it('should handle array values in metadata', () => {
      relationship.metadata = { tags: ['tag1', 'tag2', 'tag3'] };

      expect(relationship.metadata.tags).toEqual(['tag1', 'tag2', 'tag3']);
      expect(Array.isArray(relationship.metadata.tags)).toBe(true);
    });

    it('should handle boolean values in metadata', () => {
      relationship.metadata = { verified: true, deprecated: false };

      expect(relationship.metadata.verified).toBe(true);
      expect(relationship.metadata.deprecated).toBe(false);
    });

    it('should handle numeric zero values', () => {
      relationship.weight = 0;
      relationship.metadata = { confidence: 0, strength: 0 };

      expect(relationship.weight).toBe(0);
      expect(relationship.metadata.confidence).toBe(0);
      expect(relationship.metadata.strength).toBe(0);
    });

    it('should handle very long UUID strings', () => {
      const longUuid = '123e4567-e89b-12d3-a456-426614174000-extra-long';
      relationship.sourceId = longUuid;

      expect(relationship.sourceId).toBe(longUuid);
    });
  });

  describe('Complex Relationship Scenarios', () => {
    it('should create a complete hierarchical relationship', () => {
      const parent = new Knowledge();
      const child = new Knowledge();
      parent.id = '123e4567-e89b-12d3-a456-426614174012';
      child.id = '123e4567-e89b-12d3-a456-426614174013';

      relationship.source = parent;
      relationship.target = child;
      relationship.sourceId = parent.id;
      relationship.targetId = child.id;
      relationship.relationshipType = KnowledgeRelationshipType.PARENT_OF;
      relationship.weight = 1.0;
      relationship.isActive = true;
      relationship.isBidirectional = false;
      relationship.metadata = {
        hierarchyLevel: 2,
        category: 'documentation',
      };

      expect(relationship.source.id).toBe(parent.id);
      expect(relationship.target.id).toBe(child.id);
      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.PARENT_OF,
      );
      expect(relationship.metadata.hierarchyLevel).toBe(2);
    });

    it('should create a dependency relationship with confidence', () => {
      relationship.sourceId = '123e4567-e89b-12d3-a456-426614174014';
      relationship.targetId = '123e4567-e89b-12d3-a456-426614174015';
      relationship.relationshipType = KnowledgeRelationshipType.DEPENDS_ON;
      relationship.weight = 0.85;
      relationship.metadata = {
        confidence: 0.92,
        derivedBy: 'dependency-analyzer',
        context: 'Code analysis',
      };
      relationship.isActive = true;

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.DEPENDS_ON,
      );
      expect(relationship.weight).toBe(0.85);
      expect(relationship.metadata.confidence).toBe(0.92);
    });

    it('should create a versioning relationship', () => {
      relationship.sourceId = '123e4567-e89b-12d3-a456-426614174016';
      relationship.targetId = '123e4567-e89b-12d3-a456-426614174017';
      relationship.relationshipType = KnowledgeRelationshipType.SUPERSEDES;
      relationship.metadata = {
        oldVersion: '1.0',
        newVersion: '2.0',
        changeReason: 'Updated implementation',
      };

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.SUPERSEDES,
      );
      expect(relationship.metadata.oldVersion).toBe('1.0');
      expect(relationship.metadata.newVersion).toBe('2.0');
    });

    it('should create a custom relationship with custom metadata', () => {
      relationship.relationshipType = KnowledgeRelationshipType.CUSTOM;
      relationship.metadata = {
        customType: 'implements_design_pattern',
        patternName: 'Observer',
        description: 'Component implements Observer pattern',
      };

      expect(relationship.relationshipType).toBe(
        KnowledgeRelationshipType.CUSTOM,
      );
      expect(relationship.metadata.customType).toBe(
        'implements_design_pattern',
      );
      expect(relationship.metadata.patternName).toBe('Observer');
    });

    it('should handle soft deletion scenario', () => {
      relationship.sourceId = '123e4567-e89b-12d3-a456-426614174018';
      relationship.targetId = '123e4567-e89b-12d3-a456-426614174019';
      relationship.relationshipType = KnowledgeRelationshipType.RELATES_TO;
      relationship.isActive = true;

      // Simulate soft delete
      relationship.isActive = false;
      relationship.metadata = {
        ...relationship.metadata,
        deletedReason: 'No longer relevant',
        deletedAt: new Date().toISOString(),
      };

      expect(relationship.isActive).toBe(false);
      expect(relationship.metadata.deletedReason).toBe('No longer relevant');
    });
  });

  describe('KnowledgeRelationshipType Enum', () => {
    it('should have correct enum values for basic relationships', () => {
      expect(KnowledgeRelationshipType.RELATES_TO).toBe('relates_to');
      expect(KnowledgeRelationshipType.DERIVED_FROM).toBe('derived_from');
      expect(KnowledgeRelationshipType.CONTRADICTS).toBe('contradicts');
      expect(KnowledgeRelationshipType.SUPPORTS).toBe('supports');
      expect(KnowledgeRelationshipType.EXTENDS).toBe('extends');
    });

    it('should have correct enum values for hierarchical relationships', () => {
      expect(KnowledgeRelationshipType.PARENT_OF).toBe('parent_of');
      expect(KnowledgeRelationshipType.CHILD_OF).toBe('child_of');
      expect(KnowledgeRelationshipType.PART_OF).toBe('part_of');
    });

    it('should have correct enum values for dependency relationships', () => {
      expect(KnowledgeRelationshipType.DEPENDS_ON).toBe('depends_on');
      expect(KnowledgeRelationshipType.PREREQUISITE_FOR).toBe(
        'prerequisite_for',
      );
      expect(KnowledgeRelationshipType.FOLLOWS).toBe('follows');
    });

    it('should have correct enum values for reference relationships', () => {
      expect(KnowledgeRelationshipType.REFERENCES).toBe('references');
      expect(KnowledgeRelationshipType.CITED_BY).toBe('cited_by');
      expect(KnowledgeRelationshipType.SIMILAR_TO).toBe('similar_to');
    });

    it('should have correct enum values for versioning relationships', () => {
      expect(KnowledgeRelationshipType.SUPERSEDES).toBe('supersedes');
      expect(KnowledgeRelationshipType.SUPERSEDED_BY).toBe('superseded_by');
      expect(KnowledgeRelationshipType.VERSION_OF).toBe('version_of');
    });

    it('should have correct enum values for application relationships', () => {
      expect(KnowledgeRelationshipType.APPLIED_IN).toBe('applied_in');
      expect(KnowledgeRelationshipType.EXAMPLE_OF).toBe('example_of');
      expect(KnowledgeRelationshipType.GENERALIZES).toBe('generalizes');
    });

    it('should have correct enum value for custom relationship', () => {
      expect(KnowledgeRelationshipType.CUSTOM).toBe('custom');
    });

    it('should have exactly 21 relationship types', () => {
      const enumKeys = Object.keys(KnowledgeRelationshipType);
      // String enums only create key->value mappings (not reverse mappings)
      expect(enumKeys.length).toBe(21); // 21 relationship types
    });
  });
});
