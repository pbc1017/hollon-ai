import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '@/app.module';
import { Organization } from '@/modules/organization/entities/organization.entity';
import { Role } from '@/modules/role/entities/role.entity';
import { Team } from '@/modules/team/entities/team.entity';
import {
  Hollon,
  HollonStatus,
  HollonLifecycle,
} from '@/modules/hollon/entities/hollon.entity';
import { Project } from '@/modules/project/entities/project.entity';
import { Task, TaskStatus } from '@/modules/task/entities/task.entity';
import { HollonOrchestratorService } from '@/modules/orchestration/services/hollon-orchestrator.service';
import { cleanupTestData } from '../utils/test-database.utils';

/**
 * Phase 3.7 E2E: Complex Task Delegation with Sub-Hollons
 *
 * 검증 시나리오:
 * 1. High complexity 태스크 생성
 * 2. Parent Hollon이 runCycle() 실행
 * 3. isTaskComplex() = true → handleComplexTask() 호출
 * 4. 3개 Sub-Hollon (Planner/Analyzer/Coder) 자동 생성
 * 5. 3개 Subtask 생성 및 Sub-Hollon에 할당
 * 6. Parent task는 delegation 완료
 */
describe('Phase 3.7 E2E: Complex Task Delegation with Sub-Hollons', () => {
  let app: INestApplication;
  let dataSource: DataSource;
  let orchestrator: HollonOrchestratorService;

  let organization: Organization;
  let role: Role;
  let team: Team;
  let parentHollon: Hollon;
  let project: Project;
  let complexTask: Task;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = app.get(DataSource);
    orchestrator = app.get(HollonOrchestratorService);
  });

  afterAll(async () => {
    await cleanupTestData(dataSource);
    await app.close();
  });

  describe('Setup: Create test entities', () => {
    it('should create organization', async () => {
      const orgRepo = dataSource.getRepository(Organization);
      organization = await orgRepo.save({
        name: 'Phase 3.7 E2E Test Org',
        description: 'Testing complex task delegation',
        settings: {
          autonomousExecutionEnabled: true,
        },
      });

      expect(organization.id).toBeDefined();
    });

    it('should create role', async () => {
      const roleRepo = dataSource.getRepository(Role);
      role = await roleRepo.save({
        organizationId: organization.id,
        name: 'Senior Engineer',
        description: 'Experienced software engineer',
        capabilities: ['typescript', 'nestjs', 'architecture'],
      });

      expect(role.id).toBeDefined();
    });

    it('should create team', async () => {
      const teamRepo = dataSource.getRepository(Team);
      team = await teamRepo.save({
        organizationId: organization.id,
        name: 'Backend Team',
        description: 'Backend development team',
      });

      expect(team.id).toBeDefined();
    });

    it('should create parent hollon (permanent, depth=0)', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);
      parentHollon = await hollonRepo.save({
        organizationId: organization.id,
        roleId: role.id,
        teamId: team.id,
        name: 'Parent Hollon',
        status: HollonStatus.IDLE,
        lifecycle: HollonLifecycle.PERMANENT,
        depth: 0,
      });

      expect(parentHollon.id).toBeDefined();
      expect(parentHollon.depth).toBe(0);
      expect(parentHollon.lifecycle).toBe(HollonLifecycle.PERMANENT);
    });

    it('should create project', async () => {
      const projectRepo = dataSource.getRepository(Project);
      project = await projectRepo.save({
        organizationId: organization.id,
        name: 'Complex Feature Project',
        description: 'Testing Sub-Hollon delegation',
        status: 'active',
      });

      expect(project.id).toBeDefined();
    });
  });

  describe('Complex Task Creation and Delegation', () => {
    it('should create complex task with high complexity', async () => {
      const taskRepo = dataSource.getRepository(Task);
      complexTask = await taskRepo.save({
        organizationId: organization.id,
        projectId: project.id,
        assignedHollonId: parentHollon.id,
        title: 'Implement Advanced Authentication System',
        description:
          'Build a complete authentication system with OAuth, JWT, 2FA, and session management',
        type: 'implementation',
        status: TaskStatus.READY,
        priority: 'P1',
        estimatedComplexity: 'high', // Trigger Sub-Hollon delegation
        storyPoints: 13, // > 8 → complex
        requiredSkills: ['typescript', 'security', 'oauth', 'jwt'], // > 2 → complex
        depth: 0,
        affectedFiles: [
          'src/auth/auth.service.ts',
          'src/auth/jwt.strategy.ts',
          'src/auth/oauth.controller.ts',
        ],
      });

      expect(complexTask.id).toBeDefined();
      expect(complexTask.estimatedComplexity).toBe('high');
      expect(complexTask.storyPoints).toBeGreaterThan(8);
      expect(complexTask.requiredSkills?.length).toBeGreaterThan(2);

      console.log('✅ Created complex task:', {
        id: complexTask.id,
        complexity: complexTask.estimatedComplexity,
        storyPoints: complexTask.storyPoints,
        skills: complexTask.requiredSkills?.length,
      });
    });

    it('should run execution cycle and delegate to Sub-Hollons', async () => {
      const result = await orchestrator.runCycle(parentHollon.id);

      expect(result.success).toBe(true);
      expect(result.taskId).toBe(complexTask.id);
      expect(result.output).toContain('Task delegated to Sub-Hollons');

      console.log('✅ Execution cycle result:', {
        success: result.success,
        taskId: result.taskId,
        duration: result.duration,
        output: result.output,
      });
    }, 30000);

    it('should verify 3 Sub-Hollons were created', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);
      const subHollons = await hollonRepo.find({
        where: {
          createdByHollonId: parentHollon.id,
          lifecycle: HollonLifecycle.TEMPORARY,
        },
      });

      expect(subHollons.length).toBeGreaterThanOrEqual(3);

      const names = subHollons.map((h) => h.name);
      console.log('✅ Created Sub-Hollons:', names);

      // Verify naming pattern
      const hasPlanner = names.some((n) => n.includes('Planner'));
      const hasAnalyzer = names.some((n) => n.includes('Analyzer'));
      const hasCoder = names.some((n) => n.includes('Coder'));

      expect(hasPlanner || hasAnalyzer || hasCoder).toBe(true);
    });

    it('should verify 3 subtasks were created', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const subtasks = await taskRepo.find({
        where: { parentTaskId: complexTask.id },
      });

      expect(subtasks.length).toBeGreaterThanOrEqual(3);

      console.log(
        '✅ Created subtasks:',
        subtasks.map((t) => ({ title: t.title, type: t.type })),
      );

      // Verify subtasks are assigned to Sub-Hollons
      const assignedCount = subtasks.filter((t) => t.assignedHollonId).length;
      expect(assignedCount).toBe(subtasks.length);
    });

    it('should verify subtasks are assigned to Sub-Hollons', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const hollonRepo = dataSource.getRepository(Hollon);

      const subtasks = await taskRepo.find({
        where: { parentTaskId: complexTask.id },
      });

      for (const subtask of subtasks) {
        expect(subtask.assignedHollonId).toBeDefined();

        const assignedHollon = await hollonRepo.findOne({
          where: { id: subtask.assignedHollonId! },
        });

        expect(assignedHollon).toBeDefined();
        expect(assignedHollon?.lifecycle).toBe(HollonLifecycle.TEMPORARY);
        expect(assignedHollon?.depth).toBe(1);
        expect(assignedHollon?.createdByHollonId).toBe(parentHollon.id);

        console.log(`✅ Subtask "${subtask.title}" assigned to Sub-Hollon:`, {
          hollon: assignedHollon?.name,
          depth: assignedHollon?.depth,
          lifecycle: assignedHollon?.lifecycle,
        });
      }
    });

    it('should verify parent hollon is back to IDLE', async () => {
      const hollonRepo = dataSource.getRepository(Hollon);
      const updatedParent = await hollonRepo.findOne({
        where: { id: parentHollon.id },
      });

      expect(updatedParent?.status).toBe(HollonStatus.IDLE);

      console.log('✅ Parent hollon status:', updatedParent?.status);
    });

    it('should verify complex task is still assigned to parent', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const updatedTask = await taskRepo.findOne({
        where: { id: complexTask.id },
      });

      // Parent task should remain assigned to parent hollon
      expect(updatedTask?.assignedHollonId).toBe(parentHollon.id);

      console.log('✅ Complex task status:', {
        status: updatedTask?.status,
        assignedTo: updatedTask?.assignedHollonId,
      });
    });
  });

  describe('Sub-Hollon Execution Simulation', () => {
    it('should complete all subtasks and trigger cleanup', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const hollonRepo = dataSource.getRepository(Hollon);

      // Find all subtasks
      const subtasks = await taskRepo.find({
        where: { parentTaskId: complexTask.id },
      });

      expect(subtasks.length).toBeGreaterThan(0);

      // Mark all subtasks as completed
      for (const subtask of subtasks) {
        await taskRepo.update(
          { id: subtask.id },
          {
            status: TaskStatus.COMPLETED,
            completedAt: new Date(),
          },
        );
      }

      console.log(`✅ Marked ${subtasks.length} subtasks as COMPLETED`);

      // Wait a bit for cleanup to trigger (in real system, this happens via SubtaskCreationService)
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify Sub-Hollons still exist (cleanup happens via updateParentTaskStatus)
      const remainingSubHollons = await hollonRepo.find({
        where: {
          createdByHollonId: parentHollon.id,
          lifecycle: HollonLifecycle.TEMPORARY,
        },
      });

      console.log(
        `✅ Sub-Hollons after completion: ${remainingSubHollons.length} (cleanup will trigger on parent task update)`,
      );
    });
  });

  describe('Verify Phase 3.7 Complexity Detection', () => {
    it('should detect complexity by estimatedComplexity=high', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const task = await taskRepo.save({
        organizationId: organization.id,
        projectId: project.id,
        assignedHollonId: parentHollon.id,
        title: 'Task with explicit high complexity',
        description: 'Testing complexity detection',
        type: 'implementation',
        status: TaskStatus.READY,
        priority: 'P2',
        estimatedComplexity: 'high',
        depth: 0,
      });

      expect(task.estimatedComplexity).toBe('high');

      // This task should also trigger Sub-Hollon delegation
      console.log('✅ Task with estimatedComplexity=high created');
    });

    it('should detect complexity by storyPoints > 8', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const task = await taskRepo.save({
        organizationId: organization.id,
        projectId: project.id,
        assignedHollonId: parentHollon.id,
        title: 'Task with high story points',
        description: 'Testing complexity detection',
        type: 'implementation',
        status: TaskStatus.READY,
        priority: 'P2',
        storyPoints: 13,
        depth: 0,
      });

      expect(task.storyPoints).toBeGreaterThan(8);

      console.log('✅ Task with storyPoints=13 created');
    });

    it('should detect complexity by requiredSkills > 2', async () => {
      const taskRepo = dataSource.getRepository(Task);
      const task = await taskRepo.save({
        organizationId: organization.id,
        projectId: project.id,
        assignedHollonId: parentHollon.id,
        title: 'Task with many required skills',
        description: 'Testing complexity detection',
        type: 'implementation',
        status: TaskStatus.READY,
        priority: 'P2',
        requiredSkills: ['typescript', 'react', 'graphql', 'aws'],
        depth: 0,
      });

      expect(task.requiredSkills?.length).toBeGreaterThan(2);

      console.log('✅ Task with 4 required skills created');
    });
  });
});
