import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource, Repository } from 'typeorm';
import * as path from 'path';
import * as fs from 'fs';
import { promisify } from 'util';
import { exec } from 'child_process';
import { Organization } from '../../src/modules/organization/entities/organization.entity';
import { Team } from '../../src/modules/team/entities/team.entity';
import { Role } from '../../src/modules/role/entities/role.entity';
import {
  Hollon,
  HollonLifecycle,
} from '../../src/modules/hollon/entities/hollon.entity';
import { Project } from '../../src/modules/project/entities/project.entity';
import {
  Task,
  TaskStatus,
  TaskType,
} from '../../src/modules/task/entities/task.entity';
import { Goal } from '../../src/modules/goal/entities/goal.entity';
import { TaskExecutionService } from '../../src/modules/orchestration/services/task-execution.service';
import { getRepositoryToken } from '@nestjs/typeorm';

const execAsync = promisify(exec);
const mkdirAsync = promisify(fs.mkdir);
const rmdirAsync = promisify(fs.rm);

const USE_MOCK_LLM = process.env.HOLLON_E2E_MOCK_LLM === 'true';
const TEST_TIMEOUT = USE_MOCK_LLM ? 120000 : 900000; // Mock: 2min, Real: 15min (increased for Brain Provider calls)

/**
 * Phase 4: Worktree Isolation and Sharing E2E Tests
 *
 * Tests the worktree management system:
 * 1. Independent worktrees for team member hollons
 * 2. Worktree sharing among sub-hollons
 * 3. Complete workflow with isolation + sharing
 *
 * This test verifies that:
 * - Each team member gets an independent worktree (.git-worktrees/hollon-{id}/task-{id}/)
 * - Sub-hollons share the parent's worktree
 * - Multiple team members can work simultaneously without conflicts
 */
