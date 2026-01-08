import { Test, TestingModule } from '@nestjs/testing';
import { CategorizationService } from './categorization.service';
import {
  KnowledgeCategory,
  CategorizationConfidence,
  CategorizationInput,
} from '../types/categorization.types';

describe('CategorizationService', () => {
  let service: CategorizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CategorizationService],
    }).compile();

    service = module.get<CategorizationService>(CategorizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('categorize', () => {
    describe('FACT categorization', () => {
      it('should categorize factual statements', () => {
        const input: CategorizationInput = {
          content:
            'The database is PostgreSQL and the server uses TypeScript.',
          metadata: {},
        };

        const result = service.categorize(input);

        expect(result.category).toBe(KnowledgeCategory.FACT);
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.confidenceLevel).toBeDefined();
      });

      it('should categorize technical specifications', () => {
        const input: CategorizationInput = {
          content: 'The API endpoint is configured to use port 3000.',
          metadata: {},
        };

        const result = service.categorize(input);

        expect(result.category).toBe(KnowledgeCategory.FACT);
        expect(result.confidence).toBeGreaterThan(0.4);
      });

      it('should categorize numerical data as facts', () => {
        const input: CategorizationInput = {
          content: 'The response time is 150ms and the file size is 2.5MB.',
          metadata: {},
        };

        const result = service.categorize(input);

        expect(result.category).toBe(KnowledgeCategory.FACT);
        expect(result.confidence).toBeGreaterThan(0.5);
      });
    });

    describe('PREFERENCE categorization', () => {
      it('should categorize opinion statements', () => {
        const input: CategorizationInput = {
          content: 'We prefer using async/await over traditional promises.',
          metadata: {},
        };

        const result = service.categorize(input);

        expect(result.category).toBe(KnowledgeCategory.PREFERENCE);
        expect(result.confidence).toBeGreaterThan(0.5);
      });

      it('should categorize recommendations', () => {
        const input: CategorizationInput = {
          content: 'I strongly recommend using TypeScript over JavaScript.',
          metadata: {},
        };

        const result = service.categorize(input);

        expect(result.category).toBe(KnowledgeCategory.PREFERENCE);
        expect(result.confidence).toBeGreaterThan(0.4);
      });

      it('should categorize comparative statements', () => {
        const input: CategorizationInput = {
          content: 'React is better than Vue for this project.',
          metadata: {},
        };

        const result = service.categorize(input);

        expect(result.category).toBe(KnowledgeCategory.PREFERENCE);
        expect(result.confidence).toBeGreaterThan(0.4);
      });

      it('should categorize team conventions', () => {
        const input: CategorizationInput = {
          content: 'Our team uses camelCase as the naming convention.',
          metadata: {},
        };

        const result = service.categorize(input);

        expect(result.category).toBe(KnowledgeCategory.PREFERENCE);
        expect(result.confidence).toBeGreaterThan(0.4);
      });
    });

    describe('CONTEXT categorization', () => {
      it('should categorize background information', () => {
        const input: CategorizationInput = {
          content:
            'This feature was originally built because users requested mobile support.',
          metadata: {},
        };

        const result = service.categorize(input);

        expect(result.category).toBe(KnowledgeCategory.CONTEXT);
        expect(result.confidence).toBeGreaterThan(0.4);
      });

      it('should categorize environmental factors', () => {
        const input: CategorizationInput = {
          content: 'The deployment environment is AWS in the us-east-1 region.',
          metadata: {},
        };

        const result = service.categorize(input);

        expect(result.category).toBe(KnowledgeCategory.CONTEXT);
        expect(result.confidence).toBeGreaterThan(0.4);
      });

      it('should categorize purpose statements', () => {
        const input: CategorizationInput = {
          content:
            'The goal of this module is to enable real-time collaboration.',
          metadata: {},
        };

        const result = service.categorize(input);

        expect(result.category).toBe(KnowledgeCategory.CONTEXT);
        expect(result.confidence).toBeGreaterThan(0.4);
      });
    });

    describe('RELATIONSHIP categorization', () => {
      it('should categorize dependency relationships', () => {
        const input: CategorizationInput = {
          content: 'The UserService depends on the DatabaseService.',
          metadata: {},
        };

        const result = service.categorize(input);

        expect(result.category).toBe(KnowledgeCategory.RELATIONSHIP);
        expect(result.confidence).toBeGreaterThan(0.4);
      });

      it('should categorize hierarchical relationships', () => {
        const input: CategorizationInput = {
          content: 'The User entity owns multiple Tasks.',
          metadata: {},
        };

        const result = service.categorize(input);

        expect(result.category).toBe(KnowledgeCategory.RELATIONSHIP);
        expect(result.confidence).toBeGreaterThan(0.3);
      });

      it('should categorize relationships with entity metadata', () => {
        const input: CategorizationInput = {
          content: 'These entities are connected.',
          metadata: {},
          entities: [{ type: 'relationship', value: 'user-to-team' }],
        };

        const result = service.categorize(input);

        expect(result.category).toBe(KnowledgeCategory.RELATIONSHIP);
        expect(result.confidence).toBeGreaterThan(0.5);
      });
    });

    describe('options handling', () => {
      it('should include alternatives when requested', () => {
        const input: CategorizationInput = {
          content: 'The server is Node.js and we prefer using Express.',
          metadata: {},
        };

        const result = service.categorize(input, {
          includeAlternatives: true,
          maxAlternatives: 2,
        });

        expect(result.alternatives).toBeDefined();
        expect(result.alternatives?.length).toBeGreaterThan(0);
        expect(result.alternatives?.length).toBeLessThanOrEqual(2);
      });

      it('should respect minimum confidence threshold', () => {
        const input: CategorizationInput = {
          content: 'Some ambiguous text.',
          metadata: {},
        };

        const result = service.categorize(input, {
          minConfidence: 0.5,
          includeAlternatives: true,
        });

        // Alternatives should meet minimum confidence
        if (result.alternatives) {
          result.alternatives.forEach((alt) => {
            expect(alt.confidence).toBeGreaterThanOrEqual(0.5);
          });
        }
      });

      it('should use custom rules when provided', () => {
        const input: CategorizationInput = {
          content: 'This is a custom test pattern.',
          metadata: {},
        };

        const result = service.categorize(input, {
          customRules: [
            {
              id: 'custom-001',
              name: 'Custom test rule',
              category: KnowledgeCategory.FACT,
              patterns: {
                content: ['custom test pattern'],
              },
              weight: 2.0,
              confidenceMultiplier: 0.95,
              enabled: true,
            },
          ],
          useDefaultRules: true,
        });

        expect(result).toBeDefined();
        expect(result.matchedRules).toBeDefined();
      });
    });

    describe('confidence levels', () => {
      it('should return appropriate confidence levels', () => {
        const testCases = [
          {
            content: 'The database is PostgreSQL version 14.',
            expectedMin: CategorizationConfidence.MEDIUM,
          },
          {
            content: 'We strongly prefer TypeScript over JavaScript.',
            expectedMin: CategorizationConfidence.MEDIUM,
          },
          {
            content: 'The service depends on and requires the auth module.',
            expectedMin: CategorizationConfidence.MEDIUM,
          },
        ];

        testCases.forEach((testCase) => {
          const input: CategorizationInput = {
            content: testCase.content,
            metadata: {},
          };

          const result = service.categorize(input);

          expect(result.confidenceLevel).toBeDefined();
          // Verify confidence level matches confidence score
          expect(result.confidence).toBeGreaterThan(0);
          expect(result.confidence).toBeLessThanOrEqual(1);
        });
      });
    });
  });

  describe('batchCategorize', () => {
    it('should categorize multiple inputs', () => {
      const inputs: CategorizationInput[] = [
        { content: 'The database is PostgreSQL.', metadata: {} },
        {
          content: 'We prefer using async/await syntax.',
          metadata: {},
        },
        {
          content: 'This was built for mobile users.',
          metadata: {},
        },
        {
          content: 'The UserService depends on DatabaseService.',
          metadata: {},
        },
      ];

      const result = service.batchCategorize(inputs);

      expect(result.total).toBe(4);
      expect(result.categorized).toBe(4);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(4);
      expect(result.statistics).toBeDefined();
      expect(result.statistics.byCategory).toBeDefined();
      expect(result.statistics.avgConfidence).toBeGreaterThan(0);
    });

    it('should provide accurate statistics', () => {
      const inputs: CategorizationInput[] = [
        { content: 'The server uses Node.js.', metadata: {} },
        { content: 'The API is RESTful.', metadata: {} },
        {
          content: 'I prefer TypeScript.',
          metadata: {},
        },
      ];

      const result = service.batchCategorize(inputs);

      // Check that statistics add up
      const totalCategorized = Object.values(
        result.statistics.byCategory,
      ).reduce((sum, count) => sum + count, 0);
      expect(totalCategorized).toBe(result.categorized);

      // Check confidence distribution
      const totalInDistribution = Object.values(
        result.statistics.confidenceDistribution,
      ).reduce((sum, count) => sum + count, 0);
      expect(totalInDistribution).toBe(result.categorized);
    });

    it('should handle empty input array', () => {
      const result = service.batchCategorize([]);

      expect(result.total).toBe(0);
      expect(result.categorized).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toHaveLength(0);
    });
  });

  describe('rule management', () => {
    it('should add custom rules', () => {
      const initialRules = service.getRules();
      const initialCount = initialRules.length;

      const newRule = {
        id: 'test-001',
        name: 'Test rule',
        category: KnowledgeCategory.FACT,
        patterns: { content: ['test'] },
        weight: 1.0,
        confidenceMultiplier: 0.8,
        enabled: true,
      };

      service.addRule(newRule);

      const updatedRules = service.getRules();
      expect(updatedRules.length).toBe(initialCount + 1);
      expect(updatedRules.find((r) => r.id === 'test-001')).toBeDefined();
    });

    it('should update existing rules', () => {
      const rules = service.getRules();
      const ruleToUpdate = rules[0];

      const updated = service.updateRule(ruleToUpdate.id, { weight: 5.0 });

      expect(updated).toBeDefined();
      expect(updated?.weight).toBe(5.0);
      expect(updated?.id).toBe(ruleToUpdate.id);
    });

    it('should remove rules', () => {
      const newRule = {
        id: 'temp-001',
        name: 'Temporary rule',
        category: KnowledgeCategory.FACT,
        patterns: { content: ['temp'] },
        weight: 1.0,
        confidenceMultiplier: 0.8,
        enabled: true,
      };

      service.addRule(newRule);
      const removed = service.removeRule('temp-001');

      expect(removed).toBe(true);
      expect(service.getRules().find((r) => r.id === 'temp-001')).toBeUndefined();
    });

    it('should get rule set with metadata', () => {
      const ruleSet = service.getRuleSet();

      expect(ruleSet.version).toBeDefined();
      expect(ruleSet.description).toBeDefined();
      expect(ruleSet.rules).toBeDefined();
      expect(ruleSet.rules.length).toBeGreaterThan(0);
      expect(ruleSet.metadata).toBeDefined();
      expect(ruleSet.metadata?.createdAt).toBeInstanceOf(Date);
    });
  });

  describe('extensibility', () => {
    it('should support new categories through custom rules', () => {
      // While we have 4 main categories, the system should allow
      // custom rules to be added for potential future categories
      const customRule = {
        id: 'ext-001',
        name: 'Extensibility test',
        category: KnowledgeCategory.FACT,
        patterns: { content: ['extensible'] },
        weight: 1.0,
        confidenceMultiplier: 0.9,
        enabled: true,
      };

      service.addRule(customRule);

      const input: CategorizationInput = {
        content: 'This is extensible.',
        metadata: {},
      };

      const result = service.categorize(input);

      expect(result).toBeDefined();
      expect(result.category).toBeDefined();
    });

    it('should allow disabling rules without removing them', () => {
      const rules = service.getRules();
      const activeCount = rules.length;

      // Update a rule to be disabled
      const ruleToDisable = rules[0];
      service.updateRule(ruleToDisable.id, { enabled: false });

      const activeRules = service.getRules();
      expect(activeRules.length).toBe(activeCount - 1);

      // Re-enable
      service.updateRule(ruleToDisable.id, { enabled: true });
      const reenabledRules = service.getRules();
      expect(reenabledRules.length).toBe(activeCount);
    });
  });

  describe('edge cases', () => {
    it('should handle empty content', () => {
      const input: CategorizationInput = {
        content: '',
        metadata: {},
      };

      const result = service.categorize(input);

      expect(result).toBeDefined();
      expect(result.category).toBeDefined();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle very long content', () => {
      const longContent = 'The system '.repeat(1000) + 'uses PostgreSQL.';
      const input: CategorizationInput = {
        content: longContent,
        metadata: {},
      };

      const result = service.categorize(input);

      expect(result).toBeDefined();
      expect(result.category).toBeDefined();
    });

    it('should handle special characters', () => {
      const input: CategorizationInput = {
        content: 'The config uses {"key": "value"} format.',
        metadata: {},
      };

      const result = service.categorize(input);

      expect(result).toBeDefined();
      expect(result.category).toBeDefined();
    });

    it('should handle mixed category signals', () => {
      const input: CategorizationInput = {
        content:
          'The database is PostgreSQL, and we prefer it over MySQL because it was originally chosen for its features.',
        metadata: {},
      };

      const result = service.categorize(input, {
        includeAlternatives: true,
      });

      expect(result).toBeDefined();
      expect(result.category).toBeDefined();
      expect(result.alternatives).toBeDefined();
      expect(result.alternatives?.length).toBeGreaterThan(0);
    });
  });
});
