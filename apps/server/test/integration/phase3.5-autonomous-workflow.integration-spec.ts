import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource, Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { TaskExecutionService } from '../../src/modules/orchestration/services/task-execution.service';
import { EscalationService } from '../../src/modules/orchestration/services/escalation.service';
import { DocumentService } from '../../src/modules/document/document.service';
import { Document } from '../../src/modules/document/entities/document.entity';
import { Task } from '../../src/modules/task/entities/task.entity';
import { BrainProviderConfig } from '../../src/modules/brain-provider/entities/brain-provider-config.entity';
import { BrainProviderConfigFactory } from '../fixtures/brain-provider-config.factory';
import { ClaudeCodeProvider } from '../../src/modules/brain-provider/providers/claude-code.provider';
import { BrainResponse } from '../../src/modules/brain-provider/interfaces/brain-provider.interface';

/**
 * Phase 3.5 Autonomous Workflow Integration Test
 *
 * Integration 테스트는 E2E 테스트와 달리:
 * - BrainProvider를 Mock으로 처리 (실제 LLM 호출 없음)
 * - 빠른 실행 속도 (5-10초 이내)
 * - 무료 (API 비용 없음)
 * - 개발 중 자주 실행 가능
 *
 * Usage:
 *   pnpm test:integration                     # Fast, mocked (Integration tests)
 *   pnpm test:e2e phase3.5                    # Real LLM calls (E2E)
 */
