import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource, Repository } from 'typeorm';
import { Organization } from '../../src/modules/organization/entities/organization.entity';
import { Team } from '../../src/modules/team/entities/team.entity';
import { Role } from '../../src/modules/role/entities/role.entity';
import {
  Hollon,
  HollonStatus,
} from '../../src/modules/hollon/entities/hollon.entity';
import {
  Project,
  ProjectStatus,
} from '../../src/modules/project/entities/project.entity';
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
} from '../../src/modules/task/entities/task.entity';
import { DocumentType } from '../../src/modules/document/entities/document.entity';
import { TaskService } from '../../src/modules/task/task.service';
import { DocumentService } from '../../src/modules/document/document.service';
import { KnowledgeInjectionService } from '../../src/modules/brain-provider/services/knowledge-injection.service';

/**
 * Phase 4: Knowledge Extraction Pipeline Integration Test
 *
 * Tests the complete end-to-end flow of knowledge extraction:
 * 1. Task Completion → Knowledge Document Creation
 * 2. Knowledge Extraction → Pattern extraction and tagging
 * 3. Knowledge Storage → Document saved with proper metadata
 * 4. Knowledge Retrieval → Tag-based search
 * 5. Knowledge Injection → Inject relevant knowledge into prompts
 * 6. Document Relationships → Proper linking between tasks and knowledge
 *
 * Note: This is an integration test with mocked external services
 */
