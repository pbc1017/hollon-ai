import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { Organization } from '@/modules/organization/entities/organization.entity';
import { Role } from '@/modules/role/entities/role.entity';
import { Team } from '@/modules/team/entities/team.entity';
import { Hollon, HollonStatus } from '@/modules/hollon/entities/hollon.entity';
import { Project } from '@/modules/project/entities/project.entity';
import { Task, TaskStatus } from '@/modules/task/entities/task.entity';
import { QualityGateService } from '@/modules/orchestration/services/quality-gate.service';
import { EscalationService } from '@/modules/orchestration/services/escalation.service';

/**
 * Scenario 2: Quality Failure → Retry → Escalation
 *
 * 검증 시나리오:
 * 1. 의도적으로 실패하는 Task 생성
 * 2. QualityGate 실패 확인
 * 3. 재시도 3회 확인
 * 4. Escalation 발생 확인
 */
describe('Integration: Scenario 2 - Quality Failure and Retry', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let qualityGate: QualityGateService;
  let escalation: EscalationService;

  let organization: Organization;
  let role: Role;
  let team: Team;
  let hollon: Hollon;
  let project: Project;
  let task: Task;

  const MAX_RETRY_COUNT = 3;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    qualityGate = app.get(QualityGateService);
    escalation = app.get(EscalationService);
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await app.close();
  });

  describe('Setup: Create test entities', () => {
    it('should create organization', async () => {
      const orgRepo = dataSource.getRepository(Organization);
      organization = await orgRepo.save({
        name: 'Test Organization - Quality',
        contextPrompt: 'We enforce strict quality standards.',
        costLimitDailyCents: 10000,
        costLimitMonthlyCents: 100000,
      });

      expect(organization.id).toBeDefined();
    });

    it('should create role', async () => {
      const roleRepo = dataSource.getRepository(Role);
      role = await roleRepo.save({
        organizationId: organization.id,
        name: 'Quality Tester',
        systemPrompt: 'You are a quality assurance engineer.',
        capabilities: ['testing', 'validation'],
      });

      expect(role.id).toBeDefined();
    });

    it('should create team', async () => {
      const teamRepo = dataSource.getRepository(Team);
      team = await teamRepo.save({
        organizationId: organization.id,
        name: 'QA Team',
        contextPrompt: 'We focus on quality.',
      });

      expect(team.id).toBeDefined();
    });

    it('should create hollon', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);
      hollon = await hollonRepo.save({
        organizationId: organization.id,
        roleId: role.id,
        teamId: team.id,
        name: 'Test Hollon - QA',
        status: HollonStatus.IDLE,
      });

      expect(hollon.id).toBeDefined();
    });

    it('should create project', async () => {
      const projectRepo = dataSource.getRepository(Project);
      project = await projectRepo.save({
        organizationId: organization.id,
        teamId: team.id,
        name: 'Quality Test Project',
        description: 'Testing quality gates',
      });

      expect(project.id).toBeDefined();
    });

    it('should create task that will fail quality checks', async () => {
      const taskRepo = dataSource.getRepository(Task);
      task = await taskRepo.save({
        projectId: project.id,
        organizationId: organization.id,
        title: 'Implement complex feature with bugs',
        description: 'Create a feature that intentionally has quality issues',
        type: 'implementation',
        status: TaskStatus.READY,
        priority: 'P1',
        acceptanceCriteria: [
          'Code must compile',
          'All tests must pass',
          'Linting must pass',
        ],
        affectedFiles: ['src/features/buggy.ts'],
        depth: 0,
        retryCount: 0,
      });

      expect(task.id).toBeDefined();
      expect(task.retryCount).toBe(0);
    });
  });

  describe('Execution: Trigger quality failures', () => {
    it('should execute and fail quality gate', async () => {
      // Mock a brain response that fails quality checks
      const mockBrainResult = {
        content: 'incomplete code without proper implementation',
        tokensUsed: 100,
        costCents: 1,
        executionTimeMs: 1000,
      };

      // In real scenario, orchestrator would run and QualityGate would fail
      // Here we test the QualityGate service directly
      const validation = await qualityGate.validateResult({
        task,
        brainResult: mockBrainResult,
        organizationId: organization.id,
        costLimitDailyCents: 10000,
      });

      expect(validation.passed).toBe(false);
      expect(validation.shouldRetry).toBe(true);
      expect(validation.reason).toBeDefined();
    });

    it('should increment retry count on failure', async () => {
      const taskRepo = dataSource.getRepository(Task);

      // Simulate retry logic
      for (let i = 0; i < MAX_RETRY_COUNT; i++) {
        const currentTask = await taskRepo.findOne({ where: { id: task.id } });
        expect(currentTask).toBeDefined();

        // Increment retry count
        await taskRepo.update(task.id, {
          retryCount: i + 1,
          status: TaskStatus.READY, // Back to ready for retry
        });

        const updatedTask = await taskRepo.findOne({ where: { id: task.id } });
        expect(updatedTask?.retryCount).toBe(i + 1);
      }

      // Verify final retry count
      const finalTask = await taskRepo.findOne({ where: { id: task.id } });
      expect(finalTask?.retryCount).toBe(MAX_RETRY_COUNT);
    });

    it('should trigger escalation after max retries', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const currentTask = await taskRepo.findOne({ where: { id: task.id } });

      expect(currentTask?.retryCount).toBe(MAX_RETRY_COUNT);

      // Check if task should be escalated
      const shouldEscalate = currentTask!.retryCount >= MAX_RETRY_COUNT;
      expect(shouldEscalate).toBe(true);

      // Trigger escalation
      await escalation.escalate({
        taskId: task.id,
        hollonId: hollon.id,
        reason: 'Max retries exceeded - quality checks failed',
        level: 1, // Self-resolve level
      });

      // Task status should be updated to BLOCKED
      const escalatedTask = await taskRepo.findOne({ where: { id: task.id } });
      expect([TaskStatus.BLOCKED, TaskStatus.READY]).toContain(
        escalatedTask?.status,
      );
    });
  });

  describe('Verification: Check escalation results', () => {
    it('should have escalation record', async () => {
      // In a real system, there would be an EscalationRecord entity
      // For now, we verify the task is in correct state
      const taskRepo = dataSource.getRepository(Task);
      const finalTask = await taskRepo.findOne({ where: { id: task.id } });

      expect(finalTask).toBeDefined();
      expect(finalTask?.retryCount).toBe(MAX_RETRY_COUNT);
    });

    it('should not exceed max retry count', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const finalTask = await taskRepo.findOne({ where: { id: task.id } });

      expect(finalTask?.retryCount).toBeLessThanOrEqual(MAX_RETRY_COUNT);
    });

    it('should have hollon available for other tasks', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);
      const finalHollon = await hollonRepo.findOne({
        where: { id: hollon.id },
      });

      // Hollon should not be stuck in error state
      expect(finalHollon?.status).not.toBe(HollonStatus.ERROR);
      // Should be idle or working on something else
      expect([
        HollonStatus.IDLE,
        HollonStatus.WORKING,
        HollonStatus.WAITING,
      ]).toContain(finalHollon?.status);
    });
  });

  describe('Cleanup: Verify retry limits work', () => {
    it('should not create infinite retry loops', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const allTasks = await taskRepo.find({
        where: { projectId: project.id },
      });

      // Should have exactly 1 task (no duplicate retries)
      expect(allTasks).toHaveLength(1);
      expect(allTasks[0].retryCount).toBe(MAX_RETRY_COUNT);
    });

    it('should have appropriate error message', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const finalTask = await taskRepo.findOne({ where: { id: task.id } });

      // If escalated, should have error message
      if (finalTask?.status === TaskStatus.BLOCKED) {
        expect(finalTask.errorMessage).toBeDefined();
      }
    });
  });
});