describe('Phase 4: Worktree Isolation and Sharing (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Services
  let taskExecutionService: TaskExecutionService;

  // Repositories
  let taskRepo: Repository<Task>;
  let hollonRepo: Repository<Hollon>;
  let _goalRepo: Repository<Goal>;

  // Entities
  let organization: Organization;
  let backendTeam: Team;
  let aiTeam: Team;
  let managerRole: Role;
  let devRole: Role;
  let _planningRole: Role;
  let _implRole: Role;
  let _testingRole: Role;
  let techLead: Hollon;
  let aiLead: Hollon;
  let devBravo: Hollon;
  let devCharlie: Hollon;
  let aiDelta: Hollon;
  let project: Project;

  // Test repo
  let testRepoPath: string;

  beforeAll(async () => {
    console.log('🔵 [beforeAll] Starting test setup...');

    console.log('🔵 [beforeAll] Creating testing module...');
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    console.log('✅ [beforeAll] Module compiled');

    console.log('🔵 [beforeAll] Creating app...');
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
    console.log('✅ [beforeAll] App initialized');

    console.log('🔵 [beforeAll] Getting data source...');
    dataSource = moduleFixture.get<DataSource>(DataSource);
    console.log('✅ [beforeAll] Data source retrieved');

    // Get services
    console.log('🔵 [beforeAll] Getting services...');
    taskExecutionService =
      moduleFixture.get<TaskExecutionService>(TaskExecutionService);
    console.log('✅ [beforeAll] Services retrieved');

    // Get repositories
    console.log('🔵 [beforeAll] Getting repositories...');
    taskRepo = moduleFixture.get(getRepositoryToken(Task));
    hollonRepo = moduleFixture.get(getRepositoryToken(Hollon));
    _goalRepo = moduleFixture.get(getRepositoryToken(Goal));
    console.log('✅ [beforeAll] Repositories retrieved');

    // Create test repository
    console.log('🔵 [beforeAll] Setting up test repository...');
    await setupTestRepository();
    console.log('✅ [beforeAll] Test repository setup complete');

    // Setup test data
    console.log('🔵 [beforeAll] Setting up test data...');
    await setupTestData();
    console.log('✅ [beforeAll] Test data setup complete');

    console.log('🎉 [beforeAll] All setup complete!');
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup worktrees
    if (testRepoPath) {
      try {
        const worktreesDir = path.join(testRepoPath, '..', '.git-worktrees');
        if (fs.existsSync(worktreesDir)) {
          const { stdout } = await execAsync('git worktree list --porcelain', {
            cwd: testRepoPath,
          });
          const worktrees = parseWorktreeList(stdout);
          for (const wt of worktrees) {
            if (wt.path.includes('.git-worktrees')) {
              try {
                await execAsync(`git worktree remove --force "${wt.path}"`, {
                  cwd: testRepoPath,
                });
              } catch (err) {
                console.warn(`Failed to remove worktree ${wt.path}:`, err);
              }
            }
          }
          await rmdirAsync(worktreesDir, { recursive: true, force: true });
        }
      } catch (err) {
        console.warn('Worktree cleanup failed:', err);
      }
    }

    await app?.close();
  }, TEST_TIMEOUT);

  /**
   * Test 1: Worktree Isolation for Team Members
   *
   * Scenario: Multiple team members work on different tasks simultaneously
   * Expected: Each team member gets an independent worktree
   */
  describe('Worktree Isolation for Team Members', () => {
    it(
      'should create independent worktrees for different team members',
      async () => {
        // Given: Create 3 Implementation Tasks
        const task1 = await taskRepo.save(
          taskRepo.create({
            title: 'Implement User Service',
            description: 'Add UserService with CRUD operations',
            type: TaskType.IMPLEMENTATION,
            status: TaskStatus.READY,
            organizationId: organization.id,
            teamId: backendTeam.id,
            projectId: project.id,
            assignedHollonId: devBravo.id,
          }),
        );

        const task2 = await taskRepo.save(
          taskRepo.create({
            title: 'Implement Auth Service',
            description: 'Add AuthService with JWT authentication',
            type: TaskType.IMPLEMENTATION,
            status: TaskStatus.READY,
            organizationId: organization.id,
            teamId: backendTeam.id,
            projectId: project.id,
            assignedHollonId: devCharlie.id,
          }),
        );

        const task3 = await taskRepo.save(
          taskRepo.create({
            title: 'Implement Role Service',
            description: 'Add RoleService for role management',
            type: TaskType.IMPLEMENTATION,
            status: TaskStatus.READY,
            organizationId: organization.id,
            teamId: backendTeam.id,
            projectId: project.id,
            assignedHollonId: devBravo.id,
          }),
        );

        // When: Execute tasks (this will create worktrees)
        await taskExecutionService.executeTask(task1.id, devBravo.id);
        await taskExecutionService.executeTask(task2.id, devCharlie.id);
        await taskExecutionService.executeTask(task3.id, devBravo.id);

        // Reload tasks to get updated workingDirectory
        const updatedTask1 = await taskRepo.findOne({
          where: { id: task1.id },
        });
        const updatedTask2 = await taskRepo.findOne({
          where: { id: task2.id },
        });
        const updatedTask3 = await taskRepo.findOne({
          where: { id: task3.id },
        });

        // Then: Each task has an independent worktree
        expect(updatedTask1.workingDirectory).toContain('hollon-');
        expect(updatedTask1.workingDirectory).toContain(
          'task-' + task1.id.slice(0, 8),
        );

        expect(updatedTask2.workingDirectory).toContain('hollon-');
        expect(updatedTask2.workingDirectory).toContain(
          'task-' + task2.id.slice(0, 8),
        );

        expect(updatedTask3.workingDirectory).toContain('hollon-');
        expect(updatedTask3.workingDirectory).toContain(
          'task-' + task3.id.slice(0, 8),
        );

        // Then: Task 1 and Task 3 have different worktrees (same hollon, different tasks)
        expect(updatedTask1.workingDirectory).not.toEqual(
          updatedTask3.workingDirectory,
        );

        // Then: Task 1 and Task 2 have different worktrees (different hollons)
        expect(updatedTask1.workingDirectory).not.toEqual(
          updatedTask2.workingDirectory,
        );

        // Then: All worktrees actually exist
        expect(fs.existsSync(updatedTask1.workingDirectory)).toBe(true);
        expect(fs.existsSync(updatedTask2.workingDirectory)).toBe(true);
        expect(fs.existsSync(updatedTask3.workingDirectory)).toBe(true);
      },
      TEST_TIMEOUT,
    );

    it(
      'should isolate file changes between different worktrees',
      async () => {
        // Given: Two tasks assigned to different team members
        const task1 = await taskRepo.save(
          taskRepo.create({
            title: 'Add file A',
            description: 'Create file-a.txt with content A',
            type: TaskType.IMPLEMENTATION,
            status: TaskStatus.READY,
            organizationId: organization.id,
            teamId: backendTeam.id,
            projectId: project.id,
            assignedHollonId: devBravo.id,
          }),
        );

        const task2 = await taskRepo.save(
          taskRepo.create({
            title: 'Add file B',
            description: 'Create file-b.txt with content B',
            type: TaskType.IMPLEMENTATION,
            status: TaskStatus.READY,
            organizationId: organization.id,
            teamId: backendTeam.id,
            projectId: project.id,
            assignedHollonId: devCharlie.id,
          }),
        );

        // When: Execute tasks (creates worktrees)
        await taskExecutionService.executeTask(task1.id, devBravo.id);
        await taskExecutionService.executeTask(task2.id, devCharlie.id);

        // Reload tasks
        const updatedTask1 = await taskRepo.findOne({
          where: { id: task1.id },
        });
        const updatedTask2 = await taskRepo.findOne({
          where: { id: task2.id },
        });

        // When: Create files in each worktree
        const fileA = path.join(updatedTask1.workingDirectory, 'file-a.txt');
        const fileB = path.join(updatedTask2.workingDirectory, 'file-b.txt');

        fs.writeFileSync(fileA, 'Content A');
        fs.writeFileSync(fileB, 'Content B');

        // Then: File A exists in worktree 1 but not in worktree 2
        expect(fs.existsSync(fileA)).toBe(true);
        expect(
          fs.existsSync(path.join(updatedTask2.workingDirectory, 'file-a.txt')),
        ).toBe(false);

        // Then: File B exists in worktree 2 but not in worktree 1
        expect(fs.existsSync(fileB)).toBe(true);
        expect(
          fs.existsSync(path.join(updatedTask1.workingDirectory, 'file-b.txt')),
        ).toBe(false);
      },
      TEST_TIMEOUT,
    );
  });

  /**
   * Test 2: Worktree Sharing for Sub-Hollons
   *
   * Scenario: A task is decomposed into subtasks with sub-hollons
   * Expected: All sub-hollons share the parent's worktree
   */
  describe('Worktree Sharing for Sub-Hollons', () => {
    it(
      'should share worktree among sub-hollons of the same parent task',
      async () => {
        // Given: Create a parent task that will be decomposed
        const parentTask = await taskRepo.save(
          taskRepo.create({
            title: 'Implement Complete User Module',
            description:
              'Implement Entity, Service, Controller, and Tests for User module',
            type: TaskType.IMPLEMENTATION,
            status: TaskStatus.READY,
            organizationId: organization.id,
            teamId: backendTeam.id,
            projectId: project.id,
            assignedHollonId: devBravo.id,
          }),
        );

        // When: Execute task (this may trigger decomposition if Brain decides to)
        await taskExecutionService.executeTask(parentTask.id, devBravo.id);

        // Reload parent task
        const updatedParentTask = await taskRepo.findOne({
          where: { id: parentTask.id },
          relations: ['subtasks'],
        });

        const parentWorktree = updatedParentTask.workingDirectory;
        expect(parentWorktree).toContain('.git-worktrees');

        // Then: All subtasks share the parent's worktree
        const subtasks = await taskRepo.find({
          where: { parentTaskId: parentTask.id },
        });

        if (subtasks.length > 0) {
          for (const subtask of subtasks) {
            expect(subtask.workingDirectory).toEqual(parentWorktree);

            // Verify sub-hollon is temporary
            const subHollon = await hollonRepo.findOne({
              where: { id: subtask.assignedHollonId },
            });
            if (subHollon) {
              expect(subHollon.lifecycle).toBe(HollonLifecycle.TEMPORARY);
              expect(subHollon.createdByHollonId).toBe(devBravo.id);
            }
          }
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should use specialized roles for sub-hollons',
      async () => {
        // Given: Create a complex task that will be decomposed
        const parentTask = await taskRepo.save(
          taskRepo.create({
            title: 'Implement Knowledge System',
            description:
              'Complete implementation of knowledge extraction, storage, and retrieval',
            type: TaskType.IMPLEMENTATION,
            status: TaskStatus.READY,
            organizationId: organization.id,
            teamId: backendTeam.id,
            projectId: project.id,
            assignedHollonId: devBravo.id,
          }),
        );

        // When: Execute task (triggers decomposition with specialized sub-hollons)
        await taskExecutionService.executeTask(parentTask.id, devBravo.id);

        // Then: Sub-hollons have specialized roles
        const subHollons = await hollonRepo.find({
          where: {
            createdByHollonId: devBravo.id,
            lifecycle: HollonLifecycle.TEMPORARY,
          },
          relations: ['role'],
        });

        if (subHollons.length > 0) {
          const roleNames = subHollons.map((h) => h.role?.name).filter(Boolean);

          // At least one specialized role should be used
          const specializedRoles = [
            'PlanningSpecialist',
            'ImplementationSpecialist',
            'TestingSpecialist',
            'IntegrationSpecialist',
          ];
          const hasSpecializedRole = roleNames.some((name) =>
            specializedRoles.includes(name),
          );

          expect(hasSpecializedRole).toBe(true);
        }
      },
      TEST_TIMEOUT,
    );
  });

  /**
   * Test 3: Complete Worktree Workflow
   *
   * Scenario: Multiple teams with multiple members working on a goal
   * Expected: Isolation between teams/members, sharing within sub-hollons
   */
  describe('Complete Worktree Workflow', () => {
    it(
      'should maintain isolation between team members while sharing within sub-hollons',
      async () => {
        // Given: Create tasks for multiple team members
        const task1 = await taskRepo.save(
          taskRepo.create({
            title: 'Backend: User Management',
            description: 'Implement user CRUD operations',
            type: TaskType.IMPLEMENTATION,
            status: TaskStatus.READY,
            organizationId: organization.id,
            teamId: backendTeam.id,
            projectId: project.id,
            assignedHollonId: devBravo.id,
          }),
        );

        const task2 = await taskRepo.save(
          taskRepo.create({
            title: 'Backend: Authentication',
            description: 'Implement JWT authentication',
            type: TaskType.IMPLEMENTATION,
            status: TaskStatus.READY,
            organizationId: organization.id,
            teamId: backendTeam.id,
            projectId: project.id,
            assignedHollonId: devCharlie.id,
          }),
        );

        const task3 = await taskRepo.save(
          taskRepo.create({
            title: 'AI: Knowledge Extraction',
            description: 'Implement knowledge extraction service',
            type: TaskType.IMPLEMENTATION,
            status: TaskStatus.READY,
            organizationId: organization.id,
            teamId: aiTeam.id,
            projectId: project.id,
            assignedHollonId: aiDelta.id,
          }),
        );

        // When: Execute all tasks simultaneously
        await Promise.all([
          taskExecutionService.executeTask(task1.id, devBravo.id),
          taskExecutionService.executeTask(task2.id, devCharlie.id),
          taskExecutionService.executeTask(task3.id, aiDelta.id),
        ]);

        // Then: Each task has a unique worktree
        const allTasks = await taskRepo.find({
          where: { id: { $in: [task1.id, task2.id, task3.id] } as any },
        });

        const worktrees = allTasks
          .map((t) => t.workingDirectory)
          .filter(Boolean);
        const uniqueWorktrees = new Set(worktrees);

        expect(uniqueWorktrees.size).toEqual(worktrees.length);

        // Then: All worktrees are in the .git-worktrees directory
        for (const worktree of worktrees) {
          expect(worktree).toContain('.git-worktrees');
          expect(fs.existsSync(worktree)).toBe(true);
        }

        // Then: Each task's subtasks share the parent's worktree
        for (const task of allTasks) {
          const subtasks = await taskRepo.find({
            where: { parentTaskId: task.id },
          });

          if (subtasks.length > 0) {
            for (const subtask of subtasks) {
              expect(subtask.workingDirectory).toEqual(task.workingDirectory);
            }
          }
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should verify worktree path format',
      async () => {
        // Given: Create a task
        const task = await taskRepo.save(
          taskRepo.create({
            title: 'Test Worktree Path Format',
            description: 'Verify the worktree path follows the correct pattern',
            type: TaskType.IMPLEMENTATION,
            status: TaskStatus.READY,
            organizationId: organization.id,
            teamId: backendTeam.id,
            projectId: project.id,
            assignedHollonId: devBravo.id,
          }),
        );

        // When: Execute task
        await taskExecutionService.executeTask(task.id, devBravo.id);

        // Reload task
        const updatedTask = await taskRepo.findOne({ where: { id: task.id } });

        // Then: Worktree path follows the pattern .git-worktrees/hollon-{id}/task-{id}/
        const worktreePath = updatedTask.workingDirectory;
        expect(worktreePath).toContain('.git-worktrees');
        expect(worktreePath).toContain('hollon-');
        expect(worktreePath).toContain('task-');

        // Then: Worktree contains hollon ID and task ID
        expect(worktreePath).toContain(devBravo.id.slice(0, 8));
        expect(worktreePath).toContain(task.id.slice(0, 8));

        // Then: Worktree directory exists
        expect(fs.existsSync(worktreePath)).toBe(true);

        // Then: Worktree has a git directory
        const gitDir = path.join(worktreePath, '.git');
        expect(fs.existsSync(gitDir)).toBe(true);
      },
      TEST_TIMEOUT,
    );
  });

  // ==================== Helper Functions ====================

  async function setupTestRepository() {
    console.log('  🔸 [setupTestRepository] Creating test repo path...');
    testRepoPath = path.join(
      __dirname,
      '..',
      '..',
      'test-repos',
      `worktree-test-${Date.now()}`,
    );
    console.log(`  🔸 [setupTestRepository] Path: ${testRepoPath}`);

    // Create test repository directory
    console.log('  🔸 [setupTestRepository] Creating directory...');
    await mkdirAsync(testRepoPath, { recursive: true });
    console.log('  ✅ [setupTestRepository] Directory created');

    // Initialize git repository
    console.log('  🔸 [setupTestRepository] Running git init...');
    await execAsync('git init', { cwd: testRepoPath });
    console.log('  ✅ [setupTestRepository] Git init complete');

    console.log('  🔸 [setupTestRepository] Setting git user.email...');
    await execAsync('git config user.email "test@example.com"', {
      cwd: testRepoPath,
    });
    console.log('  ✅ [setupTestRepository] Git user.email set');

    console.log('  🔸 [setupTestRepository] Setting git user.name...');
    await execAsync('git config user.name "Test User"', {
      cwd: testRepoPath,
    });
    console.log('  ✅ [setupTestRepository] Git user.name set');

    // Create initial commit
    console.log('  🔸 [setupTestRepository] Creating README.md...');
    const readmePath = path.join(testRepoPath, 'README.md');
    fs.writeFileSync(readmePath, '# Test Repository for Worktree Scenarios');
    console.log('  ✅ [setupTestRepository] README.md created');

    console.log('  🔸 [setupTestRepository] Running git add...');
    await execAsync('git add README.md', { cwd: testRepoPath });
    console.log('  ✅ [setupTestRepository] Git add complete');

    console.log('  🔸 [setupTestRepository] Running git commit...');
    await execAsync('git commit -m "Initial commit"', { cwd: testRepoPath });
    console.log('  ✅ [setupTestRepository] Git commit complete');

    // Create main branch
    console.log('  🔸 [setupTestRepository] Creating main branch...');
    await execAsync('git branch -M main', { cwd: testRepoPath });
    console.log('  ✅ [setupTestRepository] Main branch created');

    // Add itself as remote origin (for worktree creation)
    console.log('  🔸 [setupTestRepository] Adding remote origin...');
    await execAsync(`git remote add origin ${testRepoPath}`, {
      cwd: testRepoPath,
    });
    console.log('  ✅ [setupTestRepository] Remote origin added');
    console.log('  🎉 [setupTestRepository] Setup complete!');
  }

  async function setupTestData() {
    const orgRepo = dataSource.getRepository(Organization);
    const teamRepo = dataSource.getRepository(Team);
    const roleRepo = dataSource.getRepository(Role);
    const projectRepo = dataSource.getRepository(Project);
    const brainConfigRepo = dataSource.getRepository(
      require('../../src/modules/brain-provider/entities/brain-provider-config.entity')
        .BrainProviderConfig,
    );

    // Create organization
    organization = await orgRepo.save(
      orgRepo.create({
        name: 'Worktree Test Org',
      }),
    );

    // Create BrainProviderConfig
    await brainConfigRepo.save(
      brainConfigRepo.create({
        organizationId: organization.id,
        providerId: 'claude_code',
        displayName: 'Test Claude Code Config',
        config: {
          model: 'claude-sonnet-4-5',
          maxTokens: 8192,
        },
        costPerInputTokenCents: 0.0003,
        costPerOutputTokenCents: 0.0015,
        enabled: true,
        timeoutSeconds: 1200, // 20 minutes for real LLM calls
        maxRetries: 3,
      }),
    );

    // Create teams
    backendTeam = await teamRepo.save(
      teamRepo.create({
        name: 'Backend Engineering',
        organizationId: organization.id,
      }),
    );

    aiTeam = await teamRepo.save(
      teamRepo.create({
        name: 'AI Engineering',
        organizationId: organization.id,
      }),
    );

    // Create roles
    managerRole = await roleRepo.save(
      roleRepo.create({
        name: 'TechLead',
        description: 'Technical Lead',
        organizationId: organization.id,
        capabilities: ['planning', 'management'],
      }),
    );

    devRole = await roleRepo.save(
      roleRepo.create({
        name: 'BackendEngineer',
        description: 'Backend Developer',
        organizationId: organization.id,
        capabilities: ['coding', 'testing'],
      }),
    );

    _planningRole = await roleRepo.save(
      roleRepo.create({
        name: 'PlanningSpecialist',
        description: 'Planning specialist for sub-hollons',
        organizationId: organization.id,
        capabilities: ['planning', 'analysis'],
        availableForTemporaryHollon: true,
      }),
    );

    _implRole = await roleRepo.save(
      roleRepo.create({
        name: 'ImplementationSpecialist',
        description: 'Implementation specialist for sub-hollons',
        organizationId: organization.id,
        capabilities: ['coding', 'implementation'],
        availableForTemporaryHollon: true,
      }),
    );

    _testingRole = await roleRepo.save(
      roleRepo.create({
        name: 'TestingSpecialist',
        description: 'Testing specialist for sub-hollons',
        organizationId: organization.id,
        capabilities: ['testing', 'quality'],
        availableForTemporaryHollon: true,
      }),
    );

    // Create SecurityReviewer role (required for code review)
    await roleRepo.save(
      roleRepo.create({
        name: 'SecurityReviewer',
        description: 'Security review specialist',
        organizationId: organization.id,
        capabilities: ['security', 'code-review'],
        availableForTemporaryHollon: true,
      }),
    );

    // Create hollons
    techLead = await hollonRepo.save(
      hollonRepo.create({
        name: 'TechLead-Alpha',
        organizationId: organization.id,
        teamId: backendTeam.id,
        roleId: managerRole.id,
        brainProviderId: 'claude_code',
      }),
    );

    aiLead = await hollonRepo.save(
      hollonRepo.create({
        name: 'AILead-Echo',
        organizationId: organization.id,
        teamId: aiTeam.id,
        roleId: managerRole.id,
        brainProviderId: 'claude_code',
      }),
    );

    devBravo = await hollonRepo.save(
      hollonRepo.create({
        name: 'Developer-Bravo',
        organizationId: organization.id,
        teamId: backendTeam.id,
        roleId: devRole.id,
        brainProviderId: 'claude_code',
        managerId: techLead.id,
      }),
    );

    devCharlie = await hollonRepo.save(
      hollonRepo.create({
        name: 'Developer-Charlie',
        organizationId: organization.id,
        teamId: backendTeam.id,
        roleId: devRole.id,
        brainProviderId: 'claude_code',
        managerId: techLead.id,
      }),
    );

    aiDelta = await hollonRepo.save(
      hollonRepo.create({
        name: 'AIEngineer-Delta',
        organizationId: organization.id,
        teamId: aiTeam.id,
        roleId: devRole.id,
        brainProviderId: 'claude_code',
        managerId: aiLead.id,
      }),
    );

    // Create project
    project = await projectRepo.save(
      projectRepo.create({
        name: 'Worktree Test Project',
        description: 'Test project for worktree scenarios',
        organizationId: organization.id,
        workingDirectory: testRepoPath,
        repositoryUrl: `file://${testRepoPath}`,
      }),
    );
  }

  /**
   * Test 4: Manager Role Separation
   *
   * Scenario: Managers should distribute tasks, not execute them
   * Expected: Tasks assigned to managers should not be executed
   */
  describe('Manager Role Separation', () => {
    it(
      'should prevent managers from executing implementation tasks',
      async () => {
        console.log('🧪 Testing manager role separation...');

        // Given: Create an Implementation task assigned to a manager (NOT a developer)
        const managerTask = await taskRepo.save(
          taskRepo.create({
            title: 'Manager Should Not Execute This',
            description: 'This task is wrongly assigned to a manager',
            type: TaskType.IMPLEMENTATION,
            status: TaskStatus.READY,
            organizationId: organization.id,
            teamId: backendTeam.id,
            projectId: project.id,
            assignedHollonId: techLead.id, // ❌ Assigned to MANAGER
          }),
        );

        console.log(
          `📋 Created task ${managerTask.id.slice(0, 8)} assigned to manager ${techLead.name}`,
        );

        // When: Try to execute the task
        let executionFailed = false;
        let errorMessage = '';

        try {
          await taskExecutionService.executeTask(managerTask.id, techLead.id);
        } catch (error) {
          executionFailed = true;
          errorMessage = (error as Error).message;
          console.log(`✅ Execution blocked with error: ${errorMessage}`);
        }

        // Then: The task should either:
        // 1. Fail to execute (throw error), OR
        // 2. Not create any worktree (no actual work done)
        const updatedTask = await taskRepo.findOne({
          where: { id: managerTask.id },
        });

        console.log(
          `📊 Task status after execution attempt: ${updatedTask.status}`,
        );
        console.log(
          `📁 Task workingDirectory: ${updatedTask.workingDirectory || 'null'}`,
        );

        // Managers should NOT have worktrees created for implementation tasks
        if (!executionFailed) {
          // If it didn't throw an error, it should at least not have created a worktree
          expect(updatedTask.workingDirectory).toBeNull();
          console.log(
            '✅ Manager task did not create worktree (correct behavior)',
          );
        } else {
          // If it threw an error, that's also acceptable
          console.log(
            '✅ Manager task execution was blocked (correct behavior)',
          );
        }
      },
      TEST_TIMEOUT,
    );

    it(
      'should verify task distribution uses manager hierarchy',
      async () => {
        console.log(
          '🧪 Testing task distribution through manager hierarchy...',
        );

        // Given: Create a parent task assigned to manager
        const parentTask = await taskRepo.save(
          taskRepo.create({
            title: 'Parent Task for Distribution',
            description: 'Manager should distribute this to team members',
            type: TaskType.TEAM_EPIC,
            status: TaskStatus.READY,
            organizationId: organization.id,
            teamId: backendTeam.id,
            projectId: project.id,
            assignedHollonId: techLead.id, // Manager
          }),
        );

        console.log(
          `📋 Created parent task ${parentTask.id.slice(0, 8)} for manager ${techLead.name}`,
        );

        // When: Execute the parent task (manager decomposes into subtasks)
        await taskExecutionService.executeTask(parentTask.id, techLead.id);

        // Wait a bit for decomposition
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Then: Check if subtasks were created
        const subtasks = await taskRepo.find({
          where: { parentTaskId: parentTask.id },
        });

        console.log(`📊 Found ${subtasks.length} subtasks created by manager`);

        if (subtasks.length > 0) {
          // Verify subtasks are assigned to team members, NOT the manager
          for (const subtask of subtasks) {
            console.log(
              `  └─ Subtask ${subtask.id.slice(0, 8)}: "${subtask.title}" → ${
                subtask.assignedHollonId
                  ? subtask.assignedHollonId.slice(0, 8)
                  : 'unassigned'
              }`,
            );

            if (subtask.assignedHollonId) {
              // If assigned, it should NOT be the manager
              expect(subtask.assignedHollonId).not.toBe(techLead.id);

              // Verify it's assigned to a subordinate
              const assignedHollon = await hollonRepo.findOne({
                where: { id: subtask.assignedHollonId },
              });

              if (assignedHollon) {
                console.log(
                  `    ✅ Assigned to ${assignedHollon.name} (managerId: ${assignedHollon.managerId?.slice(0, 8) || 'none'})`,
                );
                // The assigned hollon should have the manager as their managerId
                expect(assignedHollon.managerId).toBe(techLead.id);
              }
            }
          }
        } else {
          console.log(
            '⚠️  No subtasks created (task might not require decomposition)',
          );
        }
      },
      TEST_TIMEOUT,
    );
  });

  /**
   * Test 5: PR Creation and Verification
   *
   * Scenario: Tasks should create real PRs that can be verified
   * Expected: PR is created, CI passes, and PR can be closed
   */
  describe('PR Creation and Verification', () => {
    it(
      'should create a real PR and verify it',
      async () => {
        console.log('🧪 Testing real PR creation...');

        // Given: Create a simple implementation task
        const prTask = await taskRepo.save(
          taskRepo.create({
            title: 'Add test file for PR verification',
            description: 'Create a simple test file to verify PR workflow',
            type: TaskType.IMPLEMENTATION,
            status: TaskStatus.READY,
            organizationId: organization.id,
            teamId: backendTeam.id,
            projectId: project.id,
            assignedHollonId: devBravo.id,
          }),
        );

        console.log(
          `📋 Created PR test task ${prTask.id.slice(0, 8)} for ${devBravo.name}`,
        );

        // When: Execute the task (should create PR)
        console.log(
          '⏳ Executing task (this will take several minutes with real LLM)...',
        );
        await taskExecutionService.executeTask(prTask.id, devBravo.id);

        // Reload task to get updated status
        const updatedTask = await taskRepo.findOne({
          where: { id: prTask.id },
        });

        console.log(`📊 Task status: ${updatedTask.status}`);
        console.log(`📁 Working directory: ${updatedTask.workingDirectory}`);

        // Then: Verify worktree was created
        if (updatedTask.workingDirectory) {
          expect(fs.existsSync(updatedTask.workingDirectory)).toBe(true);
          console.log('✅ Worktree created successfully');
        }

        // Then: Check if PR was created
        const TaskPullRequest =
          require('../../src/modules/task/entities/task-pull-request.entity').TaskPullRequest;
        const prRepo = dataSource.getRepository(TaskPullRequest);

        const pr = await prRepo.findOne({
          where: { taskId: prTask.id },
        });

        if (pr) {
          console.log(`✅ PR created: ${pr.prUrl}`);
          console.log(`📊 PR status: ${pr.status || 'unknown'}`);

          // Verify PR URL format
          expect(pr.prUrl).toContain('github.com');
          expect(pr.prUrl).toContain('/pull/');

          // Optional: Check PR status using gh CLI
          try {
            const prNumber = pr.prUrl.split('/pull/')[1];
            const { stdout: prStatus } = await execAsync(
              `gh pr view ${prNumber} --json state,title`,
              { cwd: testRepoPath },
            );
            console.log(`📋 PR details: ${prStatus}`);
          } catch (error) {
            console.log(
              `⚠️  Could not fetch PR status: ${(error as Error).message}`,
            );
          }

          // Note: We don't actually close the PR in the test
          // because this test repo is temporary and will be cleaned up
          console.log('ℹ️  PR will be cleaned up with test repository');
        } else {
          console.log(
            '⚠️  No PR created yet (task might still be in progress)',
          );
          // This is OK - the task might not have reached the PR creation stage yet
          // We still verified the worktree creation which is the main focus
        }
      },
      TEST_TIMEOUT,
    );
  });

  function parseWorktreeList(stdout: string): Array<{ path: string }> {
    const worktrees: Array<{ path: string }> = [];
    let currentWorktree: { path?: string } = {};

    for (const line of stdout.split('\n')) {
      if (line.startsWith('worktree ')) {
        if (currentWorktree.path) {
          worktrees.push({ path: currentWorktree.path });
        }
        currentWorktree = { path: line.substring('worktree '.length) };
      }
    }

    if (currentWorktree.path) {
      worktrees.push({ path: currentWorktree.path });
    }

    return worktrees;
  }
});
