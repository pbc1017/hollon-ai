import { Test, TestingModule } from '@nestjs/testing';
import { DecisionLogService, DecisionType } from './decision-log.service';

describe('DecisionLogService', () => {
  let service: DecisionLogService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [DecisionLogService],
    }).compile();

    service = module.get<DecisionLogService>(DecisionLogService);
  });

  afterEach(() => {
    service.clearAll();
  });

  describe('recordDecision', () => {
    it('should record a decision and assign ID and timestamp', () => {
      const decision = service.recordDecision({
        type: DecisionType.SPLIT_TASK,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Should we split this complex task?',
        answer: 'Yes, split into 3 subtasks',
        reasoning: 'Task complexity score is 85, exceeding the threshold',
        tags: ['complexity', 'split'],
      });

      expect(decision.id).toBeDefined();
      expect(decision.id).toContain('decision_');
      expect(decision.timestamp).toBeInstanceOf(Date);
      expect(decision.type).toBe(DecisionType.SPLIT_TASK);
      expect(decision.question).toContain('split');
    });

    it('should store metadata correctly', () => {
      const decision = service.recordDecision({
        type: DecisionType.ARCHITECTURAL,
        taskId: 'task-2',
        hollonId: 'hollon-2',
        question: 'Which database should we use?',
        answer: 'PostgreSQL',
        reasoning: 'Need ACID compliance and JSON support',
        metadata: {
          alternatives: ['MySQL', 'MongoDB'],
          criteriaScore: { postgresql: 9, mysql: 7, mongodb: 6 },
        },
      });

      expect(decision.metadata).toBeDefined();
      expect(decision.metadata?.alternatives).toHaveLength(2);
      expect((decision.metadata?.criteriaScore as any).postgresql).toBe(9);
    });
  });

  describe('getDecisionsForTask', () => {
    it('should return all decisions for a specific task', () => {
      service.recordDecision({
        type: DecisionType.SPLIT_TASK,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Question 1',
        answer: 'Answer 1',
        reasoning: 'Reasoning 1',
      });

      service.recordDecision({
        type: DecisionType.RETRY,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Question 2',
        answer: 'Answer 2',
        reasoning: 'Reasoning 2',
      });

      service.recordDecision({
        type: DecisionType.ESCALATE,
        taskId: 'task-2',
        hollonId: 'hollon-1',
        question: 'Question 3',
        answer: 'Answer 3',
        reasoning: 'Reasoning 3',
      });

      const decisions = service.getDecisionsForTask('task-1');

      expect(decisions).toHaveLength(2);
      expect(decisions.every((d) => d.taskId === 'task-1')).toBe(true);
    });

    it('should return empty array for task with no decisions', () => {
      const decisions = service.getDecisionsForTask('nonexistent-task');
      expect(decisions).toHaveLength(0);
    });
  });

  describe('getDecisionsByHollon', () => {
    it('should return all decisions by a specific hollon', () => {
      service.recordDecision({
        type: DecisionType.SPLIT_TASK,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Q1',
        answer: 'A1',
        reasoning: 'R1',
      });

      service.recordDecision({
        type: DecisionType.RETRY,
        taskId: 'task-2',
        hollonId: 'hollon-1',
        question: 'Q2',
        answer: 'A2',
        reasoning: 'R2',
      });

      service.recordDecision({
        type: DecisionType.ESCALATE,
        taskId: 'task-3',
        hollonId: 'hollon-2',
        question: 'Q3',
        answer: 'A3',
        reasoning: 'R3',
      });

      const decisions = service.getDecisionsByHollon('hollon-1');

      expect(decisions).toHaveLength(2);
      expect(decisions.every((d) => d.hollonId === 'hollon-1')).toBe(true);
    });
  });

  describe('getDecision', () => {
    it('should retrieve a specific decision by ID', () => {
      const recorded = service.recordDecision({
        type: DecisionType.QUALITY_GATE,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Does output meet quality standards?',
        answer: 'Yes',
        reasoning: 'All checks passed',
      });

      const retrieved = service.getDecision(recorded.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(recorded.id);
      expect(retrieved?.question).toBe(recorded.question);
    });

    it('should return null for nonexistent decision ID', () => {
      const decision = service.getDecision('nonexistent-id');
      expect(decision).toBeNull();
    });
  });

  describe('searchSimilarDecisions', () => {
    beforeEach(() => {
      service.recordDecision({
        type: DecisionType.SPLIT_TASK,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Should we split this authentication task?',
        answer: 'Yes, split into login, logout, and registration',
        reasoning: 'Too complex for single implementation',
        tags: ['authentication', 'split', 'complex'],
      });

      service.recordDecision({
        type: DecisionType.ARCHITECTURAL,
        taskId: 'task-2',
        hollonId: 'hollon-1',
        question: 'Which authentication method to use?',
        answer: 'JWT tokens',
        reasoning: 'Stateless and scalable',
        tags: ['authentication', 'jwt'],
      });

      service.recordDecision({
        type: DecisionType.SPLIT_TASK,
        taskId: 'task-3',
        hollonId: 'hollon-2',
        question: 'Should we split this UI redesign task?',
        answer: 'No, keep together',
        reasoning: 'Cohesive visual changes',
        tags: ['ui', 'design'],
      });
    });

    it('should find decisions matching query keywords', () => {
      const results = service.searchSimilarDecisions('authentication split');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].relevanceScore).toBeGreaterThan(0);
      expect(results[0].decision.tags).toContain('authentication');
    });

    it('should filter by decision type', () => {
      const results = service.searchSimilarDecisions('authentication', {
        type: DecisionType.ARCHITECTURAL,
      });

      expect(results).toHaveLength(1);
      expect(results[0].decision.type).toBe(DecisionType.ARCHITECTURAL);
      expect(results[0].decision.answer).toContain('JWT');
    });

    it('should filter by hollon', () => {
      const results = service.searchSimilarDecisions('split', {
        hollonId: 'hollon-1',
      });

      expect(results.every((r) => r.decision.hollonId === 'hollon-1')).toBe(true);
    });

    it('should respect result limit', () => {
      // Add more decisions
      for (let i = 0; i < 15; i++) {
        service.recordDecision({
          type: DecisionType.OTHER,
          taskId: `task-${i}`,
          hollonId: 'hollon-1',
          question: `Question about authentication ${i}`,
          answer: `Answer ${i}`,
          reasoning: `Reasoning ${i}`,
          tags: ['authentication'],
        });
      }

      const results = service.searchSimilarDecisions('authentication', { limit: 5 });

      expect(results).toHaveLength(5);
    });

    it('should return empty array for non-matching query', () => {
      const results = service.searchSimilarDecisions('blockchain cryptocurrency');

      expect(results).toHaveLength(0);
    });

    it('should rank by relevance', () => {
      const results = service.searchSimilarDecisions('split authentication');

      // First result should have higher score than last
      if (results.length > 1) {
        expect(results[0].relevanceScore).toBeGreaterThanOrEqual(
          results[results.length - 1].relevanceScore,
        );
      }
    });
  });

  describe('checkConsistency', () => {
    beforeEach(() => {
      service.recordDecision({
        type: DecisionType.SPLIT_TASK,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Should we split the payment processing task?',
        answer: 'Yes, split into subtasks',
        reasoning: 'Complex payment flow',
      });

      service.recordDecision({
        type: DecisionType.ARCHITECTURAL,
        taskId: 'task-2',
        hollonId: 'hollon-1',
        question: 'Should we use microservices architecture?',
        answer: 'Yes, adopt microservices',
        reasoning: 'Better scalability',
      });
    });

    it('should detect consistent decisions', () => {
      const result = service.checkConsistency({
        type: DecisionType.SPLIT_TASK,
        taskId: 'task-3',
        hollonId: 'hollon-1',
        question: 'Should we split the checkout flow task?',
        answer: 'Yes, split into multiple steps',
        reasoning: 'Similar complexity to payment processing',
      });

      expect(result.isConsistent).toBe(true);
      expect(result.conflictingDecisions).toHaveLength(0);
      expect(result.recommendation).toContain('consistent');
    });

    it('should detect conflicting decisions', () => {
      const result = service.checkConsistency({
        type: DecisionType.SPLIT_TASK,
        taskId: 'task-4',
        hollonId: 'hollon-1',
        question: 'Should we split the payment integration task?',
        answer: 'No, keep it together',
        reasoning: 'Different approach this time',
      });

      expect(result.isConsistent).toBe(false);
      expect(result.conflictingDecisions.length).toBeGreaterThan(0);
      expect(result.recommendation).toContain('conflicting');
    });

    it('should handle decisions with no similar precedent', () => {
      const result = service.checkConsistency({
        type: DecisionType.OTHER,
        taskId: 'task-5',
        hollonId: 'hollon-1',
        question: 'Should we implement blockchain feature?',
        answer: 'Research required',
        reasoning: 'Completely new territory',
      });

      expect(result.isConsistent).toBe(true);
      expect(result.conflictingDecisions).toHaveLength(0);
      expect(result.recommendation).toContain('new decision');
    });
  });

  describe('getStatistics', () => {
    beforeEach(() => {
      service.recordDecision({
        type: DecisionType.SPLIT_TASK,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Q1',
        answer: 'A1',
        reasoning: 'R1',
      });

      service.recordDecision({
        type: DecisionType.SPLIT_TASK,
        taskId: 'task-2',
        hollonId: 'hollon-1',
        question: 'Q2',
        answer: 'A2',
        reasoning: 'R2',
      });

      service.recordDecision({
        type: DecisionType.ESCALATE,
        taskId: 'task-3',
        hollonId: 'hollon-2',
        question: 'Q3',
        answer: 'A3',
        reasoning: 'R3',
      });
    });

    it('should return correct total count', () => {
      const stats = service.getStatistics();

      expect(stats.totalDecisions).toBe(3);
    });

    it('should count decisions by type', () => {
      const stats = service.getStatistics();

      expect(stats.decisionsByType[DecisionType.SPLIT_TASK]).toBe(2);
      expect(stats.decisionsByType[DecisionType.ESCALATE]).toBe(1);
    });

    it('should count decisions by hollon', () => {
      const stats = service.getStatistics();

      expect(stats.decisionsByHollon['hollon-1']).toBe(2);
      expect(stats.decisionsByHollon['hollon-2']).toBe(1);
    });

    it('should return recent decisions sorted by time', () => {
      const stats = service.getStatistics();

      expect(stats.recentDecisions).toHaveLength(3);
      // Most recent should be first
      expect(stats.recentDecisions[0].timestamp.getTime()).toBeGreaterThanOrEqual(
        stats.recentDecisions[1].timestamp.getTime(),
      );
    });
  });

  describe('deleteDecision', () => {
    it('should delete a decision and return true', () => {
      const decision = service.recordDecision({
        type: DecisionType.OTHER,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Q',
        answer: 'A',
        reasoning: 'R',
      });

      const result = service.deleteDecision(decision.id);

      expect(result).toBe(true);
      expect(service.getDecision(decision.id)).toBeNull();
    });

    it('should return false for nonexistent decision', () => {
      const result = service.deleteDecision('nonexistent');
      expect(result).toBe(false);
    });

    it('should remove decision from task index', () => {
      const decision = service.recordDecision({
        type: DecisionType.OTHER,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Q',
        answer: 'A',
        reasoning: 'R',
      });

      service.deleteDecision(decision.id);

      const taskDecisions = service.getDecisionsForTask('task-1');
      expect(taskDecisions).toHaveLength(0);
    });

    it('should remove decision from hollon index', () => {
      const decision = service.recordDecision({
        type: DecisionType.OTHER,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Q',
        answer: 'A',
        reasoning: 'R',
      });

      service.deleteDecision(decision.id);

      const hollonDecisions = service.getDecisionsByHollon('hollon-1');
      expect(hollonDecisions).toHaveLength(0);
    });
  });

  describe('getDecisionsByType', () => {
    beforeEach(() => {
      service.recordDecision({
        type: DecisionType.SPLIT_TASK,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Q1',
        answer: 'A1',
        reasoning: 'R1',
      });

      service.recordDecision({
        type: DecisionType.ESCALATE,
        taskId: 'task-2',
        hollonId: 'hollon-1',
        question: 'Q2',
        answer: 'A2',
        reasoning: 'R2',
      });

      service.recordDecision({
        type: DecisionType.SPLIT_TASK,
        taskId: 'task-3',
        hollonId: 'hollon-2',
        question: 'Q3',
        answer: 'A3',
        reasoning: 'R3',
      });
    });

    it('should return all decisions of specified type', () => {
      const decisions = service.getDecisionsByType(DecisionType.SPLIT_TASK);

      expect(decisions).toHaveLength(2);
      expect(decisions.every((d) => d.type === DecisionType.SPLIT_TASK)).toBe(true);
    });

    it('should return empty array for type with no decisions', () => {
      const decisions = service.getDecisionsByType(DecisionType.QUALITY_GATE);
      expect(decisions).toHaveLength(0);
    });
  });

  describe('getDecisionsByTimeRange', () => {
    it('should return decisions within time range', async () => {
      const startDate = new Date();

      const decision1 = service.recordDecision({
        type: DecisionType.OTHER,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Q1',
        answer: 'A1',
        reasoning: 'R1',
      });

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));

      const decision2 = service.recordDecision({
        type: DecisionType.OTHER,
        taskId: 'task-2',
        hollonId: 'hollon-1',
        question: 'Q2',
        answer: 'A2',
        reasoning: 'R2',
      });

      const endDate = new Date();

      const decisions = service.getDecisionsByTimeRange(startDate, endDate);

      expect(decisions).toHaveLength(2);
      expect(decisions.some((d) => d.id === decision1.id)).toBe(true);
      expect(decisions.some((d) => d.id === decision2.id)).toBe(true);
    });

    it('should exclude decisions outside time range', async () => {
      service.recordDecision({
        type: DecisionType.OTHER,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Q1',
        answer: 'A1',
        reasoning: 'R1',
      });

      await new Promise((resolve) => setTimeout(resolve, 50));

      const startDate = new Date();

      service.recordDecision({
        type: DecisionType.OTHER,
        taskId: 'task-2',
        hollonId: 'hollon-1',
        question: 'Q2',
        answer: 'A2',
        reasoning: 'R2',
      });

      const endDate = new Date();

      const decisions = service.getDecisionsByTimeRange(startDate, endDate);

      expect(decisions).toHaveLength(1);
      expect(decisions[0].taskId).toBe('task-2');
    });
  });

  describe('clearAll', () => {
    it('should clear all decisions and indices', () => {
      service.recordDecision({
        type: DecisionType.OTHER,
        taskId: 'task-1',
        hollonId: 'hollon-1',
        question: 'Q',
        answer: 'A',
        reasoning: 'R',
      });

      service.clearAll();

      expect(service.getAllDecisions()).toHaveLength(0);
      expect(service.getDecisionsForTask('task-1')).toHaveLength(0);
      expect(service.getDecisionsByHollon('hollon-1')).toHaveLength(0);
    });
  });
});
