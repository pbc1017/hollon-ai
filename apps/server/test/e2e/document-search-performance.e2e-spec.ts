import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import { DocumentService } from '../../src/modules/document/document.service';
import { DocumentType } from '../../src/modules/document/entities/document.entity';

/**
 * Document Search Performance and Load Tests
 *
 * This test suite focuses on:
 * 1. Performance benchmarks with various dataset sizes
 * 2. Load testing with concurrent requests
 * 3. Bottleneck identification
 * 4. Scalability verification
 * 5. Memory and query optimization validation
 */
describe('Document Search Performance (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let documentService: DocumentService;

  let organizationId: string;
  let projectId: string;
  let teamId: string;
  let hollonId: string;
  let documentIds: string[] = [];

  const testRunId = Date.now();

  // Performance thresholds
  const PERF_THRESHOLDS = {
    SIMPLE_QUERY_MS: 100,
    COMPLEX_QUERY_MS: 300,
    LARGE_DATASET_QUERY_MS: 500,
    CONCURRENT_BATCH_MS: 2000,
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    documentService = moduleFixture.get<DocumentService>(DocumentService);

    await setupPerformanceTestData();
  });

  afterAll(async () => {
    // Cleanup all test documents
    for (const docId of documentIds) {
      await dataSource.query('DELETE FROM hollon.documents WHERE id = $1', [
        docId,
      ]);
    }

    if (projectId) {
      await dataSource.query('DELETE FROM hollon.projects WHERE id = $1', [
        projectId,
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
   * Setup large dataset for performance testing
   */
  async function setupPerformanceTestData() {
    // Create organization
    const orgResult = await dataSource.query(
      `INSERT INTO hollon.organizations (name, description, settings)
       VALUES ($1, $2, $3) RETURNING id`,
      [
        `Perf Test Org ${testRunId}`,
        'Organization for performance testing',
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
      [organizationId, `Perf Test Team ${testRunId}`, 'Test team'],
    );
    teamId = teamResult[0].id;

    // Create role
    const roleResult = await dataSource.query(
      `INSERT INTO hollon.roles (organization_id, name, description, system_prompt, capabilities)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        organizationId,
        'PerfTestRole',
        'Role for perf testing',
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
        `PerfTestHollon${testRunId}`,
        organizationId,
        teamId,
        roleId,
        'claude_code',
        'idle',
        1,
      ],
    );
    hollonId = hollonResult[0].id;

    // Create project
    const projectResult = await dataSource.query(
      `INSERT INTO hollon.projects (organization_id, name, description, status, working_directory)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [
        organizationId,
        `Perf Test Project ${testRunId}`,
        'Performance test project',
        'active',
        '/tmp/perftest',
      ],
    );
    projectId = projectResult[0].id;

    // Create 500 documents for comprehensive performance testing
    const tagPool = [
      'performance',
      'typescript',
      'api',
      'security',
      'testing',
      'documentation',
      'architecture',
      'database',
      'frontend',
      'backend',
      'devops',
      'monitoring',
      'optimization',
      'scalability',
      'reliability',
    ];

    const typePool = [
      DocumentType.KNOWLEDGE,
      DocumentType.TASK_CONTEXT,
      DocumentType.DECISION_LOG,
    ];

    console.log('Creating 500 test documents for performance testing...');
    
    for (let i = 1; i <= 500; i++) {
      // Randomly assign tags (2-5 tags per document)
      const numTags = 2 + Math.floor(Math.random() * 4);
      const tags = [];
      for (let j = 0; j < numTags; j++) {
        const tag = tagPool[Math.floor(Math.random() * tagPool.length)];
        if (!tags.includes(tag)) {
          tags.push(tag);
        }
      }

      const type = typePool[Math.floor(Math.random() * typePool.length)];
      const hasProject = Math.random() > 0.3; // 70% have project, 30% org-level

      const result = await dataSource.query(
        `INSERT INTO hollon.documents (title, content, type, organization_id, team_id, project_id, hollon_id, tags, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id`,
        [
          `Performance Test Document ${i}`,
          `This is test content for document ${i}. It contains various keywords and information for testing search performance. ${tags.join(' ')}`,
          type,
          organizationId,
          teamId,
          hasProject ? projectId : null,
          hollonId,
          tags,
          JSON.stringify({ index: i, batch: Math.ceil(i / 50) }),
        ],
      );
      documentIds.push(result[0].id);

      // Log progress every 100 documents
      if (i % 100 === 0) {
        console.log(`Created ${i}/500 documents`);
      }
    }

    console.log('✅ Test data setup complete');
  }

  describe('1. Query Performance Benchmarks', () => {
    it('should execute simple tag search within threshold', async () => {
      const startTime = Date.now();

      const results = await documentService.searchByTags(organizationId, [
        'performance',
      ]);

      const duration = Date.now() - startTime;

      console.log(`Simple tag search: ${duration}ms (${results.length} results)`);
      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(PERF_THRESHOLDS.SIMPLE_QUERY_MS);
    });

    it('should execute multi-tag search within threshold', async () => {
      const startTime = Date.now();

      const results = await documentService.searchByTags(organizationId, [
        'typescript',
        'api',
        'security',
      ]);

      const duration = Date.now() - startTime;

      console.log(`Multi-tag search: ${duration}ms (${results.length} results)`);
      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(PERF_THRESHOLDS.COMPLEX_QUERY_MS);
    });

    it('should execute complex filter combination within threshold', async () => {
      const startTime = Date.now();

      const results = await documentService.searchByTags(
        organizationId,
        ['testing', 'documentation'],
        {
          type: DocumentType.KNOWLEDGE,
          projectId: projectId,
          limit: 50,
        },
      );

      const duration = Date.now() - startTime;

      console.log(
        `Complex filter search: ${duration}ms (${results.length} results)`,
      );
      expect(duration).toBeLessThan(PERF_THRESHOLDS.COMPLEX_QUERY_MS);
    });

    it('should execute organization knowledge query within threshold', async () => {
      const startTime = Date.now();

      const results = await documentService.findOrganizationKnowledge(
        organizationId,
        { limit: 100 },
      );

      const duration = Date.now() - startTime;

      console.log(
        `Organization knowledge query: ${duration}ms (${results.length} results)`,
      );
      expect(duration).toBeLessThan(PERF_THRESHOLDS.COMPLEX_QUERY_MS);
    });

    it('should execute project documents query within threshold', async () => {
      const startTime = Date.now();

      const results = await documentService.findProjectDocuments(projectId, {
        limit: 100,
      });

      const duration = Date.now() - startTime;

      console.log(
        `Project documents query: ${duration}ms (${results.length} results)`,
      );
      expect(duration).toBeLessThan(PERF_THRESHOLDS.COMPLEX_QUERY_MS);
    });
  });

  describe('2. Large Dataset Performance', () => {
    it('should handle large result sets efficiently', async () => {
      const startTime = Date.now();

      const results = await documentService.searchByTags(organizationId, [
        'performance',
        'testing',
        'documentation',
      ]);

      const duration = Date.now() - startTime;

      console.log(
        `Large result set: ${duration}ms (${results.length} results)`,
      );
      expect(results.length).toBeGreaterThan(10);
      expect(duration).toBeLessThan(PERF_THRESHOLDS.LARGE_DATASET_QUERY_MS);
    });

    it('should handle pagination efficiently with large offset', async () => {
      // Simulate pagination by using limit
      const pageSize = 20;
      
      const startTime = Date.now();

      const results = await documentService.findOrganizationKnowledge(
        organizationId,
        { limit: pageSize },
      );

      const duration = Date.now() - startTime;

      console.log(`Pagination query: ${duration}ms (${results.length} results)`);
      expect(results.length).toBeLessThanOrEqual(pageSize);
      expect(duration).toBeLessThan(PERF_THRESHOLDS.COMPLEX_QUERY_MS);
    });

    it('should efficiently retrieve documents by hollon', async () => {
      const startTime = Date.now();

      const results = await documentService.findByHollon(hollonId);

      const duration = Date.now() - startTime;

      console.log(
        `Hollon documents query: ${duration}ms (${results.length} results)`,
      );
      expect(results.length).toBeGreaterThan(0);
      expect(duration).toBeLessThan(PERF_THRESHOLDS.LARGE_DATASET_QUERY_MS);
    });
  });

  describe('3. Concurrent Load Testing', () => {
    it('should handle concurrent simple queries', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const promises = Array(concurrentRequests)
        .fill(null)
        .map((_, index) =>
          documentService.searchByTags(organizationId, [
            ['performance', 'typescript', 'api', 'security', 'testing'][
              index % 5
            ],
          ]),
        );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      console.log(
        `Concurrent simple queries (${concurrentRequests}): ${duration}ms`,
      );
      expect(results.every((r) => Array.isArray(r))).toBe(true);
      expect(duration).toBeLessThan(PERF_THRESHOLDS.CONCURRENT_BATCH_MS);
    });

    it('should handle concurrent complex queries', async () => {
      const concurrentRequests = 10;
      const startTime = Date.now();

      const promises = Array(concurrentRequests)
        .fill(null)
        .map((_, index) =>
          documentService.searchByTags(
            organizationId,
            ['performance', 'testing'],
            {
              type:
                [
                  DocumentType.KNOWLEDGE,
                  DocumentType.TASK_CONTEXT,
                  DocumentType.DECISION_LOG,
                ][index % 3],
              limit: 20,
            },
          ),
        );

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      console.log(
        `Concurrent complex queries (${concurrentRequests}): ${duration}ms`,
      );
      expect(results.every((r) => Array.isArray(r))).toBe(true);
      expect(duration).toBeLessThan(PERF_THRESHOLDS.CONCURRENT_BATCH_MS);
    });

    it('should handle mixed concurrent operations', async () => {
      const startTime = Date.now();

      const promises = [
        documentService.searchByTags(organizationId, ['api']),
        documentService.findOrganizationKnowledge(organizationId, { limit: 50 }),
        documentService.findProjectDocuments(projectId, { limit: 50 }),
        documentService.findByHollon(hollonId),
        documentService.searchByTags(organizationId, ['typescript', 'security'], {
          type: DocumentType.KNOWLEDGE,
        }),
      ];

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      console.log(`Mixed concurrent operations: ${duration}ms`);
      expect(results.every((r) => Array.isArray(r))).toBe(true);
      expect(duration).toBeLessThan(PERF_THRESHOLDS.CONCURRENT_BATCH_MS);
    });

    it('should handle high concurrency (50 requests)', async () => {
      const concurrentRequests = 50;
      const startTime = Date.now();

      const promises = Array(concurrentRequests)
        .fill(null)
        .map((_, index) => {
          const operation = index % 3;
          if (operation === 0) {
            return documentService.searchByTags(organizationId, [
              'performance',
            ]);
          } else if (operation === 1) {
            return documentService.findOrganizationKnowledge(organizationId, {
              limit: 10,
            });
          } else {
            return documentService.findProjectDocuments(projectId, {
              limit: 10,
            });
          }
        });

      const results = await Promise.all(promises);
      const duration = Date.now() - startTime;

      console.log(
        `High concurrency test (${concurrentRequests}): ${duration}ms`,
      );
      expect(results.every((r) => Array.isArray(r))).toBe(true);
      // Allow more time for high concurrency
      expect(duration).toBeLessThan(PERF_THRESHOLDS.CONCURRENT_BATCH_MS * 2);
    });
  });

  describe('4. Scalability Verification', () => {
    it('should maintain performance with varying result sizes', async () => {
      const limits = [10, 50, 100, 200];
      const durations: number[] = [];

      for (const limit of limits) {
        const startTime = Date.now();
        await documentService.searchByTags(organizationId, ['testing'], {
          limit,
        });
        const duration = Date.now() - startTime;
        durations.push(duration);
      }

      console.log('Performance scaling:', durations.map((d, i) => `${limits[i]}: ${d}ms`).join(', '));

      // Performance should scale sub-linearly
      // Fetching 10x more results should not take 10x longer
      const ratio = durations[durations.length - 1] / durations[0];
      expect(ratio).toBeLessThan(10); // Less than linear scaling
    });

    it('should efficiently handle queries with no results', async () => {
      const startTime = Date.now();

      const results = await documentService.searchByTags(organizationId, [
        'nonexistent-tag-xyz-abc-123',
      ]);

      const duration = Date.now() - startTime;

      console.log(`Empty result query: ${duration}ms`);
      expect(results).toEqual([]);
      expect(duration).toBeLessThan(PERF_THRESHOLDS.SIMPLE_QUERY_MS);
    });

    it('should handle queries with very common tags efficiently', async () => {
      const startTime = Date.now();

      // Search for a very common tag that appears in many documents
      const results = await documentService.searchByTags(organizationId, [
        'performance',
      ]);

      const duration = Date.now() - startTime;

      console.log(
        `Common tag query: ${duration}ms (${results.length} results)`,
      );
      expect(results.length).toBeGreaterThan(10);
      expect(duration).toBeLessThan(PERF_THRESHOLDS.LARGE_DATASET_QUERY_MS);
    });
  });

  describe('5. Bottleneck Identification', () => {
    it('should identify query vs. data transfer bottleneck', async () => {
      const queryStartTime = Date.now();

      const results = await documentService.searchByTags(organizationId, [
        'api',
        'security',
      ]);

      const queryDuration = Date.now() - queryStartTime;

      // Measure data processing time by accessing properties
      const processingStartTime = Date.now();
      results.forEach((doc) => {
        // Access all properties to simulate data processing
        const _ = doc.id + doc.title + doc.content + doc.type;
      });
      const processingDuration = Date.now() - processingStartTime;

      console.log(
        `Query: ${queryDuration}ms, Processing: ${processingDuration}ms`,
      );

      // Processing should be negligible compared to query time
      expect(processingDuration).toBeLessThan(queryDuration);
    });

    it('should measure index effectiveness', async () => {
      // Compare indexed column query vs. non-indexed query performance
      const indexedStartTime = Date.now();
      await documentService.findOrganizationKnowledge(organizationId);
      const indexedDuration = Date.now() - indexedStartTime;

      const nonIndexedStartTime = Date.now();
      await documentService.searchByTags(organizationId, ['performance']);
      const nonIndexedDuration = Date.now() - nonIndexedStartTime;

      console.log(
        `Indexed: ${indexedDuration}ms, Non-indexed: ${nonIndexedDuration}ms`,
      );

      // Both should be performant
      expect(indexedDuration).toBeLessThan(
        PERF_THRESHOLDS.COMPLEX_QUERY_MS,
      );
      expect(nonIndexedDuration).toBeLessThan(
        PERF_THRESHOLDS.COMPLEX_QUERY_MS,
      );
    });

    it('should verify ORDER BY performance impact', async () => {
      const withOrderStartTime = Date.now();
      await documentService.findOrganizationKnowledge(organizationId, {
        limit: 100,
      });
      const withOrderDuration = Date.now() - withOrderStartTime;

      console.log(`Query with ORDER BY: ${withOrderDuration}ms`);

      // ORDER BY should not significantly impact performance
      expect(withOrderDuration).toBeLessThan(
        PERF_THRESHOLDS.COMPLEX_QUERY_MS,
      );
    });
  });

  describe('6. Memory and Resource Usage', () => {
    it('should not leak memory during repeated queries', async () => {
      const iterations = 100;
      const memBefore = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        await documentService.searchByTags(organizationId, ['testing'], {
          limit: 10,
        });
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const memAfter = process.memoryUsage().heapUsed;
      const memIncrease = (memAfter - memBefore) / 1024 / 1024; // Convert to MB

      console.log(`Memory increase after ${iterations} queries: ${memIncrease.toFixed(2)} MB`);

      // Memory increase should be minimal (less than 10MB)
      expect(memIncrease).toBeLessThan(10);
    });

    it('should handle large content documents efficiently', async () => {
      // Create a document with large content
      const largeContent = 'x'.repeat(10000); // 10KB content
      const doc = await documentService.create({
        title: 'Large Content Test',
        content: largeContent,
        type: DocumentType.KNOWLEDGE,
        organizationId,
        teamId,
        tags: ['large-test'],
      });

      documentIds.push(doc.id);

      const startTime = Date.now();
      const results = await documentService.searchByTags(organizationId, [
        'large-test',
      ]);
      const duration = Date.now() - startTime;

      console.log(`Large content query: ${duration}ms`);
      expect(results.length).toBe(1);
      expect(results[0].content.length).toBe(10000);
      expect(duration).toBeLessThan(PERF_THRESHOLDS.COMPLEX_QUERY_MS);
    });
  });

  describe('7. Performance Regression Detection', () => {
    it('should establish baseline metrics', async () => {
      const metrics = {
        simpleTagSearch: 0,
        multiTagSearch: 0,
        complexFilter: 0,
        orgKnowledge: 0,
        projectDocs: 0,
      };

      let start = Date.now();
      await documentService.searchByTags(organizationId, ['api']);
      metrics.simpleTagSearch = Date.now() - start;

      start = Date.now();
      await documentService.searchByTags(organizationId, [
        'typescript',
        'security',
      ]);
      metrics.multiTagSearch = Date.now() - start;

      start = Date.now();
      await documentService.searchByTags(organizationId, ['testing'], {
        type: DocumentType.KNOWLEDGE,
        projectId: projectId,
      });
      metrics.complexFilter = Date.now() - start;

      start = Date.now();
      await documentService.findOrganizationKnowledge(organizationId);
      metrics.orgKnowledge = Date.now() - start;

      start = Date.now();
      await documentService.findProjectDocuments(projectId);
      metrics.projectDocs = Date.now() - start;

      console.log('Baseline Performance Metrics:', JSON.stringify(metrics, null, 2));

      // All metrics should be within acceptable ranges
      expect(metrics.simpleTagSearch).toBeLessThan(
        PERF_THRESHOLDS.SIMPLE_QUERY_MS,
      );
      expect(metrics.multiTagSearch).toBeLessThan(
        PERF_THRESHOLDS.COMPLEX_QUERY_MS,
      );
      expect(metrics.complexFilter).toBeLessThan(
        PERF_THRESHOLDS.COMPLEX_QUERY_MS,
      );
      expect(metrics.orgKnowledge).toBeLessThan(
        PERF_THRESHOLDS.COMPLEX_QUERY_MS,
      );
      expect(metrics.projectDocs).toBeLessThan(
        PERF_THRESHOLDS.COMPLEX_QUERY_MS,
      );
    });
  });
});
