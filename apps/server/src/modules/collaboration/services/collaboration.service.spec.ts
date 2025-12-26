import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CollaborationService } from './collaboration.service';
import {
  CollaborationSession,
  CollaborationType,
  CollaborationStatus,
} from '../entities/collaboration-session.entity';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';
import { MessageService } from '../../message/message.service';
import {
  MessageType,
  ParticipantType,
} from '../../message/entities/message.entity';
import { CollaborationRequestDto } from '../dto/collaboration-request.dto';

describe('CollaborationService', () => {
  let service: CollaborationService;

  const mockSessionRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
  };

  const mockHollonRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockMessageService = {
    send: jest.fn(),
  };

  const mockHollon: Partial<Hollon> = {
    id: 'hollon-123',
    name: 'Test Hollon',
    status: HollonStatus.IDLE,
    organizationId: 'org-123',
  };

  const mockCollaborator: Partial<Hollon> = {
    id: 'collaborator-456',
    name: 'Collaborator Hollon',
    status: HollonStatus.IDLE,
    organizationId: 'org-123',
  };

  const mockSession: Partial<CollaborationSession> = {
    id: '550e8400-e29b-41d4-a716-446655440000', // Valid UUID
    type: CollaborationType.CODE_REVIEW,
    status: CollaborationStatus.PENDING,
    requesterHollonId: 'hollon-123',
    collaboratorHollonId: 'collaborator-456',
    taskId: 'task-123',
    description: 'Test collaboration',
    metadata: {},
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CollaborationService,
        {
          provide: getRepositoryToken(CollaborationSession),
          useValue: mockSessionRepository,
        },
        {
          provide: getRepositoryToken(Hollon),
          useValue: mockHollonRepository,
        },
        {
          provide: MessageService,
          useValue: mockMessageService,
        },
      ],
    }).compile();

    service = module.get<CollaborationService>(CollaborationService);

    jest.clearAllMocks();

    // Default mock for requester hollon (can be overridden in tests)
    mockHollonRepository.findOne.mockResolvedValue(mockHollon);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('requestCollaboration', () => {
    const request: CollaborationRequestDto = {
      type: CollaborationType.CODE_REVIEW,
      taskId: 'task-123',
      description: 'Please review my code',
      metadata: { priority: 'high' },
    };

    it('should create a collaboration session when collaborator is available', async () => {
      mockHollonRepository.findOne.mockResolvedValue(mockHollon);
      mockHollonRepository.find.mockResolvedValue([mockCollaborator]);
      mockSessionRepository.save.mockResolvedValue({
        id: 'new-session-id',
        type: request.type,
        requesterHollonId: 'hollon-123',
        collaboratorHollonId: mockCollaborator.id,
        taskId: request.taskId,
        description: request.description,
        metadata: request.metadata,
        status: CollaborationStatus.PENDING,
      });
      mockMessageService.send.mockResolvedValue({});

      const result = await service.requestCollaboration('hollon-123', request);

      expect(mockHollonRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'hollon-123' },
      });
      expect(mockHollonRepository.find).toHaveBeenCalledWith({
        where: {
          status: HollonStatus.IDLE,
          organizationId: 'org-123',
        },
        relations: ['role', 'team'],
        take: 50,
      });
      expect(mockSessionRepository.save).toHaveBeenCalledWith({
        type: request.type,
        requesterHollonId: 'hollon-123',
        collaboratorHollonId: mockCollaborator.id,
        taskId: request.taskId,
        description: request.description,
        metadata: request.metadata,
        status: CollaborationStatus.PENDING,
      });
      expect(mockMessageService.send).toHaveBeenCalledWith({
        fromId: 'hollon-123',
        fromType: ParticipantType.HOLLON,
        toId: mockCollaborator.id,
        toType: ParticipantType.HOLLON,
        messageType: MessageType.COLLABORATION_REQUEST,
        content: expect.stringContaining('Collaboration Request'),
        metadata: { sessionId: 'new-session-id' },
        requiresResponse: true,
      });
      expect(result).toHaveProperty('id', 'new-session-id');
      expect(result.status).toBe(CollaborationStatus.PENDING);
    });

    it('should create a session with null collaborator when no available hollons', async () => {
      mockHollonRepository.find.mockResolvedValue([]);
      mockSessionRepository.save.mockResolvedValue({
        id: 'session-no-collaborator',
        type: request.type,
        requesterHollonId: 'hollon-123',
        collaboratorHollonId: null,
        taskId: request.taskId,
        description: request.description,
        metadata: request.metadata,
        status: CollaborationStatus.PENDING,
      });

      const result = await service.requestCollaboration('hollon-123', request);

      expect(mockSessionRepository.save).toHaveBeenCalledWith({
        type: request.type,
        requesterHollonId: 'hollon-123',
        collaboratorHollonId: null,
        taskId: request.taskId,
        description: request.description,
        metadata: request.metadata,
        status: CollaborationStatus.PENDING,
      });
      expect(mockMessageService.send).not.toHaveBeenCalled();
      expect(result.collaboratorHollonId).toBeNull();
    });

    it('should handle optional fields correctly', async () => {
      const minimalRequest: CollaborationRequestDto = {
        type: CollaborationType.PAIR_PROGRAMMING,
      };

      mockHollonRepository.find.mockResolvedValue([]);
      mockSessionRepository.save.mockResolvedValue({
        id: 'minimal-session',
        type: minimalRequest.type,
        requesterHollonId: 'hollon-123',
        collaboratorHollonId: null,
        taskId: null,
        description: null,
        metadata: {},
        status: CollaborationStatus.PENDING,
      });

      const result = await service.requestCollaboration(
        'hollon-123',
        minimalRequest,
      );

      expect(mockSessionRepository.save).toHaveBeenCalledWith({
        type: minimalRequest.type,
        requesterHollonId: 'hollon-123',
        collaboratorHollonId: null,
        taskId: null,
        description: null,
        metadata: {},
        status: CollaborationStatus.PENDING,
      });
      expect(result.taskId).toBeNull();
      expect(result.description).toBeNull();
    });

    it('should exclude the requester from candidates', async () => {
      // 요청자만 있는 경우 - 협력자가 없어야 함
      const requesterOnly: Partial<Hollon> = {
        id: 'hollon-123',
        name: 'Requester Hollon',
        status: HollonStatus.IDLE,
        teamId: 'team-123',
      };

      mockHollonRepository.find.mockResolvedValue([requesterOnly]);
      mockSessionRepository.save.mockResolvedValue({
        id: 'session-no-match',
        type: CollaborationType.CODE_REVIEW,
        requesterHollonId: 'hollon-123',
        collaboratorHollonId: null,
        status: CollaborationStatus.PENDING,
      });

      const result = await service.requestCollaboration('hollon-123', request);

      expect(result.collaboratorHollonId).toBeNull();
      expect(mockMessageService.send).not.toHaveBeenCalled();
    });

    it('should prioritize hollons from preferred team', async () => {
      const sameTeamHollon: Partial<Hollon> = {
        id: 'same-team-hollon',
        name: 'Same Team Hollon',
        status: HollonStatus.IDLE,
        teamId: 'team-123',
      };
      const differentTeamHollon: Partial<Hollon> = {
        id: 'different-team-hollon',
        name: 'Different Team Hollon',
        status: HollonStatus.IDLE,
        teamId: 'team-456',
      };

      // 다른 팀 홀론이 먼저 오도록 배열 순서 설정
      mockHollonRepository.find.mockResolvedValue([
        differentTeamHollon,
        sameTeamHollon,
      ]);
      mockSessionRepository.save.mockImplementation((session) =>
        Promise.resolve({ id: 'new-session', ...session }),
      );
      mockMessageService.send.mockResolvedValue({});

      const requestWithTeam: CollaborationRequestDto = {
        ...request,
        preferredTeamId: 'team-123',
      };

      await service.requestCollaboration('hollon-123', requestWithTeam);

      // 같은 팀 홀론이 선택되어야 함
      expect(mockSessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          collaboratorHollonId: 'same-team-hollon',
        }),
      );
    });

    it('should prioritize hollons with matching capabilities for code review', async () => {
      const reviewerHollon: Partial<Hollon> = {
        id: 'reviewer-hollon',
        name: 'Reviewer Hollon',
        status: HollonStatus.IDLE,
        teamId: 'team-456',
        role: {
          id: 'role-1',
          name: 'Reviewer',
          capabilities: ['code-review', 'testing', 'quality-assurance'],
        },
      } as Partial<Hollon>;
      const developerHollon: Partial<Hollon> = {
        id: 'developer-hollon',
        name: 'Developer Hollon',
        status: HollonStatus.IDLE,
        teamId: 'team-456',
        role: {
          id: 'role-2',
          name: 'Developer',
          capabilities: ['frontend', 'react'],
        },
      } as Partial<Hollon>;

      // 개발자 홀론이 먼저 오도록 배열 순서 설정
      mockHollonRepository.find.mockResolvedValue([
        developerHollon,
        reviewerHollon,
      ]);
      mockSessionRepository.save.mockImplementation((session) =>
        Promise.resolve({ id: 'new-session', ...session }),
      );
      mockMessageService.send.mockResolvedValue({});

      const codeReviewRequest: CollaborationRequestDto = {
        type: CollaborationType.CODE_REVIEW,
        description: 'Please review my code',
      };

      await service.requestCollaboration('hollon-123', codeReviewRequest);

      // 코드 리뷰 capability를 가진 홀론이 선택되어야 함
      expect(mockSessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          collaboratorHollonId: 'reviewer-hollon',
        }),
      );
    });

    it('should prioritize hollons with matching capabilities for debugging', async () => {
      const debuggerHollon: Partial<Hollon> = {
        id: 'debugger-hollon',
        name: 'Debugger Hollon',
        status: HollonStatus.IDLE,
        teamId: 'team-456',
        role: {
          id: 'role-1',
          name: 'Debugger',
          capabilities: ['debugging', 'troubleshooting', 'monitoring'],
        },
      } as Partial<Hollon>;
      const designerHollon: Partial<Hollon> = {
        id: 'designer-hollon',
        name: 'Designer Hollon',
        status: HollonStatus.IDLE,
        teamId: 'team-456',
        role: {
          id: 'role-2',
          name: 'Designer',
          capabilities: ['ui-design', 'figma'],
        },
      } as Partial<Hollon>;

      mockHollonRepository.find.mockResolvedValue([
        designerHollon,
        debuggerHollon,
      ]);
      mockSessionRepository.save.mockImplementation((session) =>
        Promise.resolve({ id: 'new-session', ...session }),
      );
      mockMessageService.send.mockResolvedValue({});

      const debuggingRequest: CollaborationRequestDto = {
        type: CollaborationType.DEBUGGING,
        description: 'Need help debugging an issue',
      };

      await service.requestCollaboration('hollon-123', debuggingRequest);

      // 디버깅 capability를 가진 홀론이 선택되어야 함
      expect(mockSessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          collaboratorHollonId: 'debugger-hollon',
        }),
      );
    });

    it('should combine team priority and capability matching', async () => {
      const sameTeamNoCapability: Partial<Hollon> = {
        id: 'same-team-no-cap',
        name: 'Same Team No Capability',
        status: HollonStatus.IDLE,
        teamId: 'team-123',
        role: {
          id: 'role-1',
          name: 'Designer',
          capabilities: ['ui-design'],
        },
      } as Partial<Hollon>;
      const differentTeamWithCapability: Partial<Hollon> = {
        id: 'diff-team-with-cap',
        name: 'Different Team With Capability',
        status: HollonStatus.IDLE,
        teamId: 'team-456',
        role: {
          id: 'role-2',
          name: 'Architect',
          capabilities: ['architecture', 'system-design', 'design-patterns'],
        },
      } as Partial<Hollon>;

      mockHollonRepository.find.mockResolvedValue([
        sameTeamNoCapability,
        differentTeamWithCapability,
      ]);
      mockSessionRepository.save.mockImplementation((session) =>
        Promise.resolve({ id: 'new-session', ...session }),
      );
      mockMessageService.send.mockResolvedValue({});

      const architectureRequest: CollaborationRequestDto = {
        type: CollaborationType.ARCHITECTURE_REVIEW,
        description: 'Need architecture review',
        preferredTeamId: 'team-123',
      };

      await service.requestCollaboration('hollon-123', architectureRequest);

      // 같은 팀 +10점, capability 매칭 +15점(최대)
      // same-team-no-cap: 10점 (팀만)
      // diff-team-with-cap: 15점 (3개 capability 매칭)
      // 따라서 diff-team-with-cap이 선택되어야 함
      expect(mockSessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          collaboratorHollonId: 'diff-team-with-cap',
        }),
      );
    });

    it('should select hollon with highest combined score when both team and capability match', async () => {
      const sameTeamWithPartialCapability: Partial<Hollon> = {
        id: 'same-team-partial-cap',
        name: 'Same Team Partial Capability',
        status: HollonStatus.IDLE,
        teamId: 'team-123',
        role: {
          id: 'role-1',
          name: 'Developer',
          capabilities: ['typescript', 'react'], // 1개 매칭 = 5점, 팀 +10점 = 15점
        },
      } as Partial<Hollon>;
      const differentTeamWithFullCapability: Partial<Hollon> = {
        id: 'diff-team-full-cap',
        name: 'Different Team Full Capability',
        status: HollonStatus.IDLE,
        teamId: 'team-456',
        role: {
          id: 'role-2',
          name: 'Full Stack Developer',
          capabilities: ['typescript', 'nestjs', 'react', 'programming'], // 4개 매칭 = 15점(최대)
        },
      } as Partial<Hollon>;

      mockHollonRepository.find.mockResolvedValue([
        differentTeamWithFullCapability,
        sameTeamWithPartialCapability,
      ]);
      mockSessionRepository.save.mockImplementation((session) =>
        Promise.resolve({ id: 'new-session', ...session }),
      );
      mockMessageService.send.mockResolvedValue({});

      const pairRequest: CollaborationRequestDto = {
        type: CollaborationType.PAIR_PROGRAMMING,
        description: 'Need pair programming partner',
        preferredTeamId: 'team-123',
      };

      await service.requestCollaboration('hollon-123', pairRequest);

      // same-team-partial-cap: 10 + 10 = 20점 (팀 + 2개 capability)
      // diff-team-full-cap: 0 + 15 = 15점 (capability만)
      // 따라서 same-team-partial-cap이 선택되어야 함
      expect(mockSessionRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          collaboratorHollonId: 'same-team-partial-cap',
        }),
      );
    });
  });

  describe('acceptCollaboration', () => {
    it('should accept a collaboration session', async () => {
      const pendingSession = {
        ...mockSession,
        status: CollaborationStatus.PENDING,
      };
      mockSessionRepository.findOne.mockResolvedValue(pendingSession);
      mockSessionRepository.save.mockResolvedValue({
        ...pendingSession,
        status: CollaborationStatus.ACCEPTED,
      });
      mockMessageService.send.mockResolvedValue({});

      const result = await service.acceptCollaboration(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
        relations: ['requesterHollon', 'collaboratorHollon'],
      });
      expect(mockSessionRepository.save).toHaveBeenCalledWith({
        ...pendingSession,
        status: CollaborationStatus.ACCEPTED,
      });
      expect(mockMessageService.send).toHaveBeenCalledWith({
        fromId: pendingSession.collaboratorHollonId,
        fromType: ParticipantType.HOLLON,
        toId: pendingSession.requesterHollonId,
        toType: ParticipantType.HOLLON,
        messageType: MessageType.RESPONSE,
        content: expect.stringContaining('accepted'),
        metadata: { sessionId: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(result.status).toBe(CollaborationStatus.ACCEPTED);
    });

    it('should throw NotFoundException for non-existent session', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.acceptCollaboration('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.acceptCollaboration('non-existent')).rejects.toThrow(
        'Session non-existent not found',
      );
    });

    it('should not send message if collaboratorHollonId is null', async () => {
      const sessionWithoutCollaborator = {
        ...mockSession,
        collaboratorHollonId: null,
        status: CollaborationStatus.PENDING,
      };
      mockSessionRepository.findOne.mockResolvedValue(
        sessionWithoutCollaborator,
      );
      mockSessionRepository.save.mockResolvedValue({
        ...sessionWithoutCollaborator,
        status: CollaborationStatus.ACCEPTED,
      });

      await service.acceptCollaboration('550e8400-e29b-41d4-a716-446655440000');

      expect(mockMessageService.send).not.toHaveBeenCalled();
    });
  });

  describe('rejectCollaboration', () => {
    it('should reject a collaboration session with reason', async () => {
      const pendingSession = {
        ...mockSession,
        status: CollaborationStatus.PENDING,
      };
      mockSessionRepository.findOne.mockResolvedValue(pendingSession);
      mockSessionRepository.save.mockResolvedValue({
        ...pendingSession,
        status: CollaborationStatus.REJECTED,
        metadata: { rejectionReason: 'Too busy' },
      });
      mockMessageService.send.mockResolvedValue({});

      const result = await service.rejectCollaboration(
        '550e8400-e29b-41d4-a716-446655440000',
        'Too busy',
      );

      expect(mockSessionRepository.save).toHaveBeenCalledWith({
        ...pendingSession,
        status: CollaborationStatus.REJECTED,
        metadata: { ...pendingSession.metadata, rejectionReason: 'Too busy' },
      });
      expect(mockMessageService.send).toHaveBeenCalledWith({
        fromId: pendingSession.collaboratorHollonId,
        fromType: ParticipantType.HOLLON,
        toId: pendingSession.requesterHollonId,
        toType: ParticipantType.HOLLON,
        messageType: MessageType.RESPONSE,
        content: expect.stringContaining('rejected'),
        metadata: { sessionId: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(result.status).toBe(CollaborationStatus.REJECTED);
    });

    it('should throw NotFoundException for non-existent session', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.rejectCollaboration('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('startSession', () => {
    it('should start a collaboration session and set status to ACTIVE', async () => {
      const acceptedSession = {
        ...mockSession,
        status: CollaborationStatus.ACCEPTED,
      };
      const startedSession = {
        ...acceptedSession,
        status: CollaborationStatus.ACTIVE,
        startedAt: expect.any(Date),
      };

      mockSessionRepository.findOne.mockResolvedValue(acceptedSession);
      mockSessionRepository.save.mockResolvedValue(startedSession);
      mockMessageService.send.mockResolvedValue({});

      const result = await service.startSession(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(mockSessionRepository.save).toHaveBeenCalledWith({
        ...acceptedSession,
        status: CollaborationStatus.ACTIVE,
        startedAt: expect.any(Date),
      });
      expect(result.status).toBe(CollaborationStatus.ACTIVE);
      expect(result.startedAt).toBeDefined();
    });

    it('should notify both requester and collaborator on session start', async () => {
      const acceptedSession = {
        ...mockSession,
        status: CollaborationStatus.ACCEPTED,
      };
      mockSessionRepository.findOne.mockResolvedValue(acceptedSession);
      mockSessionRepository.save.mockResolvedValue({
        ...acceptedSession,
        status: CollaborationStatus.ACTIVE,
        startedAt: new Date(),
      });
      mockMessageService.send.mockResolvedValue({});

      await service.startSession('550e8400-e29b-41d4-a716-446655440000');

      // Should send to requester
      expect(mockMessageService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          toId: acceptedSession.requesterHollonId,
          toType: ParticipantType.HOLLON,
          fromType: ParticipantType.SYSTEM,
          messageType: MessageType.GENERAL,
        }),
      );

      // Should send to collaborator
      expect(mockMessageService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          toId: acceptedSession.collaboratorHollonId,
          toType: ParticipantType.HOLLON,
          fromType: ParticipantType.SYSTEM,
          messageType: MessageType.GENERAL,
        }),
      );

      expect(mockMessageService.send).toHaveBeenCalledTimes(2);
    });

    it('should throw NotFoundException for non-existent session', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.startSession('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.startSession('non-existent')).rejects.toThrow(
        'Session non-existent not found',
      );
    });
  });

  describe('completeSession', () => {
    it('should complete a collaboration session', async () => {
      const activeSession = {
        ...mockSession,
        status: CollaborationStatus.ACTIVE,
        startedAt: new Date(),
      };
      mockSessionRepository.findOne.mockResolvedValue(activeSession);
      mockSessionRepository.save.mockResolvedValue({
        ...activeSession,
        status: CollaborationStatus.COMPLETED,
        completedAt: expect.any(Date),
        outcome: 'Successfully reviewed',
      });

      const result = await service.completeSession(
        '550e8400-e29b-41d4-a716-446655440000',
        'Successfully reviewed',
      );

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
      });
      expect(mockSessionRepository.save).toHaveBeenCalledWith({
        ...activeSession,
        status: CollaborationStatus.COMPLETED,
        completedAt: expect.any(Date),
        outcome: 'Successfully reviewed',
      });
      expect(result.status).toBe(CollaborationStatus.COMPLETED);
      expect(result.completedAt).toBeDefined();
      expect(result.outcome).toBe('Successfully reviewed');
    });

    it('should complete a session without outcome', async () => {
      const activeSession = {
        ...mockSession,
        status: CollaborationStatus.ACTIVE,
      };
      mockSessionRepository.findOne.mockResolvedValue(activeSession);
      mockSessionRepository.save.mockResolvedValue({
        ...activeSession,
        status: CollaborationStatus.COMPLETED,
        completedAt: expect.any(Date),
        outcome: null,
      });

      const result = await service.completeSession(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(mockSessionRepository.save).toHaveBeenCalledWith({
        ...activeSession,
        status: CollaborationStatus.COMPLETED,
        completedAt: expect.any(Date),
        outcome: null,
      });
      expect(result.outcome).toBeNull();
    });

    it('should throw NotFoundException for non-existent session', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.completeSession('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('cancelSession', () => {
    it('should cancel a collaboration session', async () => {
      const pendingSession = {
        ...mockSession,
        status: CollaborationStatus.PENDING,
      };
      mockSessionRepository.findOne.mockResolvedValue(pendingSession);
      mockSessionRepository.save.mockResolvedValue({
        ...pendingSession,
        status: CollaborationStatus.CANCELLED,
      });

      const result = await service.cancelSession(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(mockSessionRepository.save).toHaveBeenCalledWith({
        ...pendingSession,
        status: CollaborationStatus.CANCELLED,
      });
      expect(result.status).toBe(CollaborationStatus.CANCELLED);
    });

    it('should throw NotFoundException for non-existent session', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.cancelSession('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getActiveSessions', () => {
    it('should return active sessions for a hollon', async () => {
      const activeSessions = [
        {
          ...mockSession,
          status: CollaborationStatus.ACTIVE,
          requesterHollonId: 'hollon-123',
        },
        {
          id: 'session-456',
          type: CollaborationType.PAIR_PROGRAMMING,
          status: CollaborationStatus.ACTIVE,
          collaboratorHollonId: 'hollon-123',
          requesterHollonId: 'other-hollon',
        },
      ];
      mockSessionRepository.find.mockResolvedValue(activeSessions);

      const result = await service.getActiveSessions('hollon-123');

      expect(mockSessionRepository.find).toHaveBeenCalledWith({
        where: [
          {
            requesterHollonId: 'hollon-123',
            status: CollaborationStatus.ACTIVE,
          },
          {
            collaboratorHollonId: 'hollon-123',
            status: CollaborationStatus.ACTIVE,
          },
        ],
        relations: ['requesterHollon', 'collaboratorHollon', 'task'],
      });
      expect(result).toHaveLength(2);
      expect(result.every((s) => s.status === CollaborationStatus.ACTIVE)).toBe(
        true,
      );
    });

    it('should return empty array when no active sessions', async () => {
      mockSessionRepository.find.mockResolvedValue([]);

      const result = await service.getActiveSessions('hollon-123');

      expect(result).toEqual([]);
    });
  });

  describe('getSession', () => {
    it('should return a session with relations', async () => {
      const sessionWithRelations = {
        ...mockSession,
        requesterHollon: mockHollon,
        collaboratorHollon: mockCollaborator,
        task: { id: 'task-123', title: 'Test Task' },
      };
      mockSessionRepository.findOne.mockResolvedValue(sessionWithRelations);

      const result = await service.getSession(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(mockSessionRepository.findOne).toHaveBeenCalledWith({
        where: { id: '550e8400-e29b-41d4-a716-446655440000' },
        relations: ['requesterHollon', 'collaboratorHollon', 'task'],
      });
      expect(result).toEqual(sessionWithRelations);
    });

    it('should throw NotFoundException for non-existent session', async () => {
      mockSessionRepository.findOne.mockResolvedValue(null);

      await expect(service.getSession('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getSession('non-existent')).rejects.toThrow(
        'Session non-existent not found',
      );
    });
  });
});
