import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { NotFoundException } from '@nestjs/common';
import { CodeReviewService } from './code-review.service';
import {
  TaskPullRequest,
  PullRequestStatus,
  ReviewerType,
} from '../entities/task-pull-request.entity';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';
import { Role } from '../../role/entities/role.entity';
import { HollonService } from '../../hollon/hollon.service';
import { MessageService } from '../../message/message.service';
import { BrainProviderService } from '../../brain-provider/brain-provider.service';
import { MessageType } from '../../message/entities/message.entity';
import { CreatePullRequestDto } from '../dto/create-pull-request.dto';
import { ReviewSubmissionDto } from '../dto/review-submission.dto';

describe('CodeReviewService', () => {
  let service: CodeReviewService;

  const mockPRRepository = {
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    update: jest.fn(),
  };

  const mockTaskRepository = {
    findOne: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockHollonRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
  };

  const mockMessageService = {
    send: jest.fn(),
  };

  const mockBrainProviderService = {
    analyzeTask: jest.fn(),
    generateCode: jest.fn(),
  };

  const mockTask: Partial<Task> = {
    id: 'task-123',
    title: 'Implement JWT Authentication',
    description: 'Add JWT-based authentication middleware',
    status: TaskStatus.IN_PROGRESS,
    projectId: 'project-123',
  };

  const mockAuthorHollon: Partial<Hollon> = {
    id: 'author-hollon-123',
    name: 'Developer Bot',
    status: HollonStatus.WORKING,
    organizationId: 'org-123',
    teamId: 'team-123',
  };

  const mockReviewerHollon: Partial<Hollon> = {
    id: 'reviewer-hollon-456',
    name: 'Review Bot',
    status: HollonStatus.IDLE,
    organizationId: 'org-123',
    teamId: 'team-123',
  };

  const mockPullRequest: Partial<TaskPullRequest> = {
    id: 'pr-123',
    taskId: 'task-123',
    prNumber: 42,
    prUrl: 'https://github.com/org/repo/pull/42',
    repository: 'org/repo',
    branchName: 'feature/jwt-auth',
    status: PullRequestStatus.DRAFT,
    authorHollonId: 'author-hollon-123',
    reviewerHollonId: null,
    reviewerType: null,
    task: mockTask as Task,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CodeReviewService,
        {
          provide: getRepositoryToken(TaskPullRequest),
          useValue: mockPRRepository,
        },
        {
          provide: getRepositoryToken(Task),
          useValue: mockTaskRepository,
        },
        {
          provide: getRepositoryToken(Hollon),
          useValue: mockHollonRepository,
        },
        {
          provide: getRepositoryToken(Role),
          useValue: {
            findOne: jest.fn(),
            find: jest.fn(),
          },
        },
        {
          provide: HollonService,
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            remove: jest.fn(),
          },
        },
        {
          provide: MessageService,
          useValue: mockMessageService,
        },
        {
          provide: BrainProviderService,
          useValue: mockBrainProviderService,
        },
      ],
    }).compile();

    service = module.get<CodeReviewService>(CodeReviewService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createPullRequest', () => {
    const createDto: CreatePullRequestDto = {
      taskId: 'task-123',
      prNumber: 42,
      prUrl: 'https://github.com/org/repo/pull/42',
      repository: 'org/repo',
      branchName: 'feature/jwt-auth',
      authorHollonId: 'author-hollon-123',
    };

    it('should create a PR and link it to task', async () => {
      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockPRRepository.save.mockResolvedValue({
        id: 'new-pr-id',
        ...createDto,
        status: PullRequestStatus.DRAFT,
      });
      mockTaskRepository.save.mockResolvedValue({
        ...mockTask,
        status: TaskStatus.IN_REVIEW,
      });

      const result = await service.createPullRequest(createDto);

      expect(mockTaskRepository.findOne).toHaveBeenCalledWith({
        where: { id: createDto.taskId },
      });
      expect(mockPRRepository.save).toHaveBeenCalledWith({
        taskId: createDto.taskId,
        prNumber: createDto.prNumber,
        prUrl: createDto.prUrl,
        repository: createDto.repository,
        branchName: createDto.branchName,
        authorHollonId: createDto.authorHollonId,
        status: PullRequestStatus.DRAFT,
      });
      expect(mockTaskRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TaskStatus.IN_REVIEW,
        }),
      );
      expect(result.id).toBe('new-pr-id');
      expect(result.status).toBe(PullRequestStatus.DRAFT);
    });

    it('should throw NotFoundException when task does not exist', async () => {
      mockTaskRepository.findOne.mockResolvedValue(null);

      await expect(service.createPullRequest(createDto)).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.createPullRequest(createDto)).rejects.toThrow(
        `Task ${createDto.taskId} not found`,
      );
    });

    it('should create PR without optional fields', async () => {
      const minimalDto: CreatePullRequestDto = {
        taskId: 'task-123',
        prNumber: 42,
        prUrl: 'https://github.com/org/repo/pull/42',
        repository: 'org/repo',
      };

      mockTaskRepository.findOne.mockResolvedValue(mockTask);
      mockPRRepository.save.mockResolvedValue({
        id: 'minimal-pr-id',
        ...minimalDto,
        branchName: null,
        authorHollonId: null,
        status: PullRequestStatus.DRAFT,
      });
      mockTaskRepository.save.mockResolvedValue({
        ...mockTask,
        status: TaskStatus.IN_REVIEW,
      });

      const result = await service.createPullRequest(minimalDto);

      expect(mockPRRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          branchName: null,
          authorHollonId: null,
        }),
      );
      expect(result.branchName).toBeNull();
      expect(result.authorHollonId).toBeNull();
    });
  });

  describe('requestReview', () => {
    it('should assign reviewer and update PR status', async () => {
      // Use a general task (no security/auth/architecture/performance keywords)
      const generalTask: Partial<Task> = {
        id: 'task-123',
        title: 'Add user profile page',
        description: 'Create a new user profile component',
        status: TaskStatus.IN_PROGRESS,
        projectId: 'project-123',
      };
      const prWithTask = {
        ...mockPullRequest,
        task: generalTask as Task,
        status: PullRequestStatus.DRAFT,
      };
      mockPRRepository.findOne.mockResolvedValue(prWithTask);
      // findAvailableTeammate calls findOne for author, then find for teammates
      mockHollonRepository.findOne.mockResolvedValue(mockAuthorHollon);
      // Return both author and reviewer, but author will be filtered out
      mockHollonRepository.find.mockResolvedValue([
        mockAuthorHollon,
        mockReviewerHollon,
      ]);
      mockPRRepository.save.mockImplementation((pr) => Promise.resolve(pr));
      mockMessageService.send.mockResolvedValue({});

      const result = await service.requestReview('pr-123');

      expect(mockPRRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'pr-123' },
        relations: ['task'],
      });
      expect(result.status).toBe(PullRequestStatus.READY_FOR_REVIEW);
      expect(result.reviewerHollonId).toBe(mockReviewerHollon.id);
      expect(result.reviewerType).toBe(ReviewerType.TEAM_MEMBER);
      expect(mockMessageService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          toId: mockReviewerHollon.id,
          messageType: MessageType.REVIEW_REQUEST,
          requiresResponse: true,
        }),
      );
    });

    it('should throw NotFoundException when PR does not exist', async () => {
      mockPRRepository.findOne.mockResolvedValue(null);

      await expect(service.requestReview('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should assign specialized reviewer for security-related tasks', async () => {
      const securityTask = {
        ...mockTask,
        title: 'Implement Security Headers',
        description: 'Add security headers to protect against XSS',
      };
      const securityPR = {
        ...mockPullRequest,
        task: securityTask,
      };
      const securityReviewer = {
        ...mockReviewerHollon,
        id: 'security-reviewer',
        name: 'SecurityReviewer',
      };

      mockPRRepository.findOne.mockResolvedValue(securityPR);
      mockHollonRepository.findOne
        .mockResolvedValueOnce(mockAuthorHollon)
        .mockResolvedValueOnce(securityReviewer);
      mockPRRepository.save.mockResolvedValue({
        ...securityPR,
        status: PullRequestStatus.READY_FOR_REVIEW,
        reviewerHollonId: securityReviewer.id,
        reviewerType: ReviewerType.SECURITY_REVIEWER,
      });
      mockMessageService.send.mockResolvedValue({});

      const result = await service.requestReview('pr-123');

      expect(result.reviewerType).toBe(ReviewerType.SECURITY_REVIEWER);
    });
  });

  describe('submitReview', () => {
    const approvalReview: ReviewSubmissionDto = {
      decision: PullRequestStatus.APPROVED,
      comments: 'LGTM! Great work.',
    };

    const changesRequestedReview: ReviewSubmissionDto = {
      decision: PullRequestStatus.CHANGES_REQUESTED,
      comments: 'Please add more tests.',
    };

    it('should approve PR and send notification', async () => {
      const prInReview = {
        ...mockPullRequest,
        status: PullRequestStatus.READY_FOR_REVIEW,
        reviewerHollonId: 'reviewer-hollon-456',
      };
      mockPRRepository.findOne.mockResolvedValue(prInReview);
      mockPRRepository.save.mockResolvedValue({
        ...prInReview,
        status: PullRequestStatus.APPROVED,
        reviewComments: approvalReview.comments,
        approvedAt: expect.any(Date),
      });
      mockMessageService.send.mockResolvedValue({});

      const result = await service.submitReview(
        'pr-123',
        'reviewer-hollon-456',
        approvalReview,
      );

      expect(result.status).toBe(PullRequestStatus.APPROVED);
      expect(result.reviewComments).toBe(approvalReview.comments);
      expect(result.approvedAt).toBeDefined();
      expect(mockMessageService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          toId: prInReview.authorHollonId,
          messageType: MessageType.RESPONSE,
        }),
      );
    });

    it('should request changes and send notification', async () => {
      const prInReview = {
        ...mockPullRequest,
        status: PullRequestStatus.READY_FOR_REVIEW,
        reviewerHollonId: 'reviewer-hollon-456',
      };
      mockPRRepository.findOne.mockResolvedValue(prInReview);
      mockPRRepository.save.mockResolvedValue({
        ...prInReview,
        status: PullRequestStatus.CHANGES_REQUESTED,
        reviewComments: changesRequestedReview.comments,
      });
      mockMessageService.send.mockResolvedValue({});

      const result = await service.submitReview(
        'pr-123',
        'reviewer-hollon-456',
        changesRequestedReview,
      );

      expect(result.status).toBe(PullRequestStatus.CHANGES_REQUESTED);
      expect(result.reviewComments).toBe(changesRequestedReview.comments);
      expect(result.approvedAt).toBeUndefined();
    });

    it('should throw error when wrong reviewer submits', async () => {
      const prInReview = {
        ...mockPullRequest,
        status: PullRequestStatus.READY_FOR_REVIEW,
        reviewerHollonId: 'reviewer-hollon-456',
      };
      mockPRRepository.findOne.mockResolvedValue(prInReview);

      await expect(
        service.submitReview('pr-123', 'wrong-reviewer', approvalReview),
      ).rejects.toThrow('is not the assigned reviewer');
    });

    it('should throw NotFoundException when PR does not exist', async () => {
      mockPRRepository.findOne.mockResolvedValue(null);

      await expect(
        service.submitReview('non-existent', 'reviewer', approvalReview),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('mergePullRequest', () => {
    it('should merge approved PR and complete task', async () => {
      const approvedPR = {
        ...mockPullRequest,
        status: PullRequestStatus.APPROVED,
        task: { ...mockTask, status: TaskStatus.IN_REVIEW },
      };
      mockPRRepository.findOne.mockResolvedValue(approvedPR);
      mockPRRepository.save.mockResolvedValue({
        ...approvedPR,
        status: PullRequestStatus.MERGED,
        mergedAt: expect.any(Date),
      });
      mockTaskRepository.save.mockResolvedValue({
        ...approvedPR.task,
        status: TaskStatus.COMPLETED,
        completedAt: expect.any(Date),
      });

      await service.mergePullRequest('pr-123');

      expect(mockPRRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PullRequestStatus.MERGED,
          mergedAt: expect.any(Date),
        }),
      );
      expect(mockTaskRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TaskStatus.COMPLETED,
          completedAt: expect.any(Date),
        }),
      );
    });

    it('should throw error when PR is not approved', async () => {
      const unapprovedPR = {
        ...mockPullRequest,
        status: PullRequestStatus.READY_FOR_REVIEW,
      };
      mockPRRepository.findOne.mockResolvedValue(unapprovedPR);

      await expect(service.mergePullRequest('pr-123')).rejects.toThrow(
        'is not approved yet',
      );
    });

    it('should throw NotFoundException when PR does not exist', async () => {
      mockPRRepository.findOne.mockResolvedValue(null);

      await expect(service.mergePullRequest('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('closePullRequest', () => {
    it('should close PR and revert task status', async () => {
      const openPR = {
        ...mockPullRequest,
        status: PullRequestStatus.READY_FOR_REVIEW,
        task: { ...mockTask, status: TaskStatus.IN_REVIEW },
      };
      mockPRRepository.findOne.mockResolvedValue(openPR);
      mockPRRepository.save.mockResolvedValue({
        ...openPR,
        status: PullRequestStatus.CLOSED,
        reviewComments: '[CLOSED] No longer needed',
      });
      mockTaskRepository.save.mockResolvedValue({
        ...openPR.task,
        status: TaskStatus.IN_PROGRESS,
      });
      mockMessageService.send.mockResolvedValue({});

      await service.closePullRequest('pr-123', 'No longer needed');

      expect(mockPRRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: PullRequestStatus.CLOSED,
        }),
      );
      expect(mockTaskRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: TaskStatus.IN_PROGRESS,
        }),
      );
    });

    it('should allow closing merged PR in test mode', async () => {
      // In test mode (NODE_ENV=test), merged PRs can be closed (DB-only merge)
      const mergedPR = {
        ...mockPullRequest,
        status: PullRequestStatus.MERGED,
        task: { ...mockTask, status: TaskStatus.COMPLETED },
      };
      mockPRRepository.findOne.mockResolvedValue(mergedPR);
      mockPRRepository.save.mockResolvedValue({
        ...mergedPR,
        status: PullRequestStatus.CLOSED,
      });
      mockTaskRepository.save.mockResolvedValue({
        ...mergedPR.task,
      });
      mockMessageService.send.mockResolvedValue({});

      // Should not throw error in test mode
      await expect(
        service.closePullRequest('pr-123', 'Test close'),
      ).resolves.not.toThrow();
    });

    it('should throw error when PR is already closed', async () => {
      const closedPR = {
        ...mockPullRequest,
        status: PullRequestStatus.CLOSED,
      };
      mockPRRepository.findOne.mockResolvedValue(closedPR);

      await expect(service.closePullRequest('pr-123')).rejects.toThrow(
        'is already closed',
      );
    });

    it('should throw NotFoundException when PR does not exist', async () => {
      mockPRRepository.findOne.mockResolvedValue(null);

      await expect(service.closePullRequest('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reopenReview', () => {
    it('should reopen review and notify reviewer', async () => {
      const changesRequestedPR = {
        ...mockPullRequest,
        status: PullRequestStatus.CHANGES_REQUESTED,
        reviewerHollonId: 'reviewer-hollon-456',
      };
      mockPRRepository.findOne.mockResolvedValue(changesRequestedPR);
      mockPRRepository.save.mockResolvedValue({
        ...changesRequestedPR,
        status: PullRequestStatus.READY_FOR_REVIEW,
      });
      mockMessageService.send.mockResolvedValue({});

      const result = await service.reopenReview(
        'pr-123',
        'I have addressed all comments',
      );

      expect(result.status).toBe(PullRequestStatus.READY_FOR_REVIEW);
      expect(mockMessageService.send).toHaveBeenCalledWith(
        expect.objectContaining({
          toId: 'reviewer-hollon-456',
          messageType: MessageType.REVIEW_REQUEST,
          requiresResponse: true,
        }),
      );
    });

    it('should throw error when PR is not in changes_requested status', async () => {
      const approvedPR = {
        ...mockPullRequest,
        status: PullRequestStatus.APPROVED,
      };
      mockPRRepository.findOne.mockResolvedValue(approvedPR);

      await expect(service.reopenReview('pr-123')).rejects.toThrow(
        "not in 'changes_requested' status",
      );
    });

    it('should throw NotFoundException when PR does not exist', async () => {
      mockPRRepository.findOne.mockResolvedValue(null);

      await expect(service.reopenReview('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('markReadyForReview', () => {
    it('should mark draft PR as ready for review', async () => {
      const draftPR = {
        ...mockPullRequest,
        status: PullRequestStatus.DRAFT,
      };
      mockPRRepository.findOne.mockResolvedValue(draftPR);
      mockHollonRepository.findOne.mockResolvedValue(mockAuthorHollon);
      mockHollonRepository.find.mockResolvedValue([mockReviewerHollon]);
      mockPRRepository.save.mockResolvedValue({
        ...draftPR,
        status: PullRequestStatus.READY_FOR_REVIEW,
        reviewerHollonId: mockReviewerHollon.id,
        reviewerType: ReviewerType.TEAM_MEMBER,
      });
      mockMessageService.send.mockResolvedValue({});

      const result = await service.markReadyForReview('pr-123');

      expect(result.status).toBe(PullRequestStatus.READY_FOR_REVIEW);
    });

    it('should throw error when PR is not draft', async () => {
      const readyPR = {
        ...mockPullRequest,
        status: PullRequestStatus.READY_FOR_REVIEW,
      };
      mockPRRepository.findOne.mockResolvedValue(readyPR);

      await expect(service.markReadyForReview('pr-123')).rejects.toThrow(
        "not in 'draft' status",
      );
    });
  });

  describe('getPullRequestsForTask', () => {
    it('should return all PRs for a task', async () => {
      const prs = [
        { ...mockPullRequest, id: 'pr-1' },
        { ...mockPullRequest, id: 'pr-2', prNumber: 43 },
      ];
      mockPRRepository.find.mockResolvedValue(prs);

      const result = await service.getPullRequestsForTask('task-123');

      expect(mockPRRepository.find).toHaveBeenCalledWith({
        where: { taskId: 'task-123' },
        relations: ['authorHollon', 'reviewerHollon'],
        order: { createdAt: 'DESC' },
      });
      expect(result).toHaveLength(2);
    });
  });

  describe('getPullRequest', () => {
    it('should return PR with relations', async () => {
      mockPRRepository.findOne.mockResolvedValue(mockPullRequest);

      const result = await service.getPullRequest('pr-123');

      expect(mockPRRepository.findOne).toHaveBeenCalledWith({
        where: { id: 'pr-123' },
        relations: ['task', 'authorHollon', 'reviewerHollon'],
      });
      expect(result).toEqual(mockPullRequest);
    });

    it('should throw NotFoundException when PR does not exist', async () => {
      mockPRRepository.findOne.mockResolvedValue(null);

      await expect(service.getPullRequest('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('reviewer selection logic', () => {
    it('should select teammate from same team', async () => {
      // Use a general task (no security/auth/architecture/performance keywords)
      const generalTask: Partial<Task> = {
        id: 'task-123',
        title: 'Add user profile page',
        description: 'Create a new user profile component',
        status: TaskStatus.IN_PROGRESS,
        projectId: 'project-123',
      };
      const prWithTask = {
        ...mockPullRequest,
        task: generalTask as Task,
        status: PullRequestStatus.DRAFT,
      };
      const teammate = {
        ...mockReviewerHollon,
        teamId: 'team-123',
      };

      mockPRRepository.findOne.mockResolvedValue(prWithTask);
      mockHollonRepository.findOne.mockResolvedValue(mockAuthorHollon);
      // Return both author and teammate, author will be filtered out
      mockHollonRepository.find.mockResolvedValue([mockAuthorHollon, teammate]);
      mockPRRepository.save.mockImplementation((pr) => Promise.resolve(pr));
      mockMessageService.send.mockResolvedValue({});

      const result = await service.requestReview('pr-123');

      expect(result.reviewerHollonId).toBe(teammate.id);
      expect(result.reviewerType).toBe(ReviewerType.TEAM_MEMBER);
    });

    it('should fall back to organization hollons when no teammate available', async () => {
      // Use a general task (no security/auth/architecture/performance keywords)
      const generalTask: Partial<Task> = {
        id: 'task-123',
        title: 'Add user profile page',
        description: 'Create a new user profile component',
        status: TaskStatus.IN_PROGRESS,
        projectId: 'project-123',
      };
      const prWithTask = {
        ...mockPullRequest,
        task: generalTask as Task,
        status: PullRequestStatus.DRAFT,
      };
      const orgHollon = {
        ...mockReviewerHollon,
        id: 'org-hollon',
        teamId: 'different-team',
      };

      mockPRRepository.findOne.mockResolvedValue(prWithTask);
      mockHollonRepository.findOne.mockResolvedValue(mockAuthorHollon);
      // First call for teammates returns only author (filtered out = empty)
      // Second call for org hollons returns author + orgHollon
      mockHollonRepository.find
        .mockResolvedValueOnce([mockAuthorHollon]) // teammates: only author, filtered to empty
        .mockResolvedValueOnce([mockAuthorHollon, orgHollon]); // org fallback: author + orgHollon
      mockPRRepository.save.mockImplementation((pr) => Promise.resolve(pr));
      mockMessageService.send.mockResolvedValue({});

      await service.requestReview('pr-123');

      expect(mockHollonRepository.find).toHaveBeenCalledTimes(2);
    });

    it('should exclude author from reviewer candidates', async () => {
      // Use a general task (no security/auth/architecture/performance keywords)
      const generalTask: Partial<Task> = {
        id: 'task-123',
        title: 'Add user profile page',
        description: 'Create a new user profile component',
        status: TaskStatus.IN_PROGRESS,
        projectId: 'project-123',
      };
      const prWithTask = {
        ...mockPullRequest,
        task: generalTask as Task,
        status: PullRequestStatus.DRAFT,
        authorHollonId: 'author-hollon-123',
      };
      // Only the author is available in team
      const authorOnly = {
        ...mockAuthorHollon,
        status: HollonStatus.IDLE,
      };

      // Should fall back to specialized reviewer when no teammates
      const codeReviewer = {
        id: 'code-reviewer',
        name: 'CodeReviewer',
        status: HollonStatus.IDLE,
      };

      mockPRRepository.findOne.mockResolvedValue(prWithTask);
      // findOne is called three times:
      // 1. First for findTeamManager() - checking author's team
      // 2. Second for getting author hollon info (in findAvailableTeammate)
      // 3. Third for finding specialized CodeReviewer (in findOrCreateSpecializedReviewer)
      mockHollonRepository.findOne
        .mockResolvedValueOnce(mockAuthorHollon) // for findTeamManager (no team)
        .mockResolvedValueOnce(mockAuthorHollon) // for getting author team
        .mockResolvedValueOnce(codeReviewer); // for specialized reviewer lookup

      // find is called twice:
      // 1. teammates (returns only author, filtered to empty)
      // 2. org hollons (returns only author, filtered to empty)
      mockHollonRepository.find
        .mockResolvedValueOnce([authorOnly]) // teammates: only author
        .mockResolvedValueOnce([authorOnly]); // org fallback: only author

      mockPRRepository.save.mockImplementation((pr) => Promise.resolve(pr));
      mockMessageService.send.mockResolvedValue({});

      const result = await service.requestReview('pr-123');

      // Author should not be selected as reviewer
      expect(result.reviewerHollonId).not.toBe('author-hollon-123');
      expect(result.reviewerHollonId).toBe('code-reviewer');
    });
  });

  describe('PR type classification', () => {
    it('should classify security-related tasks', async () => {
      const securityTask: Partial<Task> = {
        ...mockTask,
        title: 'Add authentication middleware',
        description: 'Implement secure auth flow',
      };
      const securityPR = {
        ...mockPullRequest,
        task: securityTask,
      };

      mockPRRepository.findOne.mockResolvedValue(securityPR);
      mockHollonRepository.findOne.mockResolvedValue({
        id: 'security-reviewer',
        name: 'SecurityReviewer',
        status: HollonStatus.IDLE,
      });
      mockPRRepository.save.mockImplementation((pr) =>
        Promise.resolve({ ...pr }),
      );
      mockMessageService.send.mockResolvedValue({});

      const result = await service.requestReview('pr-123');

      expect(result.reviewerType).toBe(ReviewerType.SECURITY_REVIEWER);
    });

    it('should classify architecture-related tasks', async () => {
      const archTask: Partial<Task> = {
        ...mockTask,
        title: 'Major refactor of module structure',
        description: 'Restructure the codebase',
      };
      const archPR = {
        ...mockPullRequest,
        task: archTask,
      };

      mockPRRepository.findOne.mockResolvedValue(archPR);
      mockHollonRepository.findOne.mockResolvedValue({
        id: 'arch-reviewer',
        name: 'ArchitectureReviewer',
        status: HollonStatus.IDLE,
      });
      mockPRRepository.save.mockImplementation((pr) =>
        Promise.resolve({ ...pr }),
      );
      mockMessageService.send.mockResolvedValue({});

      const result = await service.requestReview('pr-123');

      expect(result.reviewerType).toBe(ReviewerType.ARCHITECTURE_REVIEWER);
    });

    it('should classify performance-related tasks', async () => {
      const perfTask: Partial<Task> = {
        ...mockTask,
        title: 'Database query optimization',
        description: 'Improve performance of slow queries',
      };
      const perfPR = {
        ...mockPullRequest,
        task: perfTask,
      };

      mockPRRepository.findOne.mockResolvedValue(perfPR);
      mockHollonRepository.findOne.mockResolvedValue({
        id: 'perf-reviewer',
        name: 'PerformanceReviewer',
        status: HollonStatus.IDLE,
      });
      mockPRRepository.save.mockImplementation((pr) =>
        Promise.resolve({ ...pr }),
      );
      mockMessageService.send.mockResolvedValue({});

      const result = await service.requestReview('pr-123');

      expect(result.reviewerType).toBe(ReviewerType.PERFORMANCE_REVIEWER);
    });
  });
});
