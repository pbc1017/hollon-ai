import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { getRepositoryToken } from '@nestjs/typeorm';
import configuration from '../../../src/config/configuration';
import { getTestDatabaseConfig } from '../../setup/test-database';
import { CollaborationService } from '../../../src/modules/collaboration/services/collaboration.service';
import { MessageService } from '../../../src/modules/message/message.service';
import {
  CollaborationSession,
  CollaborationStatus,
  CollaborationType,
} from '../../../src/modules/collaboration/entities/collaboration-session.entity';
import {
  Hollon,
  HollonStatus,
  HollonLifecycle,
} from '../../../src/modules/hollon/entities/hollon.entity';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
} from '../../../src/modules/task/entities/task.entity';
import { Organization } from '../../../src/modules/organization/entities/organization.entity';
import { Team } from '../../../src/modules/team/entities/team.entity';
import { Role } from '../../../src/modules/role/entities/role.entity';
import { Project } from '../../../src/modules/project/entities/project.entity';
import { Message } from '../../../src/modules/message/entities/message.entity';
import { OrganizationFactory } from '../../fixtures/organization.factory';
import { TeamFactory } from '../../fixtures/team.factory';
import { CollaborationRequestDto } from '../../../src/modules/collaboration/dto/collaboration-request.dto';

/**
 * Collaboration Service Integration Test
 *
 * Tests the complete collaboration workflow:
 * 1. Collaboration request creation
 * 2. Finding suitable collaborators (algorithm testing)
 * 3. Accept/Reject collaboration
 * 4. Session lifecycle (start → active → completed/cancelled)
 * 5. Message integration
 * 6. Edge cases and error handling
 */
