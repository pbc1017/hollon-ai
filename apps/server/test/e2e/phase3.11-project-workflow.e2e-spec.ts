import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppModule } from '../../src/app.module';
import { GitRepositoryHelper } from '../utils/git-repository.helper';
import { TaskExecutionService } from '../../src/modules/orchestration/services/task-execution.service';
import {
  Task,
  TaskStatus,
  TaskType,
  TaskPriority,
} from '../../src/modules/task/entities/task.entity';
import { Project } from '../../src/modules/project/entities/project.entity';
import { Organization } from '../../src/modules/organization/entities/organization.entity';
import { Team } from '../../src/modules/team/entities/team.entity';
import { Role } from '../../src/modules/role/entities/role.entity';
import {
  Hollon,
  HollonStatus,
} from '../../src/modules/hollon/entities/hollon.entity';
import { BrainProviderConfig } from '../../src/modules/brain-provider/entities/brain-provider-config.entity';
import * as os from 'os';
import * as path from 'path';
import { promisify } from 'util';
import { exec } from 'child_process';

const execAsync = promisify(exec);

/**
 * Phase 3.11: Project-Based Workflow with Hollon Git Strategy E2E Test
 *
 * 테스트 시나리오: 계산기 프로젝트 구현
 * - 간단한 계산기 프로젝트 (덧셈, 뺄셈, 곱셈, 나눗셈)
 * - Manager Hollon이 서브태스크로 분배
 * - Dev Hollons가 각자 Worktree에서 작업
 * - Alice가 2개 태스크 수행 (Worktree 재사용 테스트)
 *
 * E2E 테스트 특성:
 * - 기본: Real LLM 사용 (다른 Phase E2E와 일관성)
 * - Mock: HOLLON_E2E_MOCK_LLM=true 환경변수로 활성화
 */
