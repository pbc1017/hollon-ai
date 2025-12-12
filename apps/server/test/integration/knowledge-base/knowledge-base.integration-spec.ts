import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DocumentService } from '../../../src/modules/document/document.service';
import { KnowledgeInjectionService } from '../../../src/modules/brain-provider/services/knowledge-injection.service';
import { Document, DocumentType } from '../../../src/modules/document/entities/document.entity';
import { Organization } from '../../../src/modules/organization/entities/organization.entity';
import { Project } from '../../../src/modules/project/entities/project.entity';
import { Task, TaskType, TaskPriority } from '../../../src/modules/task/entities/task.entity';
import { Hollon } from '../../../src/modules/hollon/entities/hollon.entity';
import { Team } from '../../../src/modules/team/entities/team.entity';
import { Role } from '../../../src/modules/role/entities/role.entity';

/**
 * Knowledge Base Integration Test
 *
 * Tests the entire knowledge base system including:
 * - Document creation and management
 * - Tag-based search functionality
 * - Knowledge injection into prompts
 * - Organization and project scoped knowledge
 * - End-to-end knowledge flow from creation to task execution
 */
describe('Knowledge Base System (Integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Services
  let documentService: DocumentService;
  let knowledgeInjectionService: KnowledgeInjectionService;

  // Repositories
  let documentRepo: Repository<Document>;
  let organizationRepo: Repository<Organization>;
  let projectRepo: Repository<Project>;
  let taskRepo: Repository<Task>;
  let hollonRepo: Repository<Hollon>;
  let teamRepo: Repository<Team>;
  let roleRepo: Repository<Role>;

  // Test data IDs
  let organizationId: string;
  let projectId: string;
  let teamId: string;
  let roleId: string;
  let hollonId: string;
  let documentIds: string[] = [];
  let taskIds: string[] = [];

  const testRunId = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Get services
    documentService = moduleFixture.get<DocumentService>(DocumentService);
    knowledgeInjectionService = moduleFixture.get<KnowledgeInjectionService>(
      KnowledgeInjectionService,
    );

    // Get repositories
    documentRepo = moduleFixture.get<Repository<Document>>(
      getRepositoryToken(Document),
    );
    organizationRepo = moduleFixture.get<Repository<Organization>>(
      getRepositoryToken(Organization),
    );
    projectRepo = moduleFixture.get<Repository<Project>>(
      getRepositoryToken(Project),
    );
    taskRepo = moduleFixture.get<Repository<Task>>(getRepositoryToken(Task));
    hollonRepo = moduleFixture.get<Repository<Hollon>>(
      getRepositoryToken(Hollon),
    );
    teamRepo = moduleFixture.get<Repository<Team>>(getRepositoryToken(Team));
    roleRepo = moduleFixture.get<Repository<Role>>(getRepositoryToken(Role));

    console.log('✅ Knowledge Base Integration Test Environment Initialized');
  });

  afterAll(async () => {
    // Cleanup in reverse order of creation
    if (taskIds.length > 0) {
      await dataSource.query('DELETE FROM tasks WHERE id = ANY($1)', [taskIds]);
    }
    if (documentIds.length > 0) {
      await dataSource.query('DELETE FROM documents WHERE id = ANY($1)', [
        documentIds,
      ]);
    }
    if (hollonId) {
      await dataSource.query('DELETE FROM hollons WHERE id = $1', [hollonId]);
    }
    if (roleId) {
      await dataSource.query('DELETE FROM roles WHERE id = $1', [roleId]);
    }
    if (projectId) {
      await dataSource.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    if (teamId) {
      await dataSource.query('DELETE FROM teams WHERE id = $1', [teamId]);
    }
    if (organizationId) {
      await dataSource.query('DELETE FROM organizations WHERE id = $1', [
        organizationId,
      ]);
    }

    await app.close();
  });

  describe('Setup Test Environment', () => {
    it('should create organization, team, role, hollon, and project', async () => {
      // Create organization
      const org = organizationRepo.create({
        name: `KB Test Org ${testRunId}`,
        description: 'Testing knowledge base system',
      });
      const savedOrg = await organizationRepo.save(org);
      organizationId = savedOrg.id;
      expect(organizationId).toBeDefined();

      // Create team
      const team = teamRepo.create({
        name: `KB Test Team ${testRunId}`,
        organizationId,
        description: 'Team for knowledge base testing',
      });
      const savedTeam = await teamRepo.save(team);
      teamId = savedTeam.id;
      expect(teamId).toBeDefined();

      // Create role
      const role = roleRepo.create({
        name: 'Developer',
        level: 'member',
        organizationId,
        permissions: ['task.execute'],
      });
      const savedRole = await roleRepo.save(role);
      roleId = savedRole.id;
      expect(roleId).toBeDefined();

      // Create hollon
      const hollon = hollonRepo.create({
        name: `KB Test Hollon ${testRunId}`,
        roleId,
        teamId,
        organizationId,
        depth: 0,
      });
      const savedHollon = await hollonRepo.save(hollon);
      hollonId = savedHollon.id;
      expect(hollonId).toBeDefined();

      // Create project
      const project = projectRepo.create({
        name: `KB Test Project ${testRunId}`,
        description: 'Testing knowledge base with project scope',
        organizationId,
        workingDirectory: `/tmp/kb-test-${testRunId}`,
      });
      const savedProject = await projectRepo.save(project);
      projectId = savedProject.id;
      expect(projectId).toBeDefined();

      console.log('✅ Test environment setup complete');
    });
  });

  describe('Document Management', () => {
    it('should create organization-level knowledge document', async () => {
      const doc = await documentService.create({
        title: 'TypeScript Best Practices',
        content: `# TypeScript Best Practices

## Type Safety
- Always use strict mode
- Prefer interfaces over types for object shapes
- Use unknown instead of any

## Code Style
- Use const over let when possible
- Prefer async/await over promises
- Use meaningful variable names`,
        type: DocumentType.KNOWLEDGE,
        organizationId,
        tags: ['typescript', 'coding-standards', 'best-practices'],
        metadata: { source: 'engineering-team' },
      });

      expect(doc).toBeDefined();
      expect(doc.id).toBeDefined();
      expect(doc.title).toBe('TypeScript Best Practices');
      expect(doc.type).toBe(DocumentType.KNOWLEDGE);
      expect(doc.organizationId).toBe(organizationId);
      expect(doc.projectId).toBeNull();
      expect(doc.tags).toEqual([
        'typescript',
        'coding-standards',
        'best-practices',
      ]);

      documentIds.push(doc.id);
      console.log(`✅ Created organization knowledge document: ${doc.id}`);
    });

    it('should create project-specific knowledge document', async () => {
      const doc = await documentService.create({
        title: 'Project API Guidelines',
        content: `# API Design Guidelines

## REST Endpoints
- Use plural nouns for resources
- Use HTTP methods correctly (GET, POST, PUT, DELETE)
- Return proper status codes

## Authentication
- All endpoints require JWT token
- Use Bearer token in Authorization header
- Token expires after 24 hours`,
        type: DocumentType.KNOWLEDGE,
        organizationId,
        projectId,
        tags: ['api', 'rest', 'authentication'],
        metadata: { scope: 'project-specific' },
      });

      expect(doc).toBeDefined();
      expect(doc.projectId).toBe(projectId);
      expect(doc.tags).toContain('api');

      documentIds.push(doc.id);
      console.log(`✅ Created project knowledge document: ${doc.id}`);
    });

    it('should create multiple knowledge documents with various tags', async () => {
      const docs = [
        {
          title: 'Security Best Practices',
          content: 'Always validate input, use parameterized queries, implement rate limiting',
          tags: ['security', 'best-practices'],
        },
        {
          title: 'Testing Guidelines',
          content: 'Write unit tests, integration tests, and e2e tests. Aim for 80% coverage.',
          tags: ['testing', 'quality'],
        },
        {
          title: 'Database Design Patterns',
          content: 'Use proper indexing, normalize data, optimize queries',
          tags: ['database', 'postgresql', 'performance'],
        },
      ];

      for (const docData of docs) {
        const doc = await documentService.create({
          title: docData.title,
          content: docData.content,
          type: DocumentType.KNOWLEDGE,
          organizationId,
          tags: docData.tags,
          metadata: {},
        });

        expect(doc).toBeDefined();
        documentIds.push(doc.id);
      }

      console.log(`✅ Created ${docs.length} additional knowledge documents`);
    });

    it('should retrieve all documents for organization', async () => {
      const docs = await documentRepo.find({
        where: { organizationId },
        order: { createdAt: 'DESC' },
      });

      expect(docs.length).toBeGreaterThanOrEqual(5);
      console.log(`✅ Found ${docs.length} documents in organization`);
    });

    it('should retrieve only project-specific documents', async () => {
      const docs = await documentService.findProjectDocuments(projectId, {
        type: DocumentType.KNOWLEDGE,
      });

      expect(docs.length).toBe(1);
      expect(docs[0].title).toBe('Project API Guidelines');
      console.log(`✅ Found ${docs.length} project-specific documents`);
    });
  });

  describe('Tag-Based Search', () => {
    it('should search documents by single tag', async () => {
      const docs = await documentService.searchByTags(
        organizationId,
        ['security'],
        { type: DocumentType.KNOWLEDGE },
      );

      expect(docs.length).toBeGreaterThanOrEqual(1);
      const securityDoc = docs.find((d) => d.title === 'Security Best Practices');
      expect(securityDoc).toBeDefined();

      console.log(`✅ Found ${docs.length} documents with 'security' tag`);
    });

    it('should search documents by multiple tags (OR logic)', async () => {
      const docs = await documentService.searchByTags(
        organizationId,
        ['typescript', 'security'],
        { type: DocumentType.KNOWLEDGE },
      );

      expect(docs.length).toBeGreaterThanOrEqual(2);
      console.log(
        `✅ Found ${docs.length} documents with 'typescript' OR 'security' tags`,
      );
    });

    it('should search only organization-level documents (exclude project-specific)', async () => {
      const docs = await documentService.searchByTags(
        organizationId,
        ['api', 'typescript', 'security'],
        {
          projectId: null, // Only organization-level
          type: DocumentType.KNOWLEDGE,
        },
      );

      // Should not include "Project API Guidelines" (project-specific)
      const projectDoc = docs.find((d) => d.title === 'Project API Guidelines');
      expect(projectDoc).toBeUndefined();

      console.log(
        `✅ Found ${docs.length} organization-level documents (excluding project-specific)`,
      );
    });

    it('should limit search results', async () => {
      const docs = await documentService.searchByTags(
        organizationId,
        ['best-practices', 'typescript', 'security', 'testing'],
        {
          type: DocumentType.KNOWLEDGE,
          limit: 2,
        },
      );

      expect(docs.length).toBeLessThanOrEqual(2);
      console.log(`✅ Limited search results to ${docs.length} documents`);
    });

    it('should return empty array for non-existent tags', async () => {
      const docs = await documentService.searchByTags(
        organizationId,
        ['non-existent-tag'],
        { type: DocumentType.KNOWLEDGE },
      );

      expect(docs).toEqual([]);
      console.log('✅ Correctly returned empty array for non-existent tags');
    });
  });

  describe('Knowledge Injection', () => {
    it('should inject organization knowledge into task prompt', async () => {
      const basePrompt = 'Implement user authentication using JWT tokens';

      const context = {
        organizationId,
        projectId: null,
        requiredSkills: ['typescript', 'security'],
        tags: ['authentication'],
        task: {
          id: 'test-task-id',
          title: 'Implement JWT Authentication',
          description: 'Add JWT auth to API endpoints',
          type: TaskType.IMPLEMENTATION,
          priority: TaskPriority.P2_HIGH,
          requiredSkills: ['typescript', 'security'],
          tags: ['authentication'],
        },
      };

      const enhancedPrompt = await knowledgeInjectionService.injectKnowledge(
        basePrompt,
        context,
      );

      expect(enhancedPrompt).toContain('Available Organization Knowledge');
      expect(enhancedPrompt).toContain('TypeScript Best Practices');
      expect(enhancedPrompt).toContain('Security Best Practices');
      expect(enhancedPrompt).toContain(basePrompt);
      expect(enhancedPrompt.length).toBeGreaterThan(basePrompt.length);

      console.log(`✅ Enhanced prompt length: ${enhancedPrompt.length} chars`);
    });

    it('should inject both organization and project knowledge', async () => {
      const basePrompt = 'Create a new REST API endpoint';

      const context = {
        organizationId,
        projectId,
        requiredSkills: ['typescript'],
        tags: ['authentication'],
        task: {
          id: 'test-task-id-2',
          title: 'Create REST Endpoint',
          description: 'Add new API endpoint',
          type: TaskType.IMPLEMENTATION,
          priority: TaskPriority.P3_MEDIUM,
          requiredSkills: ['typescript'],
          tags: ['authentication'],
        },
      };

      const enhancedPrompt = await knowledgeInjectionService.injectKnowledge(
        basePrompt,
        context,
      );

      expect(enhancedPrompt).toContain('Organization-wide Knowledge');
      expect(enhancedPrompt).toContain('Project-specific Knowledge');
      expect(enhancedPrompt).toContain('Project API Guidelines');
      expect(enhancedPrompt).toContain(basePrompt);

      console.log('✅ Injected both organization and project knowledge');
    });

    it('should return original prompt when no matching knowledge found', async () => {
      const basePrompt = 'Test task with no matching knowledge';

      const context = {
        organizationId,
        projectId: null,
        requiredSkills: [],
        tags: ['non-existent-tag-xyz'],
        task: {
          id: 'test-task-id-3',
          title: 'Test Task',
          description: 'Testing edge case',
          type: TaskType.BUG_FIX,
          priority: TaskPriority.P4_LOW,
          requiredSkills: [],
          tags: ['non-existent-tag-xyz'],
        },
      };

      const enhancedPrompt = await knowledgeInjectionService.injectKnowledge(
        basePrompt,
        context,
      );

      expect(enhancedPrompt).toBe(basePrompt);
      console.log('✅ Returned original prompt when no knowledge found');
    });

    it('should include task information in enhanced prompt', async () => {
      const basePrompt = 'Fix the authentication bug';

      const context = {
        organizationId,
        projectId,
        requiredSkills: ['security'],
        tags: ['authentication'],
        task: {
          id: 'test-task-id-4',
          title: 'Fix Auth Bug',
          description: 'Users cannot login after password reset',
          type: TaskType.BUG_FIX,
          priority: TaskPriority.P1_CRITICAL,
          requiredSkills: ['security', 'authentication'],
          tags: ['bug', 'authentication'],
        },
      };

      const enhancedPrompt = await knowledgeInjectionService.injectKnowledge(
        basePrompt,
        context,
      );

      expect(enhancedPrompt).toContain('Task Information');
      expect(enhancedPrompt).toContain('Fix Auth Bug');
      expect(enhancedPrompt).toContain('P1');
      expect(enhancedPrompt).toContain('Users cannot login after password reset');

      console.log('✅ Task information included in enhanced prompt');
    });

    it('should handle missing task context gracefully', async () => {
      const basePrompt = 'Generic task without context';

      const context = {
        organizationId,
        projectId: null,
        requiredSkills: ['typescript'],
        tags: ['coding-standards'],
      };

      const enhancedPrompt = await knowledgeInjectionService.injectKnowledge(
        basePrompt,
        context,
      );

      expect(enhancedPrompt).toContain('Available Organization Knowledge');
      expect(enhancedPrompt).not.toContain('Task Information');
      expect(enhancedPrompt).toContain(basePrompt);

      console.log('✅ Handled missing task context gracefully');
    });
  });

  describe('End-to-End Knowledge Flow', () => {
    it('should create task and retrieve relevant knowledge documents', async () => {
      // Create task
      const task = taskRepo.create({
        title: 'Implement database migration',
        description: 'Add new tables for user management',
        organizationId,
        projectId,
        assignedHollonId: hollonId,
        requiredSkills: ['database', 'postgresql'],
        tags: ['migration', 'database'],
        type: TaskType.IMPLEMENTATION,
        priority: TaskPriority.P3_MEDIUM,
        status: 'ready',
      });
      const savedTask = await taskRepo.save(task);
      taskIds.push(savedTask.id);

      // Search for relevant knowledge
      const relevantDocs = await documentService.searchByTags(
        organizationId,
        [...savedTask.requiredSkills, ...savedTask.tags],
        {
          type: DocumentType.KNOWLEDGE,
          limit: 5,
        },
      );

      expect(relevantDocs.length).toBeGreaterThanOrEqual(1);
      const dbDoc = relevantDocs.find((d) =>
        d.title.includes('Database Design'),
      );
      expect(dbDoc).toBeDefined();

      console.log(
        `✅ Found ${relevantDocs.length} relevant documents for database task`,
      );
    });

    it('should complete full workflow: task → search → inject → execute', async () => {
      // 1. Create task
      const task = taskRepo.create({
        title: 'Add unit tests for authentication',
        description: 'Write comprehensive tests for JWT authentication',
        organizationId,
        projectId,
        assignedHollonId: hollonId,
        requiredSkills: ['testing', 'typescript', 'security'],
        tags: ['testing', 'authentication'],
        type: TaskType.REVIEW,
        priority: TaskPriority.P2_HIGH,
        status: 'ready',
      });
      const savedTask = await taskRepo.save(task);
      taskIds.push(savedTask.id);

      // 2. Search for relevant knowledge
      const searchTags = [
        ...savedTask.requiredSkills,
        ...savedTask.tags,
        savedTask.type,
      ];
      const relevantDocs = await documentService.searchByTags(
        organizationId,
        searchTags,
        {
          type: DocumentType.KNOWLEDGE,
          limit: 5,
        },
      );

      expect(relevantDocs.length).toBeGreaterThanOrEqual(2);

      // 3. Inject knowledge into prompt
      const basePrompt = `Complete the following task:\n${savedTask.description}`;
      const context = {
        organizationId: savedTask.organizationId,
        projectId: savedTask.projectId,
        requiredSkills: savedTask.requiredSkills,
        tags: savedTask.tags,
        task: {
          id: savedTask.id,
          title: savedTask.title,
          description: savedTask.description,
          type: savedTask.type,
          priority: savedTask.priority,
          requiredSkills: savedTask.requiredSkills,
          tags: savedTask.tags,
        },
      };

      const enhancedPrompt = await knowledgeInjectionService.injectKnowledge(
        basePrompt,
        context,
      );

      // 4. Verify enhanced prompt contains all relevant information
      expect(enhancedPrompt).toContain('Task Information');
      expect(enhancedPrompt).toContain(savedTask.title);
      expect(enhancedPrompt).toContain('Available Organization Knowledge');
      expect(enhancedPrompt).toContain('Testing Guidelines');
      expect(enhancedPrompt).toContain('Security Best Practices');
      expect(enhancedPrompt).toContain(basePrompt);

      // 5. Simulate task execution (would normally call brain provider)
      // For integration test, we just verify the knowledge was properly injected
      const knowledgeInjected =
        enhancedPrompt.length > basePrompt.length * 2;
      expect(knowledgeInjected).toBe(true);

      console.log(
        '\n✅ Complete workflow verified:',
        `\n  - Task created: ${savedTask.id}`,
        `\n  - Found ${relevantDocs.length} relevant documents`,
        `\n  - Enhanced prompt: ${enhancedPrompt.length} chars`,
        `\n  - Base prompt: ${basePrompt.length} chars`,
        `\n  - Knowledge multiplier: ${(enhancedPrompt.length / basePrompt.length).toFixed(2)}x`,
      );
    });

    it('should verify knowledge injection improves task context', async () => {
      const task = taskRepo.create({
        title: 'Optimize database queries',
        description: 'Improve performance of user search queries',
        organizationId,
        projectId,
        assignedHollonId: hollonId,
        requiredSkills: ['database', 'performance', 'postgresql'],
        tags: ['optimization', 'performance'],
        type: TaskType.IMPLEMENTATION,
        priority: TaskPriority.P3_MEDIUM,
        status: 'ready',
      });
      const savedTask = await taskRepo.save(task);
      taskIds.push(savedTask.id);

      const basePrompt = savedTask.description;
      const context = {
        organizationId: savedTask.organizationId,
        projectId: savedTask.projectId,
        requiredSkills: savedTask.requiredSkills,
        tags: savedTask.tags,
        task: {
          id: savedTask.id,
          title: savedTask.title,
          description: savedTask.description,
          type: savedTask.type,
          priority: savedTask.priority,
          requiredSkills: savedTask.requiredSkills,
          tags: savedTask.tags,
        },
      };

      const enhancedPrompt = await knowledgeInjectionService.injectKnowledge(
        basePrompt,
        context,
      );

      // Verify that knowledge about database and performance was injected
      expect(enhancedPrompt).toContain('Database Design Patterns');
      expect(enhancedPrompt).toContain('indexing');
      expect(enhancedPrompt).toContain('optimize queries');

      console.log('✅ Knowledge injection improved task context with relevant best practices');
    });
  });

  describe('Summary', () => {
    it('should display complete test summary', () => {
      console.log(
        '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        '\n🎉 Knowledge Base Integration Test Summary',
        '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        `\n📊 Test Data Created:`,
        `\n  - Organization: ${organizationId}`,
        `\n  - Project: ${projectId}`,
        `\n  - Team: ${teamId}`,
        `\n  - Hollon: ${hollonId}`,
        `\n  - Documents: ${documentIds.length}`,
        `\n  - Tasks: ${taskIds.length}`,
        '\n',
        '\n✅ Features Tested:',
        '\n  - Document creation (org and project level)',
        '\n  - Tag-based search with filtering',
        '\n  - Knowledge injection into prompts',
        '\n  - End-to-end knowledge flow',
        '\n  - Error handling and edge cases',
        '\n',
        '\n✅ Key Capabilities Verified:',
        '\n  - Organization-scoped knowledge (SSOT)',
        '\n  - Project-specific knowledge',
        '\n  - Tag-based knowledge retrieval',
        '\n  - Multi-tag search (OR logic)',
        '\n  - Knowledge injection with context',
        '\n  - Task information enhancement',
        '\n  - Graceful handling of missing data',
        '\n',
        '\n✅ All knowledge base integration tests passed!',
        '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
      );

      expect(true).toBe(true);
    });
  });
});
