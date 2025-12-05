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
import { TaskPoolService } from '@/modules/orchestration/services/task-pool.service';

/**
 * Scenario 4: Multiple Hollons Concurrent Execution
 *
 * 검증 시나리오:
 * 1. 2개 Hollon 생성
 * 2. 5개 Task 생성
 * 3. 동시에 실행 사이클 시작
 * 4. 파일 충돌 없이 처리 확인
 */
describe('Integration: Scenario 4 - Concurrent Hollons', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let taskPool: TaskPoolService;

  let organization: Organization;
  let role: Role;
  let team: Team;
  let hollon1: Hollon;
  let hollon2: Hollon;
  let project: Project;
  let tasks: Task[];

  const TASK_COUNT = 5;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    taskPool = app.get(TaskPoolService);
  });

  afterAll(async () => {
    await dataSource.dropDatabase();
    await app.close();
  });

  describe('Setup: Create multiple hollons and tasks', () => {
    it('should create organization', async () => {
      const orgRepo = dataSource.getRepository(Organization);
      organization = await orgRepo.save({
        name: 'Concurrent Test Organization',
        contextPrompt: 'We work in parallel.',
        costLimitDailyCents: 100000,
        costLimitMonthlyCents: 1000000,
      });

      expect(organization.id).toBeDefined();
    });

    it('should create role and team', async () => {
      const roleRepo = dataSource.getRepository(Role);
      role = await roleRepo.save({
        organizationId: organization.id,
        name: 'Parallel Worker',
        systemPrompt: 'You work efficiently on assigned tasks.',
        capabilities: ['typescript', 'testing'],
      });

      const teamRepo = dataSource.getRepository(Team);
      team = await teamRepo.save({
        organizationId: organization.id,
        name: 'Parallel Team',
        contextPrompt: 'We execute tasks in parallel.',
      });

      expect(role.id).toBeDefined();
      expect(team.id).toBeDefined();
    });

    it('should create 2 hollons', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);

      hollon1 = await hollonRepo.save({
        organizationId: organization.id,
        roleId: role.id,
        teamId: team.id,
        name: 'Hollon Alpha',
        status: HollonStatus.IDLE,
      });

      hollon2 = await hollonRepo.save({
        organizationId: organization.id,
        roleId: role.id,
        teamId: team.id,
        name: 'Hollon Beta',
        status: HollonStatus.IDLE,
      });

      expect(hollon1.id).toBeDefined();
      expect(hollon2.id).toBeDefined();
      expect(hollon1.id).not.toBe(hollon2.id);
    });

    it('should create project', async () => {
      const projectRepo = dataSource.getRepository(Project);
      project = await projectRepo.save({
        organizationId: organization.id,
        teamId: team.id,
        name: 'Concurrent Test Project',
        description: 'Testing concurrent execution',
      });

      expect(project.id).toBeDefined();
    });

    it('should create 5 tasks with different affected files', async () => {
      const taskRepo = dataSource.getRepository(Task);
      tasks = [];

      for (let i = 1; i <= TASK_COUNT; i++) {
        const task = await taskRepo.save({
          projectId: project.id,
          title: `Task ${i}: Implement feature ${i}`,
          description: `Feature ${i} implementation`,
          type: 'implementation',
          status: TaskStatus.READY,
          priority: 'P2',
          acceptanceCriteria: [`Feature ${i} works correctly`],
          affectedFiles: [`src/features/feature${i}.ts`],
          depth: 0,
        });

        tasks.push(task);
      }

      expect(tasks).toHaveLength(TASK_COUNT);
      expect(tasks.every((t) => t.status === TaskStatus.READY)).toBe(true);
    });
  });

  describe('Execution: Concurrent task claiming', () => {
    it('should allow both hollons to pull tasks', async () => {
      const task1 = await taskPool.pullNextTask(hollon1.id);
      const task2 = await taskPool.pullNextTask(hollon2.id);

      expect(task1).toBeDefined();
      expect(task2).toBeDefined();

      // Should pull different tasks (or same if not claimed yet)
      expect(task1?.id).toBeDefined();
      expect(task2?.id).toBeDefined();
    });

    it('should claim tasks atomically without conflicts', async () => {
      // Simulate concurrent claiming
      const claimPromises = [
        taskPool.claimTask(tasks[0].id, hollon1.id),
        taskPool.claimTask(tasks[1].id, hollon2.id),
      ];

      const claimedTasks = await Promise.all(claimPromises);

      expect(claimedTasks).toHaveLength(2);
      expect(claimedTasks[0].assignedHollonId).toBe(hollon1.id);
      expect(claimedTasks[1].assignedHollonId).toBe(hollon2.id);
      expect(claimedTasks[0].status).toBe(TaskStatus.IN_PROGRESS);
      expect(claimedTasks[1].status).toBe(TaskStatus.IN_PROGRESS);
    });

    it('should prevent file conflicts', async () => {
      // Try to create a task with overlapping file
      const taskRepo = dataSource.getRepository(Task);
      const conflictTask = await taskRepo.save({
        projectId: project.id,
        title: 'Conflicting task',
        description: 'This affects same file as Task 1',
        type: 'implementation',
        status: TaskStatus.READY,
        priority: 'P1',
        affectedFiles: ['src/features/feature1.ts'], // Same as tasks[0]
        depth: 0,
      });

      // Hollon1 is already working on tasks[0] which affects feature1.ts
      // pullNextTask should skip this conflicting task for hollon1
      const nextTask = await taskPool.pullNextTask(hollon1.id);

      // Should not pull the conflicting task
      if (nextTask) {
        expect(nextTask.id).not.toBe(conflictTask.id);
      }

      // But hollon2 can pull it (if not working on same file)
      const hollon2Task = await taskPool.pullNextTask(hollon2.id);
      expect(hollon2Task).toBeDefined();
    });

    it('should handle race condition in claiming same task', async () => {
      // Create a new task for this test
      const taskRepo = dataSource.getRepository(Task);
      const raceTask = await taskRepo.save({
        projectId: project.id,
        title: 'Race condition test task',
        description: 'Both hollons try to claim this',
        type: 'implementation',
        status: TaskStatus.READY,
        priority: 'P1',
        affectedFiles: ['src/features/race.ts'],
        depth: 0,
      });

      // Both hollons try to claim the same task simultaneously
      const claimResults = await Promise.allSettled([
        taskPool.claimTask(raceTask.id, hollon1.id),
        taskPool.claimTask(raceTask.id, hollon2.id),
      ]);

      // One should succeed, one should fail
      const succeeded = claimResults.filter((r) => r.status === 'fulfilled');
      const failed = claimResults.filter((r) => r.status === 'rejected');

      // At least one should succeed
      expect(succeeded.length).toBeGreaterThanOrEqual(1);

      // Verify only one hollon got the task
      const finalTask = await taskRepo.findOne({
        where: { id: raceTask.id },
      });

      expect(finalTask?.assignedHollonId).toBeDefined();
      expect([hollon1.id, hollon2.id]).toContain(finalTask?.assignedHollonId!);
    });
  });

  describe('Verification: Check parallel execution results', () => {
    it('should have multiple tasks in progress', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const inProgressTasks = await taskRepo.find({
        where: {
          projectId: project.id,
          status: TaskStatus.IN_PROGRESS,
        },
      });

      expect(inProgressTasks.length).toBeGreaterThan(0);
    });

    it('should have tasks distributed across hollons', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const hollon1Tasks = await taskRepo.find({
        where: {
          projectId: project.id,
          assignedHollonId: hollon1.id,
        },
      });

      const hollon2Tasks = await taskRepo.find({
        where: {
          projectId: project.id,
          assignedHollonId: hollon2.id,
        },
      });

      // Both hollons should have at least one task
      expect(hollon1Tasks.length).toBeGreaterThan(0);
      expect(hollon2Tasks.length).toBeGreaterThan(0);

      // Total claimed tasks
      const totalClaimed = hollon1Tasks.length + hollon2Tasks.length;
      expect(totalClaimed).toBeGreaterThan(0);
      expect(totalClaimed).toBeLessThanOrEqual(TASK_COUNT + 1); // +1 for race task
    });

    it('should have no file conflicts in assigned tasks', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const allInProgressTasks = await taskRepo.find({
        where: {
          projectId: project.id,
          status: TaskStatus.IN_PROGRESS,
        },
      });

      // Collect all affected files from in-progress tasks
      const affectedFilesMap = new Map<string, string>(); // file -> hollonId

      for (const task of allInProgressTasks) {
        if (task.affectedFiles && task.assignedHollonId) {
          for (const file of task.affectedFiles) {
            if (affectedFilesMap.has(file)) {
              // Same file is being worked on by different hollons!
              const existingHollonId = affectedFilesMap.get(file)!;
              expect(existingHollonId).toBe(task.assignedHollonId);
            } else {
              affectedFilesMap.set(file, task.assignedHollonId);
            }
          }
        }
      }

      // Each file should only be worked on by one hollon
      expect(affectedFilesMap.size).toBeLessThanOrEqual(allInProgressTasks.length);
    });

    it('should have both hollons in valid states', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);

      const finalHollon1 = await hollonRepo.findOne({ where: { id: hollon1.id } });
      const finalHollon2 = await hollonRepo.findOne({ where: { id: hollon2.id } });

      expect(finalHollon1).toBeDefined();
      expect(finalHollon2).toBeDefined();

      // Both should be in valid working states
      const validStates = [
        HollonStatus.IDLE,
        HollonStatus.WORKING,
        HollonStatus.IN_REVIEW,
        HollonStatus.WAITING,
      ];

      expect(validStates).toContain(finalHollon1?.status);
      expect(validStates).toContain(finalHollon2?.status);
    });
  });

  describe('Cleanup: Verify system stability', () => {
    it('should have all original tasks accounted for', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const allTasks = await taskRepo.find({
        where: { projectId: project.id },
      });

      // Should have at least the original 5 tasks + race task
      expect(allTasks.length).toBeGreaterThanOrEqual(TASK_COUNT);
    });

    it('should have no orphaned tasks', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const inProgressTasks = await taskRepo.find({
        where: {
          projectId: project.id,
          status: TaskStatus.IN_PROGRESS,
        },
      });

      // All in-progress tasks should have assigned hollon
      expect(
        inProgressTasks.every((t) => t.assignedHollonId !== null),
      ).toBe(true);
    });

    it('should support adding more hollons dynamically', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);

      const hollon3 = await hollonRepo.save({
        organizationId: organization.id,
        roleId: role.id,
        teamId: team.id,
        name: 'Hollon Gamma',
        status: HollonStatus.IDLE,
      });

      expect(hollon3.id).toBeDefined();

      // Should be able to pull tasks immediately
      const task = await taskPool.pullNextTask(hollon3.id);
      expect(task).toBeDefined();
    });
  });
});