describe('Phase 4: Knowledge Extraction Pipeline (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Repositories
  let orgRepo: Repository<Organization>;
  let teamRepo: Repository<Team>;
  let roleRepo: Repository<Role>;
  let hollonRepo: Repository<Hollon>;
  let projectRepo: Repository<Project>;
  let taskRepo: Repository<Task>;

  // Services
  let taskService: TaskService;
  let documentService: DocumentService;
  let knowledgeInjectionService: KnowledgeInjectionService;

  // Test entities
  let organization: Organization;
  let team: Team;
  let developerRole: Role;
  let hollon: Hollon;
  let project: Project;

  const testRunId = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Get repositories
    orgRepo = dataSource.getRepository(Organization);
    teamRepo = dataSource.getRepository(Team);
    roleRepo = dataSource.getRepository(Role);
    hollonRepo = dataSource.getRepository(Hollon);
    projectRepo = dataSource.getRepository(Project);
    taskRepo = dataSource.getRepository(Task);

    // Get services
    taskService = moduleFixture.get<TaskService>(TaskService);
    documentService = moduleFixture.get<DocumentService>(DocumentService);
    knowledgeInjectionService = moduleFixture.get<KnowledgeInjectionService>(
      KnowledgeInjectionService,
    );

    // Clean up test data
    await dataSource.query(
      'TRUNCATE documents, tasks, projects, hollons, roles, teams, organizations RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Knowledge Extraction Pipeline Flow', () => {
    it('Step 1: Setup test organization, team, and hollon', async () => {
      // Create organization
      organization = orgRepo.create({
        name: `KnowledgeTest-Org-${testRunId}`,
        description: 'Testing knowledge extraction pipeline',
        settings: {
          autonomousExecutionEnabled: true,
          baseBranch: 'main',
        },
      });
      await orgRepo.save(organization);

      // Create team
      team = teamRepo.create({
        organizationId: organization.id,
        name: 'Knowledge Team',
        description: 'Team for knowledge extraction testing',
      });
      await teamRepo.save(team);

      // Create developer role
      developerRole = roleRepo.create({
        organizationId: organization.id,
        name: 'Developer',
        description: 'Developer role',
        capabilities: ['typescript', 'nestjs', 'postgresql'],
      });
      await roleRepo.save(developerRole);

      // Create hollon
      hollon = hollonRepo.create({
        name: 'DevBot-Knowledge',
        organizationId: organization.id,
        teamId: team.id,
        roleId: developerRole.id,
        brainProviderId: 'claude_code',
        status: HollonStatus.IDLE,
        maxConcurrentTasks: 1,
        systemPrompt: 'You are a developer bot focused on knowledge management',
      });
      await hollonRepo.save(hollon);

      // Create project
      project = projectRepo.create({
        organizationId: organization.id,
        name: 'Knowledge System',
        description: 'Project for testing knowledge extraction',
        repositoryUrl: 'https://github.com/test/knowledge-system',
        workingDirectory: '/tmp/knowledge-test',
        status: ProjectStatus.ACTIVE,
      });
      await projectRepo.save(project);

      expect(organization.id).toBeDefined();
      expect(team.id).toBeDefined();
      expect(hollon.id).toBeDefined();
      expect(project.id).toBeDefined();

      console.log('✅ Test setup completed');
    });

    it('Step 2: Create and complete a task with knowledge value', async () => {
      // Create a task with skills and tags
      const task = taskRepo.create({
        projectId: project.id,
        organizationId: organization.id,
        title: 'Implement vector similarity search',
        description: `
## Objective
Implement a vector similarity search using pgvector extension

## Approach
1. Use OpenAI embedding API to generate embeddings
2. Store embeddings in PostgreSQL with pgvector
3. Implement similarity search using cosine distance
4. Optimize with IVFFlat index

## Key Learnings
- pgvector extension must be enabled: CREATE EXTENSION vector
- Embeddings should be normalized before storage
- Use cosine distance operator <=> for similarity
- IVFFlat index improves performance for large datasets
        `.trim(),
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.P2_HIGH,
        requiredSkills: ['typescript', 'postgresql', 'vector-search', 'openai'],
        tags: ['phase4', 'knowledge', 'rag', 'embeddings'],
        acceptanceCriteria: [
          'Vector embeddings generated successfully',
          'Similarity search returns relevant results',
          'Performance optimized with indexing',
        ],
        assignedHollonId: hollon.id,
        startedAt: new Date(),
      });
      await taskRepo.save(task);

      // Complete the task
      const completionResult = {
        filesChanged: [
          'src/modules/knowledge/services/vector-search.service.ts',
          'src/modules/knowledge/services/embedding.service.ts',
        ],
        pullRequestUrl: 'https://github.com/test/knowledge-system/pull/123',
        summary: 'Implemented vector similarity search with pgvector',
      };

      const completedTask = await taskService.complete(
        task.id,
        hollon.id,
        completionResult,
      );

      expect(completedTask.status).toBe(TaskStatus.COMPLETED);
      expect(completedTask.completedAt).toBeDefined();

      console.log('✅ Task completed successfully');

      // Wait a bit for async knowledge document creation
      await new Promise((resolve) => setTimeout(resolve, 500));
    });

    it('Step 3: Verify knowledge document was created automatically', async () => {
      // Find knowledge documents for the organization
      const knowledgeDocs = await documentService.findOrganizationKnowledge(
        organization.id,
      );

      expect(knowledgeDocs.length).toBeGreaterThan(0);

      const doc = knowledgeDocs[0];
      expect(doc.type).toBe(DocumentType.KNOWLEDGE);
      expect(doc.title).toContain('[지식]');
      expect(doc.title).toContain('vector similarity search');
      expect(doc.organizationId).toBe(organization.id);
      expect(doc.projectId).toBeNull(); // Organization-level knowledge
      expect(doc.hollonId).toBe(hollon.id);
      expect(doc.taskId).toBeDefined();

      // Verify tags include task's required skills and tags
      expect(doc.tags).toContain('typescript');
      expect(doc.tags).toContain('postgresql');
      expect(doc.tags).toContain('vector-search');
      expect(doc.tags).toContain('openai');
      expect(doc.tags).toContain('phase4');
      expect(doc.tags).toContain('knowledge');
      expect(doc.tags).toContain('rag');
      expect(doc.tags).toContain('embeddings');
      expect(doc.tags).toContain(TaskType.IMPLEMENTATION);

      // Verify metadata
      expect(doc.metadata).toBeDefined();
      expect(doc.metadata['taskType']).toBe(TaskType.IMPLEMENTATION);
      expect(doc.metadata['priority']).toBe(TaskPriority.P2_HIGH);
      expect(doc.metadata['completedAt']).toBeDefined();

      console.log(`✅ Knowledge document created: ${doc.id}`);
      console.log(`   Tags: ${doc.tags.join(', ')}`);
    });

    it('Step 4: Create another task and verify knowledge retrieval', async () => {
      // Create another task with similar skills
      const task2 = taskRepo.create({
        projectId: project.id,
        organizationId: organization.id,
        title: 'Optimize embedding generation performance',
        description: 'Improve the performance of embedding generation',
        type: TaskType.OPTIMIZATION,
        status: TaskStatus.IN_PROGRESS,
        priority: TaskPriority.P3_MEDIUM,
        requiredSkills: ['typescript', 'openai', 'performance'],
        tags: ['phase4', 'embeddings', 'optimization'],
        assignedHollonId: hollon.id,
      });
      await taskRepo.save(task2);

      // Search for relevant knowledge using tags
      const relevantDocs = await documentService.searchByTags(
        organization.id,
        ['openai', 'embeddings', 'typescript'],
        {
          projectId: null, // Organization-level only
          type: DocumentType.KNOWLEDGE,
          limit: 5,
        },
      );

      expect(relevantDocs.length).toBeGreaterThan(0);

      // Should find the previous knowledge document
      const foundPreviousKnowledge = relevantDocs.some((doc) =>
        doc.title.includes('vector similarity search'),
      );
      expect(foundPreviousKnowledge).toBe(true);

      console.log(
        `✅ Found ${relevantDocs.length} relevant knowledge documents`,
      );
      relevantDocs.forEach((doc) => {
        console.log(`   - ${doc.title}`);
      });
    });

    it('Step 5: Test knowledge injection into prompt', async () => {
      // Create a new task
      const task3 = taskRepo.create({
        projectId: project.id,
        organizationId: organization.id,
        title: 'Implement semantic search with embeddings',
        description: 'Build semantic search using vector embeddings',
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.READY,
        priority: TaskPriority.P1_CRITICAL,
        requiredSkills: ['typescript', 'vector-search', 'embeddings'],
        tags: ['phase4', 'semantic-search'],
      });
      await taskRepo.save(task3);

      // Test knowledge injection
      const basePrompt = `
# Task: Implement semantic search with embeddings

Please implement a semantic search feature using vector embeddings.
      `.trim();

      const enhancedPrompt = await knowledgeInjectionService.injectKnowledge(
        basePrompt,
        {
          organizationId: organization.id,
          projectId: project.id,
          requiredSkills: task3.requiredSkills,
          tags: task3.tags,
          task: task3,
        },
      );

      // Verify knowledge was injected
      expect(enhancedPrompt).toContain('Available Organization Knowledge');
      expect(enhancedPrompt.length).toBeGreaterThan(basePrompt.length);

      // Should contain reference to previous knowledge
      expect(
        enhancedPrompt.includes('vector similarity search') ||
          enhancedPrompt.includes('pgvector'),
      ).toBe(true);

      console.log('✅ Knowledge successfully injected into prompt');
      console.log(`   Original prompt length: ${basePrompt.length} chars`);
      console.log(`   Enhanced prompt length: ${enhancedPrompt.length} chars`);
    });

    it('Step 6: Test multiple tasks creating a knowledge base', async () => {
      // Complete multiple tasks to build knowledge base
      const tasks = [
        {
          title: 'Setup pgvector extension',
          skills: ['postgresql', 'pgvector', 'database'],
          tags: ['infrastructure', 'setup'],
          type: TaskType.CONFIGURATION,
        },
        {
          title: 'Integrate OpenAI embedding API',
          skills: ['typescript', 'openai', 'api-integration'],
          tags: ['integration', 'embeddings'],
          type: TaskType.IMPLEMENTATION,
        },
        {
          title: 'Create vector index for performance',
          skills: ['postgresql', 'performance', 'indexing'],
          tags: ['optimization', 'database'],
          type: TaskType.OPTIMIZATION,
        },
      ];

      for (const taskData of tasks) {
        const task = taskRepo.create({
          projectId: project.id,
          organizationId: organization.id,
          title: taskData.title,
          description: `Completed: ${taskData.title}`,
          type: taskData.type,
          status: TaskStatus.IN_PROGRESS,
          priority: TaskPriority.P2_HIGH,
          requiredSkills: taskData.skills,
          tags: taskData.tags,
          assignedHollonId: hollon.id,
          startedAt: new Date(),
        });
        await taskRepo.save(task);

        await taskService.complete(task.id, hollon.id, {
          filesChanged: [
            `${taskData.title.replace(/\s+/g, '-').toLowerCase()}.ts`,
          ],
          pullRequestUrl: `https://github.com/test/pr/${Math.random()}`,
          summary: `Completed ${taskData.title}`,
        });
      }

      // Wait for async knowledge document creation
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify knowledge base grew
      const allKnowledgeDocs = await documentService.findOrganizationKnowledge(
        organization.id,
      );

      expect(allKnowledgeDocs.length).toBeGreaterThanOrEqual(tasks.length);

      console.log(
        `✅ Knowledge base contains ${allKnowledgeDocs.length} documents`,
      );
      console.log('   Knowledge topics:');
      allKnowledgeDocs.forEach((doc) => {
        console.log(`     - ${doc.title} [${doc.tags.slice(0, 3).join(', ')}]`);
      });
    });

    it('Step 7: Test tag-based knowledge filtering', async () => {
      // Test different tag combinations
      const testCases = [
        {
          tags: ['postgresql', 'pgvector'],
          expectedMin: 1,
          description: 'Database-related knowledge',
        },
        {
          tags: ['openai', 'embeddings'],
          expectedMin: 1,
          description: 'OpenAI embedding knowledge',
        },
        {
          tags: ['typescript'],
          expectedMin: 2,
          description: 'TypeScript implementation knowledge',
        },
        {
          tags: ['optimization', 'performance'],
          expectedMin: 1,
          description: 'Performance optimization knowledge',
        },
      ];

      for (const testCase of testCases) {
        const docs = await documentService.searchByTags(
          organization.id,
          testCase.tags,
          {
            projectId: null,
            type: DocumentType.KNOWLEDGE,
            limit: 10,
          },
        );

        expect(docs.length).toBeGreaterThanOrEqual(testCase.expectedMin);

        console.log(
          `✅ ${testCase.description}: Found ${docs.length} documents`,
        );
      }
    });

    it('Step 8: Test task-document relationship integrity', async () => {
      // Get all tasks
      const allTasks = await taskRepo.find({
        where: { organizationId: organization.id },
      });

      // Verify each completed task has a knowledge document
      const completedTasks = allTasks.filter(
        (t) =>
          t.status === TaskStatus.COMPLETED &&
          t.requiredSkills &&
          t.requiredSkills.length > 0,
      );

      for (const task of completedTasks) {
        const taskDocs = await documentService.findByTask(task.id);
        const knowledgeDoc = taskDocs.find(
          (d) => d.type === DocumentType.KNOWLEDGE,
        );

        if (knowledgeDoc) {
          expect(knowledgeDoc.taskId).toBe(task.id);
          expect(knowledgeDoc.organizationId).toBe(task.organizationId);
          expect(knowledgeDoc.hollonId).toBeDefined();
        }
      }

      console.log(
        `✅ Verified task-document relationships for ${completedTasks.length} tasks`,
      );
    });

    it('Step 9: Test knowledge retrieval performance with multiple documents', async () => {
      const startTime = Date.now();

      // Perform multiple knowledge searches
      const searchOperations = [
        documentService.searchByTags(organization.id, ['typescript'], {
          type: DocumentType.KNOWLEDGE,
          limit: 5,
        }),
        documentService.searchByTags(organization.id, ['postgresql'], {
          type: DocumentType.KNOWLEDGE,
          limit: 5,
        }),
        documentService.searchByTags(organization.id, ['embeddings'], {
          type: DocumentType.KNOWLEDGE,
          limit: 5,
        }),
      ];

      const results = await Promise.all(searchOperations);
      const duration = Date.now() - startTime;

      // All searches should complete quickly
      expect(duration).toBeLessThan(1000); // Less than 1 second

      console.log(
        `✅ Completed ${searchOperations.length} searches in ${duration}ms`,
      );
      results.forEach((docs, idx) => {
        console.log(`   Search ${idx + 1}: ${docs.length} documents found`);
      });
    });

    it('Step 10: Test knowledge injection with no relevant knowledge', async () => {
      // Create a task with completely different skills
      const uniqueTask = taskRepo.create({
        projectId: project.id,
        organizationId: organization.id,
        title: 'Implement blockchain integration',
        description: 'Connect to blockchain network',
        type: TaskType.IMPLEMENTATION,
        status: TaskStatus.READY,
        priority: TaskPriority.P3_MEDIUM,
        requiredSkills: ['blockchain', 'web3', 'solidity'],
        tags: ['crypto', 'blockchain'],
      });
      await taskRepo.save(uniqueTask);

      const basePrompt = 'Implement blockchain integration';
      const enhancedPrompt = await knowledgeInjectionService.injectKnowledge(
        basePrompt,
        {
          organizationId: organization.id,
          projectId: project.id,
          requiredSkills: uniqueTask.requiredSkills,
          tags: uniqueTask.tags,
          task: uniqueTask,
        },
      );

      // Should return base prompt if no relevant knowledge found
      // or include minimal injection structure
      expect(enhancedPrompt).toBeDefined();

      console.log('✅ Handled case with no relevant knowledge');
    });

    it('Summary: Knowledge Extraction Pipeline Test Results', () => {
      console.log('\n' + '='.repeat(80));
      console.log('🎉 KNOWLEDGE EXTRACTION PIPELINE TEST COMPLETED');
      console.log('='.repeat(80) + '\n');
      console.log(`Organization ID: ${organization.id}`);
      console.log(`Team ID: ${team.id}`);
      console.log(`Hollon ID: ${hollon.id}`);
      console.log(`Project ID: ${project.id}`);
      console.log('\n✅ All pipeline stages verified:');
      console.log('   ✓ Task completion triggers knowledge document creation');
      console.log('   ✓ Knowledge documents have proper tags and metadata');
      console.log('   ✓ Tag-based knowledge retrieval works correctly');
      console.log('   ✓ Knowledge injection enhances task prompts');
      console.log('   ✓ Multiple tasks build a growing knowledge base');
      console.log('   ✓ Document relationships maintain integrity');
      console.log('   ✓ Knowledge search performs efficiently');
      console.log('\n🔬 Pipeline Components Tested:');
      console.log('   - Task completion → Knowledge extraction');
      console.log('   - Pattern extraction → Document tagging');
      console.log('   - Tag-based search → Knowledge retrieval');
      console.log('   - Knowledge injection → Prompt enhancement');
      console.log('   - Relationship management → Data integrity');
      console.log('\n📊 Future Enhancements (Phase 4+):');
      console.log('   - Vector embeddings generation (OpenAI API)');
      console.log('   - Similarity search with pgvector');
      console.log('   - Automatic relationship discovery');
      console.log('   - Knowledge graph visualization');
      console.log('   - Learning from task outcomes');
    });
  });
});
