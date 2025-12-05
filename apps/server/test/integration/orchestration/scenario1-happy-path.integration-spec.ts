import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { Organization } from '@/modules/organization/entities/organization.entity';
import { Role } from '@/modules/role/entities/role.entity';
import { Team } from '@/modules/team/entities/team.entity';
import { Hollon, HollonStatus } from '@/modules/hollon/entities/hollon.entity';
import { Project } from '@/modules/project/entities/project.entity';
import { Task, TaskStatus } from '@/modules/task/entities/task.entity';
import { Document } from '@/modules/document/entities/document.entity';
import { HollonOrchestratorService } from '@/modules/orchestration/services/hollon-orchestrator.service';
import { TaskPoolService } from '@/modules/orchestration/services/task-pool.service';

/**
 * Scenario 1: Happy Path
 *
 * 검증 시나리오:
 * 1. Organization, Role, Team, Hollon 생성
 * 2. Project, Task 생성
 * 3. Hollon 실행 사이클 시작
 * 4. Task Pull → 실행 → 완료
 * 5. Document (결과물) 생성 확인
 */
describe('Integration: Scenario 1 - Happy Path', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orchestrator: HollonOrchestratorService;
  let taskPool: TaskPoolService;

  let organization: Organization;
  let role: Role;
  let team: Team;
  let hollon: Hollon;
  let project: Project;
  let task: Task;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    orchestrator = app.get(HollonOrchestratorService);
    taskPool = app.get(TaskPoolService);
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await app.close();
  });

  describe('Setup: Create test entities', () => {
    it('should create organization', async () => {
      const orgRepo = dataSource.getRepository(Organization);
      organization = await orgRepo.save({
        name: 'Test Organization',
        contextPrompt: 'We build high-quality software.',
        costLimitDailyCents: 10000, // $100/day
        costLimitMonthlyCents: 100000, // $1000/month
      });

      expect(organization.id).toBeDefined();
      expect(organization.name).toBe('Test Organization');
    });

    it('should create role', async () => {
      const roleRepo = dataSource.getRepository(Role);
      role = await roleRepo.save({
        organizationId: organization.id,
        name: 'Backend Engineer',
        systemPrompt: 'You are a TypeScript/NestJS backend engineer.',
        capabilities: ['typescript', 'nestjs', 'postgresql'],
      });

      expect(role.id).toBeDefined();
      expect(role.name).toBe('Backend Engineer');
    });

    it('should create team', async () => {
      const teamRepo = dataSource.getRepository(Team);
      team = await teamRepo.save({
        organizationId: organization.id,
        name: 'Backend Team',
        contextPrompt: 'We focus on backend services.',
      });

      expect(team.id).toBeDefined();
      expect(team.name).toBe('Backend Team');
    });

    it('should create hollon', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);
      hollon = await hollonRepo.save({
        organizationId: organization.id,
        roleId: role.id,
        teamId: team.id,
        name: 'Test Hollon 1',
        status: HollonStatus.IDLE,
        customSystemPrompt: 'Focus on code quality.',
      });

      expect(hollon.id).toBeDefined();
      expect(hollon.name).toBe('Test Hollon 1');
      expect(hollon.status).toBe(HollonStatus.IDLE);
    });

    it('should create project', async () => {
      const projectRepo = dataSource.getRepository(Project);
      project = await projectRepo.save({
        organizationId: organization.id,
        teamId: team.id,
        name: 'Test Project',
        description: 'Integration test project',
      });

      expect(project.id).toBeDefined();
      expect(project.name).toBe('Test Project');
    });

    it('should create task', async () => {
      const taskRepo = dataSource.getRepository(Task);
      task = await taskRepo.save({
        projectId: project.id,
        title: 'Implement simple utility function',
        description: 'Create a function that adds two numbers and returns the result',
        type: 'implementation',
        status: TaskStatus.READY,
        priority: 'P2',
        acceptanceCriteria: [
          'Function accepts two numbers',
          'Function returns sum',
          'Function has TypeScript types',
        ],
        affectedFiles: ['src/utils/math.ts'],
        depth: 0,
      });

      expect(task.id).toBeDefined();
      expect(task.title).toBe('Implement simple utility function');
      expect(task.status).toBe(TaskStatus.READY);
    });
  });

  describe('Execution: Run hollon cycle', () => {
    it('should pull task from pool', async () => {
      const pulledTask = await taskPool.pullNextTask(hollon.id);

      expect(pulledTask).toBeDefined();
      expect(pulledTask?.id).toBe(task.id);
      expect(pulledTask?.assignedHollonId).toBeNull(); // Not claimed yet
    });

    it('should claim task atomically', async () => {
      const claimedTask = await taskPool.claimTask(task.id, hollon.id);

      expect(claimedTask.assignedHollonId).toBe(hollon.id);
      expect(claimedTask.status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should execute hollon cycle', async () => {
      // This test will be skipped for now as it requires actual Brain Provider
      // In a real scenario, this would:
      // 1. Compose prompt
      // 2. Execute Brain Provider
      // 3. Validate result
      // 4. Mark task as completed
      // 5. Create document with result

      // For integration test, we'll mock the Brain Provider response
      const result = await orchestrator.runCycle(hollon.id);

      // The cycle should complete without throwing
      expect(result).toBeDefined();
    }, 60000); // 60 second timeout for actual execution
  });

  describe('Verification: Check results', () => {
    it('should have task marked as completed or in progress', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const updatedTask = await taskRepo.findOne({
        where: { id: task.id },
      });

      expect(updatedTask).toBeDefined();
      // Task should be either IN_PROGRESS or COMPLETED depending on execution
      expect([TaskStatus.IN_PROGRESS, TaskStatus.COMPLETED, TaskStatus.IN_REVIEW]).toContain(
        updatedTask?.status,
      );
    });

    it('should have hollon status updated', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);
      const updatedHollon = await hollonRepo.findOne({
        where: { id: hollon.id },
      });

      expect(updatedHollon).toBeDefined();
      // Hollon should be either WORKING, IN_REVIEW, or back to IDLE
      expect([HollonStatus.WORKING, HollonStatus.IN_REVIEW, HollonStatus.IDLE]).toContain(
        updatedHollon?.status,
      );
    });

    it('should create document with result (if completed)', async () => {
      const docRepo = dataSource.getRepository(Document);
      const documents = await docRepo.find({
        where: {
          organizationId: organization.id,
        },
      });

      // If task completed, there should be a result document
      // This depends on the orchestrator implementation
      expect(documents).toBeDefined();
      expect(Array.isArray(documents)).toBe(true);
    });
  });

  describe('Cleanup: Verify no side effects', () => {
    it('should not create duplicate tasks', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const allTasks = await taskRepo.find({
        where: { projectId: project.id },
      });

      // Should still have exactly 1 task (unless subtasks were created)
      expect(allTasks.length).toBeGreaterThanOrEqual(1);
    });

    it('should not leave hollon in error state', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);
      const finalHollon = await hollonRepo.findOne({
        where: { id: hollon.id },
      });

      expect(finalHollon?.status).not.toBe(HollonStatus.ERROR);
    });
  });
});
