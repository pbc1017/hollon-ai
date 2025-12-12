import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { DocumentService } from '../../src/modules/document/document.service';
import { DocumentType } from '../../src/modules/document/entities/document.entity';

/**
 * Document Search System Integration Tests
 *
 * This comprehensive test suite validates:
 * 1. Document search API endpoints
 * 2. Pagination functionality
 * 3. Filter combinations (tags, type, project, organization)
 * 4. Performance benchmarks
 * 5. Edge cases and error handling
 */
describe('Document Search Integration (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let documentService: DocumentService;

  // Test data IDs
  let organizationId: string;
  let projectId1: string;
  let projectId2: string;
  let teamId: string;
  let hollonId: string;
  let documentIds: string[] = [];

  const testRunId = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    documentService = moduleFixture.get<DocumentService>(DocumentService);

    // Setup test data
    await setupTestData();
  });

  afterAll(async () => {
    // Cleanup: Delete all test documents
    for (const docId of documentIds) {
      await dataSource.query('DELETE FROM hollon.documents WHERE id = $1', [
        docId,
      ]);
    }

    // Cleanup other test data
    if (projectId1) {
      await dataSource.query('DELETE FROM hollon.projects WHERE id = $1', [
        projectId1,
      ]);
    }
    if (projectId2) {
      await dataSource.query('DELETE FROM hollon.projects WHERE id = $1', [
        projectId2,
      ]);
    }
    if (hollonId) {
      await dataSource.query('DELETE FROM hollon.hollons WHERE id = $1', [
        hollonId,
      ]);
    }
    if (teamId) {
      await dataSource.query('DELETE FROM hollon.teams WHERE id = $1', [
        teamId,
      ]);
    }
    if (organizationId) {
      await dataSource.query('DELETE FROM hollon.organizations WHERE id = $1', [
        organizationId,
      ]);
    }

    await app.close();
  });

  /**
   * Setup test data with various document types, tags, and relationships
   */
  async function setupTestData() {
    // Create organization
    const orgResult = await dataSource.query(
      `INSERT INTO hollon.organizations (name, description, settings)
       VALUES ($1, $2, $3) RETURNING id`,
      [
        `Search Test Org ${testRunId}`,
        'Organization for search testing',
        JSON.stringify({
          costLimitDailyCents: 10000,
          costLimitMonthlyCents: 100000,
          maxHollonsPerTeam: 10,
          defaultTaskPriority: 'medium',
        }),
      ],
    );
    organizationId = orgResult[0].id;

    // Create team
    const teamResult = await dataSource.query(
      `INSERT INTO hollon.teams (organization_id, name, description)
       VALUES ($1, $2, $3) RETURNING id`,
      [organizationId, `Search Test Team ${testRunId}`, 'Test team'],
    );
    teamId = teamResult[0].id;

    // Create role
    const roleResult = await dataSource.query(
      `INSERT INTO hollon.roles (organization_id, name, description, system_prompt, capabilities)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        organizationId,
        'SearchTestRole',
        'Role for search testing',
        'Test prompt',
        JSON.stringify(['test']),
      ],
    );
    const roleId = roleResult[0].id;

    // Create hollon
    const hollonResult = await dataSource.query(
      `INSERT INTO hollon.hollons (name, organization_id, team_id, role_id, brain_provider_id, status, max_concurrent_tasks)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        `SearchTestHollon${testRunId}`,
        organizationId,
        teamId,
        roleId,
        'claude_code',
        'idle',
        1,
      ],
    );
    hollonId = hollonResult[0].id;

    // Create projects
    const project1Result = await dataSource.query(
      `INSERT INTO hollon.projects (organization_id, name, description, status, working_directory)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        organizationId,
        `Search Test Project 1 ${testRunId}`,
        'First test project',
        'active',
        '/tmp/test1',
      ],
    );
    projectId1 = project1Result[0].id;

    const project2Result = await dataSource.query(
      `INSERT INTO hollon.projects (organization_id, name, description, status, working_directory)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        organizationId,
        `Search Test Project 2 ${testRunId}`,
        'Second test project',
        'active',
        '/tmp/test2',
      ],
    );
    projectId2 = project2Result[0].id;

    // Create diverse set of test documents
    const documents = [
      // Organization-level knowledge documents
      {
        title: 'Company Coding Standards',
        content: 'Follow TypeScript strict mode and use ESLint.',
        type: DocumentType.KNOWLEDGE,
        tags: ['coding', 'standards', 'typescript'],
        projectId: null,
      },
      {
        title: 'API Design Guidelines',
        content: 'REST API best practices and conventions.',
        type: DocumentType.KNOWLEDGE,
        tags: ['api', 'design', 'rest'],
        projectId: null,
      },
      {
        title: 'Security Best Practices',
        content: 'Security guidelines for all projects.',
        type: DocumentType.KNOWLEDGE,
        tags: ['security', 'best-practices'],
        projectId: null,
      },

      // Project 1 documents
      {
        title: 'Project 1 Architecture',
        content: 'Microservices architecture with NestJS.',
        type: DocumentType.TASK_CONTEXT,
        tags: ['architecture', 'nestjs', 'microservices'],
        projectId: projectId1,
      },
      {
        title: 'Project 1 Setup Guide',
        content: 'How to setup the development environment.',
        type: DocumentType.KNOWLEDGE,
        tags: ['setup', 'guide', 'development'],
        projectId: projectId1,
      },
      {
        title: 'Project 1 Decision Log',
        content: 'All tests passed successfully.',
        type: DocumentType.DECISION_LOG,
        tags: ['testing', 'results', 'ci'],
        projectId: projectId1,
      },

      // Project 2 documents
      {
        title: 'Project 2 Requirements',
        content: 'Detailed requirements for the search feature.',
        type: DocumentType.TASK_CONTEXT,
        tags: ['requirements', 'search', 'features'],
        projectId: projectId2,
      },
      {
        title: 'Project 2 Performance Report',
        content: 'Performance metrics and optimization suggestions.',
        type: DocumentType.DECISION_LOG,
        tags: ['performance', 'optimization', 'metrics'],
        projectId: projectId2,
      },

      // Team-level documents
      {
        title: 'Team Meeting Notes',
        content: 'Sprint planning and retrospective notes.',
        type: DocumentType.KNOWLEDGE,
        tags: ['meeting', 'sprint', 'planning'],
        projectId: null,
      },

      // Documents with common tags for combination testing
      {
        title: 'TypeScript Migration Guide',
        content: 'Guide for migrating JavaScript to TypeScript.',
        type: DocumentType.KNOWLEDGE,
        tags: ['typescript', 'migration', 'guide'],
        projectId: projectId1,
      },
      {
        title: 'API Security Checklist',
        content: 'Security checklist for API endpoints.',
        type: DocumentType.KNOWLEDGE,
        tags: ['api', 'security', 'checklist'],
        projectId: projectId1,
      },
      {
        title: 'Performance Testing Guide',
        content: 'How to conduct performance tests.',
        type: DocumentType.KNOWLEDGE,
        tags: ['performance', 'testing', 'guide'],
        projectId: projectId2,
      },
    ];

    // Insert documents
    for (const doc of documents) {
      const result = await dataSource.query(
        `INSERT INTO hollon.documents (title, content, type, organization_id, team_id, project_id, hollon_id, tags, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          doc.title,
          doc.content,
          doc.type,
          organizationId,
          teamId,
          doc.projectId,
          hollonId,
          doc.tags,
          JSON.stringify({}),
        ],
      );
      documentIds.push(result[0].id);
    }

    // Create additional documents for pagination testing (20 more documents)
    for (let i = 1; i <= 20; i++) {
      const result = await dataSource.query(
        `INSERT INTO hollon.documents (title, content, type, organization_id, team_id, project_id, hollon_id, tags, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          `Pagination Test Document ${i}`,
          `Content for pagination test document ${i}`,
          DocumentType.KNOWLEDGE,
          organizationId,
          teamId,
          i % 2 === 0 ? projectId1 : projectId2,
          hollonId,
          ['pagination', 'test', `batch-${Math.ceil(i / 5)}`],
          JSON.stringify({ index: i }),
        ],
      );
      documentIds.push(result[0].id);
    }
  }

  describe('1. Basic Search Functionality', () => {
    it('should find organization knowledge documents', async () => {
      const results = await documentService.findOrganizationKnowledge(
        organizationId,
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((doc) => doc.organizationId === organizationId)).toBe(
        true,
      );
      expect(results.every((doc) => doc.projectId === null)).toBe(true);
    });

    it('should find project-specific documents', async () => {
      const results = await documentService.findProjectDocuments(projectId1);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((doc) => doc.projectId === projectId1)).toBe(true);
    });

    it('should search documents by tags', async () => {
      const results = await documentService.searchByTags(organizationId, [
        'typescript',
      ]);

      expect(results.length).toBeGreaterThan(0);
      expect(
        results.every((doc) => doc.tags.includes('typescript')),
      ).toBe(true);
    });

    it('should search by multiple tags (OR condition)', async () => {
      const results = await documentService.searchByTags(organizationId, [
        'api',
        'security',
      ]);

      expect(results.length).toBeGreaterThan(0);
      expect(
        results.every(
          (doc) => doc.tags.includes('api') || doc.tags.includes('security'),
        ),
      ).toBe(true);
    });
  });

  describe('2. Pagination Tests', () => {
    it('should respect limit parameter', async () => {
      const limit = 5;
      const results = await documentService.findOrganizationKnowledge(
        organizationId,
        { limit },
      );

      expect(results.length).toBeLessThanOrEqual(limit);
    });

    it('should return correct number of documents with limit', async () => {
      const limit = 10;
      const results = await documentService.searchByTags(
        organizationId,
        ['pagination'],
        { limit },
      );

      expect(results.length).toBe(limit);
    });

    it('should handle limit larger than available documents', async () => {
      const limit = 1000;
      const results = await documentService.findProjectDocuments(projectId1, {
        limit,
      });

      // Should return all available documents, not throw an error
      expect(results.length).toBeLessThanOrEqual(limit);
    });

    it('should return results in descending order by creation date', async () => {
      const results = await documentService.findOrganizationKnowledge(
        organizationId,
        { limit: 10 },
      );

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          results[i + 1].createdAt.getTime(),
        );
      }
    });
  });

  describe('3. Filter Combination Scenarios', () => {
    it('should filter by tags AND type', async () => {
      const results = await documentService.searchByTags(
        organizationId,
        ['guide'],
        { type: DocumentType.KNOWLEDGE },
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((doc) => doc.type === DocumentType.KNOWLEDGE)).toBe(
        true,
      );
      expect(results.every((doc) => doc.tags.includes('guide'))).toBe(true);
    });

    it('should filter by tags AND project', async () => {
      const results = await documentService.searchByTags(
        organizationId,
        ['performance'],
        { projectId: projectId2 },
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((doc) => doc.projectId === projectId2)).toBe(true);
      expect(
        results.every((doc) => doc.tags.includes('performance')),
      ).toBe(true);
    });

    it('should filter by tags, type, AND project', async () => {
      const results = await documentService.searchByTags(
        organizationId,
        ['testing'],
        {
          type: DocumentType.DECISION_LOG,
          projectId: projectId1,
        },
      );

      expect(results.every((doc) => doc.type === DocumentType.DECISION_LOG)).toBe(
        true,
      );
      expect(results.every((doc) => doc.projectId === projectId1)).toBe(true);
      expect(results.every((doc) => doc.tags.includes('testing'))).toBe(true);
    });

    it('should filter by tags, type, project, AND limit', async () => {
      const limit = 2;
      const results = await documentService.searchByTags(
        organizationId,
        ['typescript', 'api'],
        {
          type: DocumentType.KNOWLEDGE,
          projectId: projectId1,
          limit,
        },
      );

      expect(results.length).toBeLessThanOrEqual(limit);
      expect(results.every((doc) => doc.type === DocumentType.KNOWLEDGE)).toBe(
        true,
      );
      expect(results.every((doc) => doc.projectId === projectId1)).toBe(true);
    });

    it('should handle organization-level filter (projectId: null)', async () => {
      const results = await documentService.searchByTags(
        organizationId,
        ['security'],
        { projectId: null },
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((doc) => doc.projectId === null)).toBe(true);
    });

    it('should filter by type only in organization knowledge', async () => {
      const results = await documentService.findOrganizationKnowledge(
        organizationId,
        { type: DocumentType.KNOWLEDGE },
      );

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((doc) => doc.type === DocumentType.KNOWLEDGE)).toBe(
        true,
      );
      expect(results.every((doc) => doc.projectId === null)).toBe(true);
    });
  });

  describe('4. Edge Cases and Error Handling', () => {
    it('should return empty array for non-existent tags', async () => {
      const results = await documentService.searchByTags(organizationId, [
        'nonexistent-tag-xyz',
      ]);

      expect(results).toEqual([]);
    });

    it('should return empty array for non-existent project', async () => {
      const results = await documentService.findProjectDocuments(
        '00000000-0000-0000-0000-000000000000',
      );

      expect(results).toEqual([]);
    });

    it('should handle empty tags array', async () => {
      const results = await documentService.searchByTags(organizationId, []);

      // Should return all organization documents or empty array
      expect(Array.isArray(results)).toBe(true);
    });

    it('should handle documents with multiple matching tags', async () => {
      const results = await documentService.searchByTags(organizationId, [
        'api',
        'security',
      ]);

      // Should find documents with either tag
      expect(results.length).toBeGreaterThan(0);
    });

    it('should find documents by hollon', async () => {
      const results = await documentService.findByHollon(hollonId);

      expect(results.length).toBeGreaterThan(0);
      expect(results.every((doc) => doc.hollonId === hollonId)).toBe(true);
    });
  });

  describe('5. Performance Benchmarks', () => {
    it('should search through large dataset efficiently', async () => {
      const startTime = Date.now();

      const results = await documentService.searchByTags(
        organizationId,
        ['pagination'],
        { limit: 20 },
      );

      const duration = Date.now() - startTime;

      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(1000); // Should complete in less than 1 second
    });

    it('should handle complex filter combinations efficiently', async () => {
      const startTime = Date.now();

      const results = await documentService.searchByTags(
        organizationId,
        ['test', 'pagination', 'guide'],
        {
          type: DocumentType.KNOWLEDGE,
          projectId: projectId1,
          limit: 10,
        },
      );

      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(500); // Should complete in less than 500ms
    });

    it('should efficiently retrieve organization knowledge', async () => {
      const startTime = Date.now();

      const results = await documentService.findOrganizationKnowledge(
        organizationId,
        { limit: 50 },
      );

      const duration = Date.now() - startTime;

      expect(Array.isArray(results)).toBe(true);
      expect(duration).toBeLessThan(500);
    });

    it('should efficiently retrieve project documents', async () => {
      const startTime = Date.now();

      const results = await documentService.findProjectDocuments(projectId1, {
        limit: 50,
      });

      const duration = Date.now() - startTime;

      expect(Array.isArray(results)).toBe(true);
      expect(duration).toBeLessThan(500);
    });
  });

  describe('6. Data Consistency and Ordering', () => {
    it('should return consistent results across multiple queries', async () => {
      const results1 = await documentService.searchByTags(organizationId, [
        'typescript',
      ]);
      const results2 = await documentService.searchByTags(organizationId, [
        'typescript',
      ]);

      expect(results1.length).toBe(results2.length);
      expect(results1.map((d) => d.id).sort()).toEqual(
        results2.map((d) => d.id).sort(),
      );
    });

    it('should properly order results by creation date (newest first)', async () => {
      const results = await documentService.findOrganizationKnowledge(
        organizationId,
      );

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].createdAt.getTime()).toBeGreaterThanOrEqual(
          results[i + 1].createdAt.getTime(),
        );
      }
    });

    it('should include all required fields in search results', async () => {
      const results = await documentService.searchByTags(organizationId, [
        'api',
      ]);

      results.forEach((doc) => {
        expect(doc).toHaveProperty('id');
        expect(doc).toHaveProperty('title');
        expect(doc).toHaveProperty('content');
        expect(doc).toHaveProperty('type');
        expect(doc).toHaveProperty('organizationId');
        expect(doc).toHaveProperty('tags');
        expect(doc).toHaveProperty('createdAt');
        expect(doc).toHaveProperty('updatedAt');
      });
    });
  });

  describe('7. Type-Specific Searches', () => {
    it('should filter by KNOWLEDGE type', async () => {
      const results = await documentService.findOrganizationKnowledge(
        organizationId,
        { type: DocumentType.KNOWLEDGE },
      );

      expect(results.every((doc) => doc.type === DocumentType.KNOWLEDGE)).toBe(
        true,
      );
    });

    it('should filter by TASK_CONTEXT type', async () => {
      const results = await documentService.searchByTags(
        organizationId,
        ['requirements', 'architecture'],
        { type: DocumentType.TASK_CONTEXT },
      );

      expect(results.every((doc) => doc.type === DocumentType.TASK_CONTEXT)).toBe(
        true,
      );
    });

    it('should filter by DECISION_LOG type', async () => {
      const results = await documentService.searchByTags(
        organizationId,
        ['results', 'testing', 'performance'],
        { type: DocumentType.DECISION_LOG },
      );

      expect(results.every((doc) => doc.type === DocumentType.DECISION_LOG)).toBe(
        true,
      );
    });
  });
});