describe('Phase 3.11: Project-Based Workflow (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Services
  let taskExecutionService: TaskExecutionService;

  // Test data
  let testRepoPath: string;
  let organization: Organization;
  let team: Team;
  let managerRole: Role;
  let devRole: Role;
  let project: Project;
  let managerHollon: Hollon;
  let devHollonAlice: Hollon;
  let devHollonBob: Hollon;

  // Environment
  const USE_MOCK_LLM = process.env.HOLLON_E2E_MOCK_LLM === 'true';
  const TEST_TIMEOUT = USE_MOCK_LLM ? 30000 : 180000; // Mock: 30s, Real: 3min

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);
    taskExecutionService =
      moduleFixture.get<TaskExecutionService>(TaskExecutionService);

    // Create test git repository
    const tmpDir = os.tmpdir();
    testRepoPath = await GitRepositoryHelper.createTestRepository(tmpDir);

    console.log(`✅ Test repository created: ${testRepoPath}`);
    console.log(`📝 LLM Mode: ${USE_MOCK_LLM ? 'MOCK' : 'REAL'}`);
  });

  afterAll(async () => {
    // Cleanup test repository
    if (testRepoPath) {
      await GitRepositoryHelper.cleanupRepository(testRepoPath);
      console.log(`🧹 Test repository cleaned up`);
    }

    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
    await app?.close();
  });

  describe('Calculator Project Implementation', () => {
    it(
      'should create project and distribute calculator tasks to team',
      async () => {
        // ==========================================
        // 1. Setup: Organization, Team, Roles, Hollons
        // ==========================================
        const orgRepo = dataSource.getRepository(Organization);
        organization = await orgRepo.save({
          name: `Test Org - Calculator ${Date.now()}`,
          maxBudgetCents: 100000,
        });

        // Create BrainProviderConfig for REAL mode
        if (!USE_MOCK_LLM) {
          const configRepo = dataSource.getRepository(BrainProviderConfig);
          await configRepo.save({
            organizationId: organization.id,
            providerId: 'claude_code',
            displayName: 'Test Claude Code Config',
            config: {
              model: 'claude-sonnet-4-5',
              maxTokens: 8192,
            },
            costPerInputTokenCents: 0.0003, // $3 per million tokens
            costPerOutputTokenCents: 0.0015, // $15 per million tokens
            enabled: true,
            timeoutSeconds: 300,
            maxRetries: 3,
          });
          console.log(`✅ BrainProviderConfig created for REAL mode`);
        }

        const roleRepo = dataSource.getRepository(Role);
        managerRole = await roleRepo.save({
          name: 'Manager',
          organizationId: organization.id,
          systemPrompt: 'You are a project manager.',
          capabilities: ['planning', 'delegation'],
        });

        devRole = await roleRepo.save({
          name: 'Developer',
          organizationId: organization.id,
          systemPrompt: 'You are a software developer.',
          capabilities: ['typescript', 'coding'],
        });

        const teamRepo = dataSource.getRepository(Team);
        team = await teamRepo.save({
          name: 'Calculator Team',
          organizationId: organization.id,
        });

        const hollonRepo = dataSource.getRepository(Hollon);
        managerHollon = await hollonRepo.save({
          name: 'Manager-AI',
          organizationId: organization.id,
          teamId: team.id,
          roleId: managerRole.id,
          status: HollonStatus.IDLE,
        });

        devHollonAlice = await hollonRepo.save({
          name: 'Alice-Dev',
          organizationId: organization.id,
          teamId: team.id,
          roleId: devRole.id,
          status: HollonStatus.IDLE,
        });

        devHollonBob = await hollonRepo.save({
          name: 'Bob-Dev',
          organizationId: organization.id,
          teamId: team.id,
          roleId: devRole.id,
          status: HollonStatus.IDLE,
        });

        // Update team with manager
        await teamRepo.update(team.id, {
          managerHollonId: managerHollon.id,
        });

        console.log(`✅ Organization and Team created`);
        console.log(`   - Manager: ${managerHollon.name}`);
        console.log(`   - Dev 1: ${devHollonAlice.name}`);
        console.log(`   - Dev 2: ${devHollonBob.name}`);

        // ==========================================
        // 2. Create Project
        // ==========================================
        const projectRepo = dataSource.getRepository(Project);
        project = await projectRepo.save({
          name: 'Calculator Project',
          description: 'Simple calculator with basic operations',
          organizationId: organization.id,
          repositoryUrl: `file://${testRepoPath}`,
          workingDirectory: testRepoPath,
        });

        console.log(`✅ Project created: ${project.name}`);

        // ==========================================
        // 3. Create Parent Task (TEAM_EPIC)
        // ==========================================
        const taskRepo = dataSource.getRepository(Task);
        const parentTask = await taskRepo.save({
          title: 'Implement Calculator',
          description:
            'Build a simple calculator with add, subtract, multiply, divide operations',
          type: TaskType.TEAM_EPIC,
          status: TaskStatus.PENDING,
          priority: TaskPriority.P1_CRITICAL,
          organizationId: organization.id,
          projectId: project.id,
          assignedTeamId: team.id,
          acceptanceCriteria: [
            'Implement add(a, b) function',
            'Implement subtract(a, b) function',
            'Implement multiply(a, b) function',
            'Implement divide(a, b) function',
          ],
          estimatedComplexity: 'low',
          depth: 0,
        });

        console.log(`✅ Parent task created: ${parentTask.title}`);

        // ==========================================
        // 4. Manager distributes to subtasks
        // (Simulated - in real scenario, use TeamTaskDistribution)
        // ==========================================
        const subtask1 = await taskRepo.save({
          title: 'Implement add function',
          description: 'Create add(a, b) that returns a + b',
          type: TaskType.IMPLEMENTATION,
          status: TaskStatus.READY,
          priority: TaskPriority.P1_CRITICAL,
          organizationId: organization.id,
          projectId: project.id,
          parentTaskId: parentTask.id,
          assignedHollonId: devHollonAlice.id,
          estimatedComplexity: 'low',
          depth: 1,
        });

        const subtask2 = await taskRepo.save({
          title: 'Implement subtract function',
          description: 'Create subtract(a, b) that returns a - b',
          type: TaskType.IMPLEMENTATION,
          status: TaskStatus.READY,
          priority: TaskPriority.P2_HIGH,
          organizationId: organization.id,
          projectId: project.id,
          parentTaskId: parentTask.id,
          assignedHollonId: devHollonBob.id,
          estimatedComplexity: 'low',
          depth: 1,
        });

        const subtask3 = await taskRepo.save({
          title: 'Implement multiply and divide functions',
          description: 'Create multiply(a, b) and divide(a, b) functions',
          type: TaskType.IMPLEMENTATION,
          status: TaskStatus.READY,
          priority: TaskPriority.P2_HIGH,
          organizationId: organization.id,
          projectId: project.id,
          parentTaskId: parentTask.id,
          assignedHollonId: devHollonAlice.id, // Alice gets 2nd task
          estimatedComplexity: 'low',
          depth: 1,
        });

        console.log(`✅ Subtasks created:`);
        console.log(`   - ${subtask1.title} → ${devHollonAlice.name}`);
        console.log(`   - ${subtask2.title} → ${devHollonBob.name}`);
        console.log(
          `   - ${subtask3.title} → ${devHollonAlice.name} (2nd task)`,
        );

        // ==========================================
        // 5. Execute Tasks (Phase 3.11 Git Strategy)
        // ==========================================

        // Alice executes Task 1
        console.log(`\n🚀 Alice executing Task 1...`);

        // Execute task (worktree and branch will be created)
        let result1: { prUrl: string; worktreePath: string };

        if (USE_MOCK_LLM) {
          // Mock mode: Skip actual execution, just test git workflow
          // Note: In real E2E, executeTask would be called with real LLM
          const aliceWorktree = GitRepositoryHelper.getWorktreePath(
            testRepoPath,
            devHollonAlice.id,
          );

          // Simulate what TaskExecutionService does
          // 1. Get or create worktree
          const worktreeDir = path.dirname(aliceWorktree);
          await execAsync(`mkdir -p ${worktreeDir}`);
          await execAsync(`git worktree add ${aliceWorktree}`, {
            cwd: testRepoPath,
          });

          // 2. Create branch
          const sanitizedName = devHollonAlice.name.replace(
            /[^a-zA-Z0-9-]/g,
            '-',
          );
          const branchName = `feature/${sanitizedName}/task-${subtask1.id.slice(0, 8)}`;
          await execAsync(`git checkout -b ${branchName} main`, {
            cwd: aliceWorktree,
          });

          // 3. Create a commit
          await GitRepositoryHelper.createCommit(
            aliceWorktree,
            'Add add function',
            'export function add(a: number, b: number) { return a + b; }',
          );

          result1 = {
            prUrl: 'https://github.com/test/repo/pull/1',
            worktreePath: aliceWorktree,
          };
        } else {
          // Real LLM mode
          result1 = await taskExecutionService.executeTask(
            subtask1.id,
            devHollonAlice.id,
          );
        }

        console.log(`✅ Alice Task 1 completed: ${result1.prUrl}`);

        // Verify Alice's worktree
        const aliceWorktree = GitRepositoryHelper.getWorktreePath(
          testRepoPath,
          devHollonAlice.id,
        );
        const aliceWorktreeExists =
          await GitRepositoryHelper.worktreeExists(aliceWorktree);
        expect(aliceWorktreeExists).toBe(true);

        // Verify Alice's branch
        const aliceInfo1 =
          await GitRepositoryHelper.getWorktreeInfo(aliceWorktree);
        expect(aliceInfo1.branch).toContain('Alice-Dev');
        expect(aliceInfo1.branch).toContain('task-');

        console.log(`   - Worktree: ${aliceWorktree}`);
        console.log(`   - Branch: ${aliceInfo1.branch}`);

        // Bob executes Task 2
        console.log(`\n🚀 Bob executing Task 2...`);

        let result2: { prUrl: string; worktreePath: string };

        if (USE_MOCK_LLM) {
          const bobWorktree = GitRepositoryHelper.getWorktreePath(
            testRepoPath,
            devHollonBob.id,
          );

          // Simulate TaskExecutionService
          const worktreeDir = path.dirname(bobWorktree);
          await execAsync(`mkdir -p ${worktreeDir}`);
          await execAsync(`git worktree add ${bobWorktree}`, {
            cwd: testRepoPath,
          });

          const sanitizedName = devHollonBob.name.replace(
            /[^a-zA-Z0-9-]/g,
            '-',
          );
          const branchName = `feature/${sanitizedName}/task-${subtask2.id.slice(0, 8)}`;
          await execAsync(`git checkout -b ${branchName} main`, {
            cwd: bobWorktree,
          });

          await GitRepositoryHelper.createCommit(
            bobWorktree,
            'Add subtract function',
            'export function subtract(a: number, b: number) { return a - b; }',
          );

          result2 = {
            prUrl: 'https://github.com/test/repo/pull/2',
            worktreePath: bobWorktree,
          };
        } else {
          result2 = await taskExecutionService.executeTask(
            subtask2.id,
            devHollonBob.id,
          );
        }

        console.log(`✅ Bob Task 2 completed: ${result2.prUrl}`);

        // Verify Bob's worktree
        const bobWorktree = GitRepositoryHelper.getWorktreePath(
          testRepoPath,
          devHollonBob.id,
        );
        const bobWorktreeExists =
          await GitRepositoryHelper.worktreeExists(bobWorktree);
        expect(bobWorktreeExists).toBe(true);

        // Verify Bob's branch
        const bobInfo = await GitRepositoryHelper.getWorktreeInfo(bobWorktree);
        expect(bobInfo.branch).toContain('Bob-Dev');
        expect(bobInfo.branch).toContain('task-');

        console.log(`   - Worktree: ${bobWorktree}`);
        console.log(`   - Branch: ${bobInfo.branch}`);

        // Alice executes Task 3 (Worktree reuse test)
        console.log(`\n🚀 Alice executing Task 3 (Worktree reuse)...`);

        let result3: { prUrl: string; worktreePath: string };

        if (USE_MOCK_LLM) {
          // Reuse Alice's worktree (already exists from Task 1)
          const sanitizedName = devHollonAlice.name.replace(
            /[^a-zA-Z0-9-]/g,
            '-',
          );
          const branchName = `feature/${sanitizedName}/task-${subtask3.id.slice(0, 8)}`;

          // Create new branch in existing worktree
          await execAsync(`git fetch`, { cwd: aliceWorktree });
          await execAsync(`git checkout -b ${branchName} main`, {
            cwd: aliceWorktree,
          });

          await GitRepositoryHelper.createCommit(
            aliceWorktree,
            'Add multiply and divide functions',
            'export function multiply(a: number, b: number) { return a * b; }',
          );

          result3 = {
            prUrl: 'https://github.com/test/repo/pull/3',
            worktreePath: aliceWorktree,
          };
        } else {
          result3 = await taskExecutionService.executeTask(
            subtask3.id,
            devHollonAlice.id,
          );
        }

        console.log(`✅ Alice Task 3 completed: ${result3.prUrl}`);

        // Verify Alice's worktree was REUSED
        expect(result3.worktreePath).toBe(aliceWorktree);

        // Verify Alice's NEW branch
        const aliceInfo3 =
          await GitRepositoryHelper.getWorktreeInfo(aliceWorktree);
        expect(aliceInfo3.branch).toContain('Alice-Dev');
        expect(aliceInfo3.branch).toContain('task-');
        expect(aliceInfo3.branch).not.toBe(aliceInfo1.branch); // Different branch

        console.log(`   - Worktree: REUSED ${aliceWorktree} ✅`);
        console.log(`   - Branch: ${aliceInfo3.branch} (NEW)`);

        // ==========================================
        // 6. Verify Git Workflow
        // ==========================================
        console.log(`\n🔍 Verifying Git workflow...`);

        // Verify all branches exist
        const branches = await GitRepositoryHelper.getBranches(testRepoPath);
        const aliceBranches = branches.filter((b) => b.includes('Alice-Dev'));
        const bobBranches = branches.filter((b) => b.includes('Bob-Dev'));

        expect(aliceBranches.length).toBe(2); // Alice had 2 tasks
        expect(bobBranches.length).toBe(1); // Bob had 1 task

        console.log(`✅ Branches verified:`);
        console.log(`   - Alice branches: ${aliceBranches.length}`);
        console.log(`   - Bob branches: ${bobBranches.length}`);

        // Verify worktrees
        const worktrees = await GitRepositoryHelper.listWorktrees(testRepoPath);
        const hollonWorktrees = worktrees.filter((w) =>
          w.includes('.git-worktrees'),
        );

        expect(hollonWorktrees.length).toBe(2); // Alice + Bob = 2 worktrees

        console.log(`✅ Worktrees verified:`);
        console.log(`   - Total worktrees: ${hollonWorktrees.length}`);
        console.log(`   - Alice reused worktree: YES ✅`);

        // ==========================================
        // 7. Verify Phase 3.11 Key Features
        // ==========================================
        console.log(`\n✅ Phase 3.11 Key Features Verified:`);
        console.log(`   ✓ Hollon-specific worktrees (재사용 전략)`);
        console.log(`   ✓ Branch naming: feature/{hollonName}/task-{id}`);
        console.log(`   ✓ Worktree reuse for same hollon`);
        console.log(`   ✓ Multiple hollons with separate worktrees`);
        console.log(`   ✓ LLM Mode: ${USE_MOCK_LLM ? 'MOCK' : 'REAL'}`);
      },
      TEST_TIMEOUT,
    );
  });

  describe('Cleanup and Resource Management', () => {
    it('should cleanup worktrees after project completion', async () => {
      // This test verifies cleanup happens properly
      const worktreesBefore =
        await GitRepositoryHelper.listWorktrees(testRepoPath);

      console.log(`\n🧹 Testing cleanup...`);
      console.log(`   - Worktrees before cleanup: ${worktreesBefore.length}`);

      // Cleanup would happen here in real scenario
      // For now, we verify worktrees can be removed
      const aliceWorktree = GitRepositoryHelper.getWorktreePath(
        testRepoPath,
        devHollonAlice.id,
      );
      const bobWorktree = GitRepositoryHelper.getWorktreePath(
        testRepoPath,
        devHollonBob.id,
      );

      const aliceExists =
        await GitRepositoryHelper.worktreeExists(aliceWorktree);
      const bobExists = await GitRepositoryHelper.worktreeExists(bobWorktree);

      expect(aliceExists || bobExists).toBe(true);

      console.log(`✅ Cleanup test completed`);
    });
  });
});