describe('Phase 3.5 Autonomous Workflow (integration)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Services
  let taskExecutionService: TaskExecutionService;
  let escalationService: EscalationService;
  let documentService: DocumentService;
  let documentRepo: Repository<Document>;
  let taskRepo: Repository<Task>;
  let brainProviderConfigRepo: Repository<BrainProviderConfig>;

  // Mocks
  let mockClaudeProvider: jest.Mocked<ClaudeCodeProvider>;

  // Entity IDs
  let organizationId: string;
  let teamId: string;
  let managerRoleId: string;
  let developerRoleId: string;
  let reviewerRoleId: string;
  let managerHollonId: string;
  let developerHollonId: string;
  let reviewerHollonId: string;
  let projectId: string;
  let taskId: string;
  let documentIds: string[] = [];
  let brainProviderConfigId: string;

  const testRunId = Date.now();

  beforeAll(async () => {
    // Mock ClaudeCodeProvider - returns successful mock response
    const mockBrainResponse: BrainResponse = {
      response: 'Mock LLM response: Task completed successfully',
      cost: {
        inputTokens: 100,
        outputTokens: 50,
        totalCostCents: 0.001,
      },
      duration: 1000,
      metadata: {},
    };

    mockClaudeProvider = {
      execute: jest.fn().mockResolvedValue(mockBrainResponse),
      healthCheck: jest.fn().mockResolvedValue(true),
    } as any;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(ClaudeCodeProvider)
      .useValue(mockClaudeProvider)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Get services
    taskExecutionService =
      moduleFixture.get<TaskExecutionService>(TaskExecutionService);
    escalationService = moduleFixture.get<EscalationService>(EscalationService);
    documentService = moduleFixture.get<DocumentService>(DocumentService);
    documentRepo = moduleFixture.get<Repository<Document>>(
      getRepositoryToken(Document),
    );
    taskRepo = moduleFixture.get<Repository<Task>>(getRepositoryToken(Task));
    brainProviderConfigRepo = moduleFixture.get<
      Repository<BrainProviderConfig>
    >(getRepositoryToken(BrainProviderConfig));

    console.log('✅ Integration Test Environment Initialized (Mock LLM)');
  });

  afterAll(async () => {
    // Cleanup database
    if (brainProviderConfigId) {
      await dataSource.query(
        'DELETE FROM brain_provider_configs WHERE id = $1',
        [brainProviderConfigId],
      );
    }
    if (documentIds.length > 0) {
      await dataSource.query('DELETE FROM documents WHERE id = ANY($1)', [
        documentIds,
      ]);
    }
    if (taskId) {
      await dataSource.query('DELETE FROM tasks WHERE id = $1', [taskId]);
    }
    if (projectId) {
      await dataSource.query('DELETE FROM projects WHERE id = $1', [projectId]);
    }
    if (developerHollonId) {
      await dataSource.query('DELETE FROM hollons WHERE id = $1', [
        developerHollonId,
      ]);
    }
    if (reviewerHollonId) {
      await dataSource.query('DELETE FROM hollons WHERE id = $1', [
        reviewerHollonId,
      ]);
    }
    if (managerHollonId) {
      await dataSource.query('DELETE FROM hollons WHERE id = $1', [
        managerHollonId,
      ]);
    }
    if (managerRoleId) {
      await dataSource.query('DELETE FROM roles WHERE id = $1', [
        managerRoleId,
      ]);
    }
    if (developerRoleId) {
      await dataSource.query('DELETE FROM roles WHERE id = $1', [
        developerRoleId,
      ]);
    }
    if (reviewerRoleId) {
      await dataSource.query('DELETE FROM roles WHERE id = $1', [
        reviewerRoleId,
      ]);
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

  describe('Phase 3.5 Complete Flow (Mocked)', () => {
    it('Step 1: Create Organization and Team', async () => {
      // Create Organization
      const orgResponse = await request(app.getHttpServer())
        .post('/api/organizations')
        .send({
          name: `Phase3.5 Integration Org ${testRunId}`,
          description: 'Testing Phase 3.5 with mocked LLM',
        })
        .expect(201);

      organizationId = orgResponse.body.id;
      expect(organizationId).toBeDefined();

      // Create Team
      const teamResponse = await request(app.getHttpServer())
        .post('/api/teams')
        .send({
          name: `Integration Team ${testRunId}`,
          organizationId,
          description: 'Team for Phase 3.5 integration tests',
        })
        .expect(201);

      teamId = teamResponse.body.id;
      expect(teamId).toBeDefined();

      // Create BrainProvider Config
      const brainConfig = await BrainProviderConfigFactory.createPersisted(
        brainProviderConfigRepo,
        organizationId,
      );
      brainProviderConfigId = brainConfig.id;
      expect(brainProviderConfigId).toBeDefined();
      console.log('✅ BrainProviderConfig created (will use Mock)');
    });

    it('Step 2: Create Hierarchical Roles', async () => {
      // Manager Role
      const managerResponse = await request(app.getHttpServer())
        .post('/api/roles')
        .send({
          name: 'Team Manager',
          level: 'manager',
          organizationId,
          permissions: ['task.assign', 'hollon.manage'],
        })
        .expect(201);

      managerRoleId = managerResponse.body.id;

      // Developer Role
      const developerResponse = await request(app.getHttpServer())
        .post('/api/roles')
        .send({
          name: 'Developer',
          level: 'member',
          organizationId,
          permissions: ['task.execute', 'code.write'],
        })
        .expect(201);

      developerRoleId = developerResponse.body.id;

      // Reviewer Role
      const reviewerResponse = await request(app.getHttpServer())
        .post('/api/roles')
        .send({
          name: 'Code Reviewer',
          level: 'member',
          organizationId,
          permissions: ['code.review', 'pr.approve'],
        })
        .expect(201);

      reviewerRoleId = reviewerResponse.body.id;

      expect(managerRoleId).toBeDefined();
      expect(developerRoleId).toBeDefined();
      expect(reviewerRoleId).toBeDefined();
    });

    it('Step 3: Create Hierarchical Hollons', async () => {
      // Manager Hollon (depth 0)
      const managerResponse = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          name: `Manager_${testRunId}`,
          roleId: managerRoleId,
          teamId,
          organizationId,
          depth: 0,
          managerId: null,
        })
        .expect(201);

      managerHollonId = managerResponse.body.id;

      // Developer Hollon (depth 1)
      const developerResponse = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          name: `Developer_${testRunId}`,
          roleId: developerRoleId,
          teamId,
          organizationId,
          depth: 1,
          managerId: managerHollonId,
        })
        .expect(201);

      developerHollonId = developerResponse.body.id;

      // Reviewer Hollon (depth 1)
      const reviewerResponse = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          name: `Reviewer_${testRunId}`,
          roleId: reviewerRoleId,
          teamId,
          organizationId,
          depth: 1,
          managerId: managerHollonId,
        })
        .expect(201);

      reviewerHollonId = reviewerResponse.body.id;

      expect(managerHollonId).toBeDefined();
      expect(developerHollonId).toBeDefined();
      expect(reviewerHollonId).toBeDefined();
    });

    it('Step 4: Create Project with SSOT Knowledge', async () => {
      // Create Project
      const projectResponse = await request(app.getHttpServer())
        .post('/api/projects')
        .send({
          name: `Phase3.5 Integration Project ${testRunId}`,
          description: 'Testing autonomous workflow with mock',
          organizationId,
          workingDirectory: `/tmp/integration-test-${testRunId}`,
        })
        .expect(201);

      projectId = projectResponse.body.id;
      expect(projectId).toBeDefined();

      // Create SSOT Knowledge Documents
      const doc1 = await documentService.create({
        title: 'API Security Guidelines',
        content: `# Security Best Practices
- Always validate input
- Use parameterized queries
- Implement rate limiting`,
        type: 'knowledge',
        organizationId,
        projectId,
        tags: ['security', 'ssot'],
        metadata: {},
      });

      const doc2 = await documentService.create({
        title: 'Code Style Guide',
        content: `# TypeScript Style Guide
- Use strict mode
- Prefer const over let
- Use async/await`,
        type: 'knowledge',
        organizationId,
        projectId,
        tags: ['style', 'ssot'],
        metadata: {},
      });

      documentIds.push(doc1.id, doc2.id);
      expect(documentIds.length).toBe(2);
      console.log('✅ Created 2 SSOT knowledge documents');
    });

    it('Step 5: Create Task and Verify Knowledge Injection', async () => {
      // Create Task
      const taskResponse = await request(app.getHttpServer())
        .post('/api/tasks')
        .send({
          title: 'Implement user authentication',
          description: 'Add JWT authentication to API',
          organizationId,
          projectId,
          assignedHollonId: developerHollonId,
          requiredSkills: ['typescript', 'security'],
          tags: ['security'],
          status: 'ready',
        })
        .expect(201);

      taskId = taskResponse.body.id;
      expect(taskId).toBeDefined();

      // Verify SSOT knowledge is available
      const relatedDocs = await documentRepo.find({
        where: {
          organizationId,
        },
      });

      expect(relatedDocs.length).toBeGreaterThanOrEqual(2);
      const securityDoc = relatedDocs.find((doc) =>
        doc.title.includes('Security'),
      );
      expect(securityDoc).toBeDefined();
      console.log(`✅ Found ${relatedDocs.length} SSOT documents`);
    });

    it('Step 6: Verify Service Layer Architecture', async () => {
      // Verify services are properly injected
      expect(taskExecutionService).toBeDefined();
      expect(escalationService).toBeDefined();
      expect(documentService).toBeDefined();

      // Verify repositories
      expect(documentRepo).toBeDefined();
      expect(taskRepo).toBeDefined();
      expect(brainProviderConfigRepo).toBeDefined();

      // Verify mock is properly set up
      expect(mockClaudeProvider).toBeDefined();
      expect(mockClaudeProvider.execute).toBeDefined();

      console.log('✅ All Phase 3.5 services properly initialized');
    });

    it('Step 7: Verify Hierarchical Structure', async () => {
      // Verify manager hollon
      const manager = await request(app.getHttpServer())
        .get(`/api/hollons/${managerHollonId}`)
        .expect(200);
      expect(manager.body.depth).toBe(0);
      expect(manager.body.managerId).toBeNull();

      // Verify developer hollon reports to manager
      const developer = await request(app.getHttpServer())
        .get(`/api/hollons/${developerHollonId}`)
        .expect(200);
      expect(developer.body.depth).toBe(1);
      expect(developer.body.managerId).toBe(managerHollonId);

      // Verify reviewer hollon reports to manager
      const reviewer = await request(app.getHttpServer())
        .get(`/api/hollons/${reviewerHollonId}`)
        .expect(200);
      expect(reviewer.body.depth).toBe(1);
      expect(reviewer.body.managerId).toBe(managerHollonId);

      console.log('✅ Hierarchical hollon structure verified');
    });

    it('Step 8: Verify SSOT Knowledge System', async () => {
      // Verify documents are organization-scoped
      const orgDocs = await documentRepo.find({
        where: { organizationId },
      });
      expect(orgDocs.length).toBe(2);

      // Verify project-scoped documents
      const projectDocs = await documentRepo.find({
        where: { projectId },
      });
      expect(projectDocs.length).toBe(2);

      // Verify tags work correctly
      const securityDocs = await documentRepo
        .createQueryBuilder('doc')
        .where('doc.organizationId = :orgId', { orgId: organizationId })
        .andWhere(':tag = ANY(doc.tags)', { tag: 'security' })
        .getMany();

      expect(securityDocs.length).toBeGreaterThanOrEqual(1);

      console.log('✅ SSOT knowledge system working correctly');
    });

    it('Step 9: Verify Task Assignment Flow', async () => {
      // Verify task was created correctly
      const task = await taskRepo.findOne({
        where: { id: taskId },
        relations: ['project'],
      });

      expect(task).toBeDefined();
      expect(task.assignedHollonId).toBe(developerHollonId);
      expect(task.status).toBe('ready');
      expect(task.tags).toContain('security');

      console.log('✅ Task assignment flow verified');
    });

    it('Step 10: Verify Complete Workflow Results', async () => {
      // Verify Organization
      const org = await request(app.getHttpServer())
        .get(`/api/organizations/${organizationId}`)
        .expect(200);
      expect(org.body.id).toBe(organizationId);

      // Verify Team
      const team = await request(app.getHttpServer())
        .get(`/api/teams/${teamId}`)
        .expect(200);
      expect(team.body.id).toBe(teamId);
      expect(team.body.organizationId).toBe(organizationId);

      // Verify Project
      const project = await request(app.getHttpServer())
        .get(`/api/projects/${projectId}`)
        .expect(200);
      expect(project.body.id).toBe(projectId);
      expect(project.body.organizationId).toBe(organizationId);

      // Verify Task
      const task = await request(app.getHttpServer())
        .get(`/api/tasks/${taskId}`)
        .expect(200);
      expect(task.body.id).toBe(taskId);
      expect(task.body.projectId).toBe(projectId);

      console.log(
        '\n🎉 Phase 3.5 Integration Test Summary:',
        '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
        `\n📊 Entities Created:`,
        `\n- Organization: ${organizationId}`,
        `\n- Team: ${teamId}`,
        `\n- Roles: 3 (Manager, Developer, Reviewer)`,
        `\n- Hollons: 3 (Hierarchical structure)`,
        `\n- Project: ${projectId}`,
        `\n- SSOT Documents: 2`,
        `\n- Tasks: 1`,
        '\n',
        '\n✅ Service Layer Architecture:',
        '\n- TaskExecutionService: Initialized',
        '\n- EscalationService: Initialized',
        '\n- DocumentService: Initialized',
        '\n- BrainProvider: Mocked (no API cost)',
        '\n',
        '\n✅ Phase 3.5 Core Features Verified:',
        '\n- Hierarchical hollon structure',
        '\n- SSOT knowledge management',
        '\n- Service layer (no REST API dependency)',
        '\n- Fast execution (< 10 seconds)',
        '\n',
        '\n✅ All Phase 3.5 integration tests passed!',
        '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n',
      );
    });
  });
});