describe('Collaboration Service Integration', () => {
  let module: TestingModule;
  let collaborationService: CollaborationService;
  let messageService: MessageService;

  let organizationRepo: Repository<Organization>;
  let teamRepo: Repository<Team>;
  let roleRepo: Repository<Role>;
  let hollonRepo: Repository<Hollon>;
  let projectRepo: Repository<Project>;
  let taskRepo: Repository<Task>;
  let sessionRepo: Repository<CollaborationSession>;
  let _messageRepo: Repository<Message>;

  // Test data
  let testOrg: Organization;
  let testTeam: Team;
  let testRole1: Role;
  let testRole2: Role;
  let testHollon1: Hollon; // Requester
  let testHollon2: Hollon; // Collaborator 1
  let testHollon3: Hollon; // Collaborator 2
  let testProject: Project;
  let testTask: Task;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          load: [configuration],
        }),
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: (configService: ConfigService) =>
            getTestDatabaseConfig(configService),
          inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([
          Organization,
          Team,
          Role,
          Hollon,
          Project,
          Task,
          CollaborationSession,
          Message,
        ]),
      ],
      providers: [
        CollaborationService,
        {
          provide: MessageService,
          useValue: {
            send: jest.fn().mockResolvedValue({
              id: 'mock-message-id',
              content: 'mock message',
            }),
          },
        },
      ],
    }).compile();

    collaborationService =
      module.get<CollaborationService>(CollaborationService);
    messageService = module.get<MessageService>(MessageService);

    organizationRepo = module.get<Repository<Organization>>(
      getRepositoryToken(Organization),
    );
    teamRepo = module.get<Repository<Team>>(getRepositoryToken(Team));
    roleRepo = module.get<Repository<Role>>(getRepositoryToken(Role));
    hollonRepo = module.get<Repository<Hollon>>(getRepositoryToken(Hollon));
    projectRepo = module.get<Repository<Project>>(getRepositoryToken(Project));
    taskRepo = module.get<Repository<Task>>(getRepositoryToken(Task));
    sessionRepo = module.get<Repository<CollaborationSession>>(
      getRepositoryToken(CollaborationSession),
    );
    _messageRepo = module.get<Repository<Message>>(getRepositoryToken(Message));
  });

  afterAll(async () => {
    await module.close();
  });

  beforeEach(async () => {
    // Reset mock
    jest.clearAllMocks();

    // Create test organization
    testOrg = await OrganizationFactory.createPersisted(organizationRepo, {
      description: 'Collaboration integration test organization',
    });

    // Create test team
    testTeam = await TeamFactory.createPersisted(teamRepo, testOrg.id, {
      description: 'Collaboration integration test team',
    });

    // Create roles with different capabilities
    testRole1 = await roleRepo.save({
      name: 'Backend Engineer',
      description: 'Backend development specialist',
      systemPrompt: 'You are a backend engineer.',
      capabilities: ['typescript', 'nestjs', 'postgresql', 'testing'],
      organizationId: testOrg.id,
    });

    testRole2 = await roleRepo.save({
      name: 'Code Reviewer',
      description: 'Code review specialist',
      systemPrompt: 'You are a code review expert.',
      capabilities: [
        'code-review',
        'quality-assurance',
        'testing',
        'typescript',
      ],
      organizationId: testOrg.id,
    });

    // Create test hollons
    testHollon1 = await hollonRepo.save({
      name: 'Requester Hollon',
      status: HollonStatus.IDLE,
      lifecycle: HollonLifecycle.PERMANENT,
      systemPrompt: 'You are a requester hollon.',
      maxConcurrentTasks: 1,
      organizationId: testOrg.id,
      teamId: testTeam.id,
      roleId: testRole1.id,
    });

    testHollon2 = await hollonRepo.save({
      name: 'Collaborator Hollon 1',
      status: HollonStatus.IDLE,
      lifecycle: HollonLifecycle.PERMANENT,
      systemPrompt: 'You are a collaborator hollon.',
      maxConcurrentTasks: 1,
      organizationId: testOrg.id,
      teamId: testTeam.id,
      roleId: testRole2.id, // Code reviewer role
    });

    testHollon3 = await hollonRepo.save({
      name: 'Collaborator Hollon 2',
      status: HollonStatus.IDLE,
      lifecycle: HollonLifecycle.PERMANENT,
      systemPrompt: 'You are another collaborator hollon.',
      maxConcurrentTasks: 1,
      organizationId: testOrg.id,
      teamId: testTeam.id,
      roleId: testRole1.id, // Backend engineer role
    });

    // Create test project
    testProject = await projectRepo.save({
      name: 'Collaboration Test Project',
      description: 'Test project for collaboration',
      workingDirectory: '/tmp/collab-test',
      organizationId: testOrg.id,
    });

    // Create test task
    testTask = await taskRepo.save({
      title: 'Collaboration Test Task',
      description: 'Test task for collaboration',
      type: TaskType.IMPLEMENTATION,
      priority: TaskPriority.P2_HIGH,
      status: TaskStatus.READY,
      projectId: testProject.id,
    });
  });

  afterEach(async () => {
    // Cleanup in reverse dependency order (CASCADE will handle sessions)
    if (testTask) await taskRepo.delete({ id: testTask.id });
    if (testHollon1) await hollonRepo.delete({ id: testHollon1.id });
    if (testHollon2) await hollonRepo.delete({ id: testHollon2.id });
    if (testHollon3) await hollonRepo.delete({ id: testHollon3.id });
    if (testProject) await projectRepo.delete({ id: testProject.id });
    if (testRole1) await roleRepo.delete({ id: testRole1.id });
    if (testRole2) await roleRepo.delete({ id: testRole2.id });
    if (testTeam) await teamRepo.delete({ id: testTeam.id });
    if (testOrg) await organizationRepo.delete({ id: testOrg.id });
  });

  describe('Collaboration Request Flow', () => {
    it('should create collaboration request and find suitable collaborator', async () => {
      const request: CollaborationRequestDto = {
        type: CollaborationType.CODE_REVIEW,
        taskId: testTask.id,
        description: 'Please review my code changes',
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      // Verify session creation
      expect(session).toBeDefined();
      expect(session.type).toBe(CollaborationType.CODE_REVIEW);
      expect(session.status).toBe(CollaborationStatus.PENDING);
      expect(session.requesterHollonId).toBe(testHollon1.id);
      expect(session.taskId).toBe(testTask.id);
      expect(session.description).toBe('Please review my code changes');

      // Should select testHollon2 (code reviewer) over testHollon3
      expect(session.collaboratorHollonId).toBe(testHollon2.id);

      // Verify message was sent to collaborator
      expect(messageService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          fromId: testHollon1.id,
          toId: testHollon2.id,
          requiresResponse: true,
        }),
      );
    });

    it('should prioritize same team collaborators', async () => {
      // Create another team
      const anotherTeam = await teamRepo.save({
        name: 'Another Team',
        description: 'Different team',
        organizationId: testOrg.id,
      });

      // Create hollon in different team
      const differentTeamHollon = await hollonRepo.save({
        name: 'Different Team Hollon',
        status: HollonStatus.IDLE,
        lifecycle: HollonLifecycle.PERMANENT,
        systemPrompt: 'You are from a different team.',
        maxConcurrentTasks: 1,
        organizationId: testOrg.id,
        teamId: anotherTeam.id,
        roleId: testRole2.id,
      });

      const request: CollaborationRequestDto = {
        type: CollaborationType.CODE_REVIEW,
        preferredTeamId: testTeam.id,
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      // Should select same-team collaborator (testHollon2)
      expect(session.collaboratorHollonId).toBe(testHollon2.id);
      expect(session.collaboratorHollonId).not.toBe(differentTeamHollon.id);

      // Cleanup
      await hollonRepo.delete(differentTeamHollon.id);
      await teamRepo.delete(anotherTeam.id);
    });

    it('should handle no available collaborators gracefully', async () => {
      // Mark all potential collaborators as WORKING
      await hollonRepo.update(testHollon2.id, { status: HollonStatus.WORKING });
      await hollonRepo.update(testHollon3.id, { status: HollonStatus.WORKING });

      const request: CollaborationRequestDto = {
        type: CollaborationType.PAIR_PROGRAMMING,
        description: 'Need help with implementation',
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      // Session created but no collaborator assigned
      expect(session).toBeDefined();
      expect(session.collaboratorHollonId).toBeNull();
      expect(session.status).toBe(CollaborationStatus.PENDING);

      // No message sent
      expect(messageService.send).not.toHaveBeenCalled();

      // Restore hollon status
      await hollonRepo.update(testHollon2.id, { status: HollonStatus.IDLE });
      await hollonRepo.update(testHollon3.id, { status: HollonStatus.IDLE });
    });

    it('should exclude requester from collaborator selection', async () => {
      // Only requester is available
      await hollonRepo.update(testHollon2.id, { status: HollonStatus.WORKING });
      await hollonRepo.update(testHollon3.id, { status: HollonStatus.WORKING });

      const request: CollaborationRequestDto = {
        type: CollaborationType.DEBUGGING,
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      // No collaborator should be assigned (can't collaborate with self)
      expect(session.collaboratorHollonId).toBeNull();

      // Restore
      await hollonRepo.update(testHollon2.id, { status: HollonStatus.IDLE });
      await hollonRepo.update(testHollon3.id, { status: HollonStatus.IDLE });
    });
  });

  describe('Collaboration Accept/Reject', () => {
    let pendingSession: CollaborationSession;

    beforeEach(async () => {
      // Create a pending session
      const request: CollaborationRequestDto = {
        type: CollaborationType.KNOWLEDGE_SHARING,
        description: 'Share architecture patterns',
      };

      pendingSession = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      jest.clearAllMocks(); // Clear the message from request
    });

    it('should accept collaboration and notify requester', async () => {
      const acceptedSession = await collaborationService.acceptCollaboration(
        pendingSession.id,
      );

      expect(acceptedSession.status).toBe(CollaborationStatus.ACCEPTED);

      // Verify notification sent to requester
      expect(messageService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          fromId: pendingSession.collaboratorHollonId,
          toId: pendingSession.requesterHollonId,
          content: expect.stringContaining('accepted'),
        }),
      );
    });

    it('should reject collaboration with reason', async () => {
      const rejectionReason = 'Too busy with other tasks';

      const rejectedSession = await collaborationService.rejectCollaboration(
        pendingSession.id,
        rejectionReason,
      );

      expect(rejectedSession.status).toBe(CollaborationStatus.REJECTED);
      expect(rejectedSession.metadata.rejectionReason).toBe(rejectionReason);

      // Verify notification sent to requester
      expect(messageService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          fromId: pendingSession.collaboratorHollonId,
          toId: pendingSession.requesterHollonId,
          content: expect.stringContaining(rejectionReason),
        }),
      );
    });

    it('should throw error when accepting non-existent session', async () => {
      await expect(
        collaborationService.acceptCollaboration('non-existent-id'),
      ).rejects.toThrow('not found');
    });

    it('should throw error when rejecting non-existent session', async () => {
      await expect(
        collaborationService.rejectCollaboration('non-existent-id'),
      ).rejects.toThrow('not found');
    });
  });

  describe('Session Lifecycle', () => {
    let activeSession: CollaborationSession;

    beforeEach(async () => {
      // Create and accept a session
      const request: CollaborationRequestDto = {
        type: CollaborationType.PAIR_PROGRAMMING,
        taskId: testTask.id,
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      activeSession = await collaborationService.acceptCollaboration(
        session.id,
      );

      jest.clearAllMocks();
    });

    it('should start session and notify both hollons', async () => {
      const startedSession = await collaborationService.startSession(
        activeSession.id,
      );

      expect(startedSession.status).toBe(CollaborationStatus.ACTIVE);
      expect(startedSession.startedAt).toBeDefined();
      expect(startedSession.startedAt).toBeInstanceOf(Date);

      // Verify both hollons notified (2 calls)
      expect(messageService.send).toHaveBeenCalledTimes(2);
      expect(messageService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          toId: activeSession.requesterHollonId,
          content: expect.stringContaining('started'),
        }),
      );
      expect(messageService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          toId: activeSession.collaboratorHollonId,
          content: expect.stringContaining('started'),
        }),
      );
    });

    it('should complete session with outcome', async () => {
      // Start first
      await collaborationService.startSession(activeSession.id);

      const outcome = 'Successfully implemented feature with pair programming';
      const completedSession = await collaborationService.completeSession(
        activeSession.id,
        outcome,
      );

      expect(completedSession.status).toBe(CollaborationStatus.COMPLETED);
      expect(completedSession.completedAt).toBeDefined();
      expect(completedSession.completedAt).toBeInstanceOf(Date);
      expect(completedSession.outcome).toBe(outcome);
    });

    it('should complete session without outcome', async () => {
      await collaborationService.startSession(activeSession.id);

      const completedSession = await collaborationService.completeSession(
        activeSession.id,
      );

      expect(completedSession.status).toBe(CollaborationStatus.COMPLETED);
      expect(completedSession.outcome).toBeNull();
    });

    it('should cancel session', async () => {
      const cancelledSession = await collaborationService.cancelSession(
        activeSession.id,
      );

      expect(cancelledSession.status).toBe(CollaborationStatus.CANCELLED);
    });

    it('should track session duration correctly', async () => {
      const _startedSession = await collaborationService.startSession(
        activeSession.id,
      );

      // Simulate some work (wait 100ms)
      await new Promise((resolve) => setTimeout(resolve, 100));

      const completedSession = await collaborationService.completeSession(
        activeSession.id,
        'Task completed',
      );

      const duration =
        completedSession.completedAt!.getTime() -
        completedSession.startedAt!.getTime();
      expect(duration).toBeGreaterThanOrEqual(100);
    });

    it('should throw error when starting non-existent session', async () => {
      await expect(
        collaborationService.startSession('non-existent-id'),
      ).rejects.toThrow('not found');
    });

    it('should throw error when completing non-existent session', async () => {
      await expect(
        collaborationService.completeSession('non-existent-id'),
      ).rejects.toThrow('not found');
    });

    it('should throw error when cancelling non-existent session', async () => {
      await expect(
        collaborationService.cancelSession('non-existent-id'),
      ).rejects.toThrow('not found');
    });
  });

  describe('Collaborator Matching Algorithm', () => {
    it('should match CODE_REVIEW type with code-review capabilities', async () => {
      const request: CollaborationRequestDto = {
        type: CollaborationType.CODE_REVIEW,
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      // testHollon2 has code-review capability
      expect(session.collaboratorHollonId).toBe(testHollon2.id);
    });

    it('should match DEBUGGING type with debugging capabilities', async () => {
      // Create hollon with debugging capability
      const debuggerRole = await roleRepo.save({
        name: 'Debugger',
        description: 'Debugging specialist',
        systemPrompt: 'You are a debugging expert.',
        capabilities: ['debugging', 'troubleshooting', 'testing'],
        organizationId: testOrg.id,
      });

      const debuggerHollon = await hollonRepo.save({
        name: 'Debugger Hollon',
        status: HollonStatus.IDLE,
        lifecycle: HollonLifecycle.PERMANENT,
        systemPrompt: 'You are a debugger.',
        maxConcurrentTasks: 1,
        organizationId: testOrg.id,
        teamId: testTeam.id,
        roleId: debuggerRole.id,
      });

      const request: CollaborationRequestDto = {
        type: CollaborationType.DEBUGGING,
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      // Should prefer debugger over code reviewer
      expect(session.collaboratorHollonId).toBe(debuggerHollon.id);

      // Cleanup
      await hollonRepo.delete(debuggerHollon.id);
      await roleRepo.delete(debuggerRole.id);
    });

    it('should match ARCHITECTURE_REVIEW with architecture capabilities', async () => {
      // Create architect role
      const architectRole = await roleRepo.save({
        name: 'Architect',
        description: 'Architecture specialist',
        systemPrompt: 'You are a system architect.',
        capabilities: ['architecture', 'system-design', 'design-patterns'],
        organizationId: testOrg.id,
      });

      const architectHollon = await hollonRepo.save({
        name: 'Architect Hollon',
        status: HollonStatus.IDLE,
        lifecycle: HollonLifecycle.PERMANENT,
        systemPrompt: 'You are an architect.',
        maxConcurrentTasks: 1,
        organizationId: testOrg.id,
        teamId: testTeam.id,
        roleId: architectRole.id,
      });

      const request: CollaborationRequestDto = {
        type: CollaborationType.ARCHITECTURE_REVIEW,
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      expect(session.collaboratorHollonId).toBe(architectHollon.id);

      // Cleanup
      await hollonRepo.delete(architectHollon.id);
      await roleRepo.delete(architectRole.id);
    });

    it('should score capability matches correctly', async () => {
      // testHollon2: code-review, quality-assurance, testing, typescript
      // testHollon3: typescript, nestjs, postgresql, testing

      const request: CollaborationRequestDto = {
        type: CollaborationType.CODE_REVIEW, // Prefers: code-review, testing, quality-assurance, typescript
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      // testHollon2 should score higher (has code-review and quality-assurance)
      expect(session.collaboratorHollonId).toBe(testHollon2.id);
    });
  });

  describe('Active Sessions Query', () => {
    it('should return active sessions for a hollon as requester', async () => {
      // Create and start session
      const request: CollaborationRequestDto = {
        type: CollaborationType.PAIR_PROGRAMMING,
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );
      await collaborationService.acceptCollaboration(session.id);
      await collaborationService.startSession(session.id);

      const activeSessions = await collaborationService.getActiveSessions(
        testHollon1.id,
      );

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe(session.id);
      expect(activeSessions[0].status).toBe(CollaborationStatus.ACTIVE);
    });

    it('should return active sessions for a hollon as collaborator', async () => {
      const request: CollaborationRequestDto = {
        type: CollaborationType.CODE_REVIEW,
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );
      await collaborationService.acceptCollaboration(session.id);
      await collaborationService.startSession(session.id);

      const activeSessions = await collaborationService.getActiveSessions(
        testHollon2.id,
      );

      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe(session.id);
    });

    it('should not return pending or completed sessions', async () => {
      // Create pending session
      const request1: CollaborationRequestDto = {
        type: CollaborationType.PAIR_PROGRAMMING,
      };
      await collaborationService.requestCollaboration(testHollon1.id, request1);

      // Create completed session
      const request2: CollaborationRequestDto = {
        type: CollaborationType.CODE_REVIEW,
      };
      const session2 = await collaborationService.requestCollaboration(
        testHollon1.id,
        request2,
      );
      await collaborationService.acceptCollaboration(session2.id);
      await collaborationService.startSession(session2.id);
      await collaborationService.completeSession(session2.id);

      const activeSessions = await collaborationService.getActiveSessions(
        testHollon1.id,
      );

      expect(activeSessions).toHaveLength(0);
    });

    it('should return empty array for hollon with no active sessions', async () => {
      const activeSessions = await collaborationService.getActiveSessions(
        testHollon3.id,
      );

      expect(activeSessions).toEqual([]);
    });
  });

  describe('Session Retrieval', () => {
    it('should get session with relations', async () => {
      const request: CollaborationRequestDto = {
        type: CollaborationType.KNOWLEDGE_SHARING,
        taskId: testTask.id,
      };

      const createdSession = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      const session = await collaborationService.getSession(createdSession.id);

      expect(session).toBeDefined();
      expect(session.id).toBe(createdSession.id);
      expect(session.requesterHollon).toBeDefined();
      expect(session.requesterHollon.id).toBe(testHollon1.id);
      expect(session.collaboratorHollon).toBeDefined();
      expect(session.task).toBeDefined();
      expect(session.task!.id).toBe(testTask.id);
    });

    it('should throw error when getting non-existent session', async () => {
      await expect(
        collaborationService.getSession('non-existent-id'),
      ).rejects.toThrow('not found');
    });
  });

  describe('Complete Collaboration Workflow', () => {
    it('should execute full collaboration lifecycle: request → accept → start → complete', async () => {
      // 1. Request collaboration
      const request: CollaborationRequestDto = {
        type: CollaborationType.PAIR_PROGRAMMING,
        taskId: testTask.id,
        description: 'Implement authentication feature together',
        metadata: { estimatedDuration: 3600 },
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      expect(session.status).toBe(CollaborationStatus.PENDING);
      expect(session.type).toBe(CollaborationType.PAIR_PROGRAMMING);
      expect(session.requesterHollonId).toBe(testHollon1.id);
      expect(session.collaboratorHollonId).toBeDefined();

      // 2. Accept collaboration
      const acceptedSession = await collaborationService.acceptCollaboration(
        session.id,
      );

      expect(acceptedSession.status).toBe(CollaborationStatus.ACCEPTED);

      // 3. Start session
      const activeSession = await collaborationService.startSession(session.id);

      expect(activeSession.status).toBe(CollaborationStatus.ACTIVE);
      expect(activeSession.startedAt).toBeDefined();

      // 4. Complete session
      const outcome = 'Authentication feature implemented successfully';
      const completedSession = await collaborationService.completeSession(
        session.id,
        outcome,
      );

      expect(completedSession.status).toBe(CollaborationStatus.COMPLETED);
      expect(completedSession.completedAt).toBeDefined();
      expect(completedSession.outcome).toBe(outcome);

      // Verify session persisted correctly
      const finalSession = await collaborationService.getSession(session.id);
      expect(finalSession.status).toBe(CollaborationStatus.COMPLETED);
    });

    it('should handle collaboration rejection workflow', async () => {
      // 1. Request collaboration
      const request: CollaborationRequestDto = {
        type: CollaborationType.CODE_REVIEW,
        description: 'Review authentication changes',
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      expect(session.status).toBe(CollaborationStatus.PENDING);

      // 2. Reject collaboration
      const rejectionReason = 'Currently working on critical bug fix';
      const rejectedSession = await collaborationService.rejectCollaboration(
        session.id,
        rejectionReason,
      );

      expect(rejectedSession.status).toBe(CollaborationStatus.REJECTED);
      expect(rejectedSession.metadata.rejectionReason).toBe(rejectionReason);

      // Verify session persisted correctly
      const finalSession = await collaborationService.getSession(session.id);
      expect(finalSession.status).toBe(CollaborationStatus.REJECTED);
    });

    it('should handle collaboration cancellation after acceptance', async () => {
      // Request and accept
      const request: CollaborationRequestDto = {
        type: CollaborationType.DEBUGGING,
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );
      await collaborationService.acceptCollaboration(session.id);

      // Cancel before starting
      const cancelledSession = await collaborationService.cancelSession(
        session.id,
      );

      expect(cancelledSession.status).toBe(CollaborationStatus.CANCELLED);
    });
  });

  describe('Concurrent Collaboration Sessions', () => {
    it('should allow hollon to participate in multiple sessions', async () => {
      // Create session 1: testHollon1 requests, testHollon2 collaborates
      const request1: CollaborationRequestDto = {
        type: CollaborationType.CODE_REVIEW,
      };
      const session1 = await collaborationService.requestCollaboration(
        testHollon1.id,
        request1,
      );
      await collaborationService.acceptCollaboration(session1.id);
      await collaborationService.startSession(session1.id);

      // Mark testHollon2 as IDLE again for another session
      await hollonRepo.update(testHollon2.id, { status: HollonStatus.IDLE });

      // Create session 2: testHollon3 requests, testHollon2 collaborates
      const request2: CollaborationRequestDto = {
        type: CollaborationType.CODE_REVIEW,
      };
      const session2 = await collaborationService.requestCollaboration(
        testHollon3.id,
        request2,
      );
      await collaborationService.acceptCollaboration(session2.id);
      await collaborationService.startSession(session2.id);

      // testHollon2 should have 2 active sessions
      const activeSessions = await collaborationService.getActiveSessions(
        testHollon2.id,
      );

      expect(activeSessions).toHaveLength(2);
      expect(activeSessions.map((s) => s.id)).toContain(session1.id);
      expect(activeSessions.map((s) => s.id)).toContain(session2.id);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle metadata correctly', async () => {
      const metadata = {
        priority: 'high',
        estimatedDuration: 7200,
        tools: ['git', 'docker'],
      };

      const request: CollaborationRequestDto = {
        type: CollaborationType.PAIR_PROGRAMMING,
        metadata,
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      expect(session.metadata).toEqual(metadata);
    });

    it('should handle session without task', async () => {
      const request: CollaborationRequestDto = {
        type: CollaborationType.KNOWLEDGE_SHARING,
        description: 'General architecture discussion',
      };

      const session = await collaborationService.requestCollaboration(
        testHollon1.id,
        request,
      );

      expect(session.taskId).toBeNull();
      expect(session.task).toBeUndefined();
    });

    it('should handle all collaboration types', async () => {
      const types = [
        CollaborationType.PAIR_PROGRAMMING,
        CollaborationType.CODE_REVIEW,
        CollaborationType.KNOWLEDGE_SHARING,
        CollaborationType.DEBUGGING,
        CollaborationType.ARCHITECTURE_REVIEW,
      ];

      for (const type of types) {
        const request: CollaborationRequestDto = { type };
        const session = await collaborationService.requestCollaboration(
          testHollon1.id,
          request,
        );

        expect(session.type).toBe(type);

        // Cleanup
        await sessionRepo.delete(session.id);
      }
    });
  });
});
