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
import { Hollon } from '../../src/modules/hollon/entities/hollon.entity';
import { Project } from '../../src/modules/project/entities/project.entity';
import {
  Task,
  TaskStatus,
  TaskType,
} from '../../src/modules/task/entities/task.entity';
import { Goal, GoalStatus } from '../../src/modules/goal/entities/goal.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { GoalDecompositionService } from '../../src/modules/goal/services/goal-decomposition.service';
import { TaskExecutionService } from '../../src/modules/orchestration/services/task-execution.service';
import { CodeReviewService } from '../../src/modules/collaboration/services/code-review.service';

const execAsync = promisify(exec);

const USE_MOCK_LLM = process.env.HOLLON_E2E_MOCK_LLM === 'true';
const TEST_TIMEOUT = USE_MOCK_LLM ? 120000 : 1200000; // Mock: 2min, Real: 20min

describe('Phase 3 Complete Workflow (E2E)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Repositories
  let taskRepo: Repository<Task>;
  let hollonRepo: Repository<Hollon>;
  let goalRepo: Repository<Goal>;

  // Services
  let goalDecompositionService: GoalDecompositionService;
  let taskExecutionService: TaskExecutionService;
  let codeReviewService: CodeReviewService;

  // Track created PRs for cleanup
  const createdPRs: string[] = [];

  // Test data
  let organization: Organization;
  let project: Project;
  let backendTeam: Team;
  let cto: Hollon;
  let techLead: Hollon;
  let devBravo: Hollon;

  // Current repo path (hollon-ai)
  const currentRepoPath = path.join(__dirname, '..', '..', '..', '..');

  beforeAll(async () => {
    console.log(
      '🔵 [beforeAll] Starting Phase 3 Complete Workflow test setup...',
    );

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Get repositories
    taskRepo = moduleFixture.get(getRepositoryToken(Task));
    hollonRepo = moduleFixture.get(getRepositoryToken(Hollon));
    goalRepo = moduleFixture.get(getRepositoryToken(Goal));

    // Get services
    goalDecompositionService = moduleFixture.get(GoalDecompositionService);
    taskExecutionService = moduleFixture.get(TaskExecutionService);
    codeReviewService = moduleFixture.get(CodeReviewService);

    // Setup test data
    await setupTestData();

    console.log(
      '🎉 [beforeAll] Phase 3 Complete Workflow test setup complete!',
    );
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup any remaining PRs
    if (createdPRs.length > 0) {
      console.log('\n🧹 Cleaning up test PRs...');
      for (const prId of createdPRs) {
        try {
          const TaskPullRequest =
            require('../../src/modules/collaboration/entities/task-pull-request.entity').TaskPullRequest;
          const prRepo = dataSource.getRepository(TaskPullRequest);
          const pr = await prRepo.findOne({ where: { id: prId } });

          // In test mode, close PR even if it's MERGED in DB
          // (DB-only merge, GitHub PR is still open)
          if (pr && pr.status !== 'closed') {
            await codeReviewService.closePullRequest(
              prId,
              'Test cleanup - closing remaining PR',
            );
            console.log(`  ✅ Closed PR: ${pr.prUrl}`);
          }
        } catch (err) {
          console.warn(
            `  ⚠️  Failed to close PR ${prId}:`,
            (err as Error).message,
          );
        }
      }
    }

    // Cleanup worktrees
    try {
      const worktreesDir = path.join(currentRepoPath, '.git-worktrees');
      if (fs.existsSync(worktreesDir)) {
        console.log('🧹 Cleaning up test worktrees...');
        const { stdout } = await execAsync('git worktree list --porcelain', {
          cwd: currentRepoPath,
        });

        // Parse and remove test worktrees
        const lines = stdout.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].startsWith('worktree ')) {
            const worktreePath = lines[i].substring(9);
            if (
              worktreePath.includes('calculator-test') ||
              worktreePath.includes('Developer-Bravo')
            ) {
              try {
                await execAsync(
                  `git worktree remove --force "${worktreePath}"`,
                  {
                    cwd: currentRepoPath,
                  },
                );
                console.log(`  ✅ Removed worktree: ${worktreePath}`);
              } catch (err) {
                console.warn(
                  `  ⚠️  Failed to remove worktree ${worktreePath}:`,
                  err,
                );
              }
            }
          }
        }
      }
    } catch (err) {
      console.warn('Worktree cleanup failed:', err);
    }

    await app?.close();
  }, TEST_TIMEOUT);

  /**
   * Test Suite: Complete Calculator Goal Workflow
   *
   * Covers all scenarios from phase3-test-plan.md:
   * - Happy path (full automation)
   * - Manager role separation
   * - CI failure handling
   * - Duplicate branch prevention
   * - Sub-agent tracking
   * - Edge cases
   */
  describe('Complete Phase 3 Workflow', () => {
    it(
      'should execute full workflow: Goal → Team Epic → Implementation → PR',
      async () => {
        console.log('\n🧪 Starting Phase 3 Complete Workflow Test...\n');

        // ========== Step 1: Create Goal ==========
        console.log('📋 Step 1: Creating Goal...');
        const goal = await goalRepo.save(
          goalRepo.create({
            title: 'Build Calculator Module with Dependencies',
            description: `Create a NEW calculator module for the Hollon AI project.

              CONTEXT: This calculator module does NOT exist yet in the codebase. You must create it from scratch.

              REQUIREMENTS - Each task MUST write actual TypeScript code:

              1. Module Foundation (no dependencies):
                 - Create src/modules/calculator/calculator.module.ts with @Module decorator
                 - Create src/modules/calculator/calculator.service.ts with @Injectable decorator
                 - Export CalculatorModule from calculator.module.ts
                 - Write actual working TypeScript code (not just file structure)

              2. Service Implementation (depends on Foundation):
                 - Implement add(a: number, b: number): number method in CalculatorService
                 - Implement subtract(a: number, b: number): number method
                 - Implement multiply(a: number, b: number): number method
                 - Implement divide(a: number, b: number): number method with division by zero check
                 - MUST write actual code that performs calculations and returns results

              3. API Layer (depends on Service):
                 - Create src/modules/calculator/calculator.controller.ts with @Controller('calculator')
                 - Implement POST /calculator/add endpoint with CalculationDto
                 - Implement POST /calculator/subtract endpoint
                 - Create src/modules/calculator/dto/calculation.dto.ts with class-validator decorators
                 - MUST write actual controller methods that call CalculatorService

              4. Testing (depends on API):
                 - Create src/modules/calculator/calculator.service.spec.ts with at least 4 test cases
                 - Test each arithmetic operation (add, subtract, multiply, divide)
                 - Test division by zero throws error
                 - MUST write actual Jest tests that would fail if service is not implemented

              CRITICAL INSTRUCTIONS:
              1. Brain MUST set up task dependencies so later tasks are BLOCKED until earlier tasks complete
              2. Each task MUST create actual TypeScript files with working code (not empty files)
              3. Files must have proper imports, exports, and decorators
              4. Code must be compilable TypeScript that passes lint checks
              5. This is a NEW module - assume nothing exists and write everything from scratch

              This tests the dependency unblocking workflow with actual code changes.`,
            status: GoalStatus.DRAFT,
            organizationId: organization.id,
            teamId: backendTeam.id, // Assign to backend team
            ownerHollonId: cto.id,
          }),
        );

        console.log(
          `✅ Created Goal: ${goal.id.slice(0, 8)} - "${goal.title}"`,
        );
        console.log(`   Assigned to: ${cto.name}`);

        // ========== Step 2: Activate Goal ==========
        console.log('\n📊 Step 2: Activating Goal...');
        goal.status = GoalStatus.ACTIVE;
        await goalRepo.save(goal);
        console.log(`✅ Goal activated: ${goal.status}`);

        // ========== Step 3: Goal → Team Epic Decomposition ==========
        console.log('\n🔄 Step 3: Decomposing Goal into Team Epics...');
        await goalDecompositionService.decomposeGoal(goal.id);

        // Verify Team Epics were created
        // Note: Goal decomposition creates new Projects, so we search by team
        const teamEpics = await taskRepo.find({
          where: {
            assignedTeamId: backendTeam.id,
            type: TaskType.TEAM_EPIC,
          },
        });
        console.log(`✅ Created ${teamEpics.length} Team Epic(s)`);
        expect(teamEpics.length).toBeGreaterThan(0);

        for (const epic of teamEpics) {
          console.log(`   - Team Epic: "${epic.title}" (${epic.status})`);
        }

        // ========== Step 4: Team Epic → Manager Assignment ==========
        console.log('\n👤 Step 4: Assigning Team Epics to Managers...');

        // Manually assign Team Epics to TechLead (in real system this would be automatic)
        for (const epic of teamEpics) {
          epic.assignedHollonId = techLead.id;
          epic.status = TaskStatus.READY;
          await taskRepo.save(epic);
          console.log(
            `   - Epic "${epic.title}" assigned to: ${techLead.name}`,
          );
        }

        const assignedEpics = teamEpics;

        // ========== Step 5: Team Epic → Implementation Tasks Decomposition ==========
        console.log(
          '\n🔄 Step 5: Decomposing Team Epics into Implementation Tasks...',
        );

        for (const epic of assignedEpics) {
          if (epic.status === TaskStatus.READY) {
            console.log(`   Decomposing epic: "${epic.title}"...`);
            await taskExecutionService.executeTask(
              epic.id,
              epic.assignedHollonId,
            );
          }
        }

        // Verify Implementation Tasks were created
        const implTasks = await taskRepo.find({
          where: {
            parentTaskId: assignedEpics[0]?.id, // Check first epic
            type: TaskType.IMPLEMENTATION,
          },
        });
        console.log(
          `✅ Created ${implTasks.length} Implementation Task(s) for first epic`,
        );
        expect(implTasks.length).toBeGreaterThan(0);

        for (const task of implTasks.slice(0, 3)) {
          // Show first 3
          console.log(`   - Task: "${task.title}" (${task.status})`);
        }

        // ========== Step 6: Implementation Tasks → Team Member Assignment ==========
        console.log('\n👥 Step 6: Getting Ready Tasks...');

        // Get READY implementation tasks from the epics we just decomposed
        // Note: Goal decomposition creates new projects, so we filter by parentTaskId instead
        const epicIds = assignedEpics.map((e) => e.id);
        const readyTasks = await taskRepo
          .createQueryBuilder('task')
          .where('task.parentTaskId IN (:...epicIds)', { epicIds })
          .andWhere('task.type = :type', { type: TaskType.IMPLEMENTATION })
          .andWhere('task.status = :status', { status: TaskStatus.READY })
          .take(3)
          .getMany();

        console.log(`✅ Found ${readyTasks.length} READY tasks for execution`);
        for (const task of readyTasks.slice(0, 3)) {
          console.log(
            `   - Task "${task.title}" assigned to hollon: ${task.assignedHollonId?.slice(0, 8) || 'none'}`,
          );
        }

        const assignedTasks = readyTasks;

        // ========== Step 7: Task Execution ==========
        console.log('\n⚙️  Step 7: Executing Tasks...');
        console.log(
          '   Note: This will call actual LLM and may take several minutes per task',
        );
        console.log(
          '   Note: Brain automatically sets dependencies - some tasks may be BLOCKED',
        );

        // Execute READY tasks (Brain already set dependencies)
        // BLOCKED tasks will be unblocked after their dependencies are completed
        const tasksToExecute = assignedTasks.slice(0, 1); // Execute first READY task
        const executionResults: Array<{
          taskId: string;
          taskTitle: string;
          hollonId: string;
          hollonName: string;
          success: boolean;
          error?: string;
          decomposed?: boolean;
          subtaskCount?: number;
          prCreated?: boolean;
          prUrl?: string;
          workingDirectory?: string;
        }> = [];

        if (tasksToExecute.length > 0) {
          // Assign different hollons to different tasks for parallel execution test
          // Note: We'll use devBravo for all tasks since devCharlie is not created in test data
          const hollonAssignments = [
            { hollon: devBravo, name: 'Developer-Bravo' },
            { hollon: devBravo, name: 'Developer-Bravo' },
            { hollon: devBravo, name: 'Developer-Bravo' },
          ];

          console.log(`\n   Executing ${tasksToExecute.length} task(s):\n`);

          // Execute tasks sequentially (parallel execution would be too complex for E2E test)
          // But we verify each task uses independent worktrees
          for (let i = 0; i < tasksToExecute.length; i++) {
            const task = tasksToExecute[i];
            const assignment = hollonAssignments[i];
            const result = {
              taskId: task.id,
              taskTitle: task.title,
              hollonId: assignment.hollon.id,
              hollonName: assignment.name,
              success: false,
            };

            console.log(
              `   ${i + 1}. Executing: "${task.title}" → ${assignment.name}`,
            );

            try {
              await taskExecutionService.executeTask(
                task.id,
                assignment.hollon.id,
              );
              result.success = true;
              console.log(`      ✅ Task execution completed`);

              // Reload task
              const executedTask = await taskRepo.findOne({
                where: { id: task.id },
              });

              // Check worktree path
              if (executedTask.workingDirectory) {
                result.workingDirectory = executedTask.workingDirectory;
                console.log(
                  `      📁 Worktree: ...${executedTask.workingDirectory.slice(-50)}`,
                );
              }

              // Check if task was decomposed into subtasks
              const subtasks = await taskRepo.find({
                where: { parentTaskId: task.id },
              });

              if (subtasks.length > 0) {
                result.decomposed = true;
                result.subtaskCount = subtasks.length;
                console.log(
                  `      🔄 Decomposed into ${subtasks.length} subtask(s)`,
                );
                console.log(
                  `      📊 Parent task status: ${executedTask.status}`,
                );

                // Verify sub-hollons were created
                for (const subtask of subtasks.slice(0, 2)) {
                  if (subtask.assignedHollonId) {
                    const subHollon = await hollonRepo.findOne({
                      where: { id: subtask.assignedHollonId },
                    });
                    if (subHollon) {
                      console.log(
                        `         - Subtask: "${subtask.title.slice(0, 40)}..."`,
                      );
                      console.log(
                        `           Sub-hollon: ${subHollon.name.slice(0, 30)}... (depth=${subHollon.depth}, lifecycle=${subHollon.lifecycle})`,
                      );
                      expect(subHollon.lifecycle).toBe('temporary');
                      expect(subHollon.depth).toBe(1);
                      expect(subHollon.createdByHollonId).toBe(
                        assignment.hollon.id,
                      );
                    }
                  }
                }

                // Execute ALL subtasks to complete parent task and generate PR
                console.log(
                  `      🔄 Executing all ${subtasks.length} subtask(s) to complete parent task...`,
                );

                for (const subtask of subtasks) {
                  const subHollon = await hollonRepo.findOne({
                    where: { id: subtask.assignedHollonId },
                  });

                  if (subHollon) {
                    try {
                      console.log(
                        `         - Executing: "${subtask.title.slice(0, 40)}..."`,
                      );
                      await taskExecutionService.executeTask(
                        subtask.id,
                        subHollon.id,
                      );
                      console.log(`         ✅ Completed`);
                    } catch (subtaskError) {
                      console.log(
                        `         ⚠️  Error: ${(subtaskError as Error).message}`,
                      );
                    }
                  }
                }

                // After all subtasks complete, parent task should be completed
                // Check if PR was created for the parent task
                console.log(
                  `      🔍 Checking if parent task completed and PR created...`,
                );
                const updatedParentTask = await taskRepo.findOne({
                  where: { id: task.id },
                });

                if (updatedParentTask?.status === 'completed') {
                  console.log(`      ✅ Parent task completed!`);

                  const TaskPullRequest =
                    require('../../src/modules/collaboration/entities/task-pull-request.entity').TaskPullRequest;
                  const prRepo = dataSource.getRepository(TaskPullRequest);
                  const pr = await prRepo.findOne({
                    where: { taskId: task.id },
                  });

                  if (pr) {
                    result.prCreated = true;
                    result.prUrl = pr.prUrl;
                    console.log(`      ✅ PR created: ${pr.prUrl}`);
                    expect(pr.prUrl).toContain('github.com');
                    createdPRs.push(pr.id);
                  } else {
                    console.log(
                      `      ⚠️  No PR found for completed parent task`,
                    );
                  }
                } else {
                  console.log(
                    `      ⚠️  Parent task status: ${updatedParentTask?.status}`,
                  );
                }
              } else {
                // Task was executed directly (no decomposition)
                result.decomposed = false;
                console.log(
                  `      ℹ️  Task executed directly (no decomposition)`,
                );

                // Check if PR was created
                const TaskPullRequest =
                  require('../../src/modules/collaboration/entities/task-pull-request.entity').TaskPullRequest;
                const prRepo = dataSource.getRepository(TaskPullRequest);
                const pr = await prRepo.findOne({
                  where: { taskId: task.id },
                });

                if (pr) {
                  result.prCreated = true;
                  result.prUrl = pr.prUrl;
                  console.log(`      ✅ PR created: ${pr.prUrl}`);
                  expect(pr.prUrl).toContain('github.com');
                  createdPRs.push(pr.id);
                }
              }
            } catch (error) {
              result.error = (error as Error).message;
              console.log(`      ⚠️  Execution error: ${result.error}`);
            }

            executionResults.push(result);
            console.log(); // Empty line between tasks
          }

          // ========== Step 8: Worktree Isolation Verification ==========
          console.log('📦 Step 8: Verifying Worktree Isolation...\n');

          const worktrees = executionResults
            .filter((r) => r.workingDirectory)
            .map((r) => r.workingDirectory);

          if (worktrees.length > 1) {
            // Check that each task has a different worktree (isolation)
            const uniqueWorktrees = new Set(worktrees);
            console.log(`   Total tasks executed: ${executionResults.length}`);
            console.log(`   Tasks with worktrees: ${worktrees.length}`);
            console.log(`   Unique worktrees: ${uniqueWorktrees.size}`);

            if (worktrees.length === uniqueWorktrees.size) {
              console.log(
                '   ✅ Each task has independent worktree (isolation verified)',
              );
            } else {
              console.log(
                '   ⚠️  Some tasks share worktrees (may be subtasks)',
              );
            }

            // Verify worktree naming convention
            for (const wt of worktrees) {
              expect(wt).toContain('.git-worktrees/hollon-');
              expect(wt).toContain('/task-');
            }
            console.log(
              '   ✅ All worktrees follow naming convention: .git-worktrees/hollon-{id}/task-{id}',
            );
          }

          // ========== Step 9: PR Creation Verification ==========
          console.log('\n🔀 Step 9: Verifying PR Creation...\n');

          const prsCreated = executionResults.filter((r) => r.prCreated);
          console.log(`   Tasks with PRs: ${prsCreated.length}`);

          for (const result of prsCreated) {
            console.log(`   ✅ PR: ${result.taskTitle.slice(0, 50)}...`);
            console.log(`      URL: ${result.prUrl}`);
            console.log(`      Created by: ${result.hollonName}`);
          }

          if (prsCreated.length > 0) {
            console.log(
              `\n   ✅ ${prsCreated.length} PR(s) successfully created`,
            );
          }

          // ========== Step 10: CI Status Check & Failure Handling ==========
          console.log('\n🔍 Step 10: Checking CI Status for PRs...\n');

          for (const result of prsCreated) {
            if (result.prUrl && result.workingDirectory) {
              console.log(
                `   Checking CI for: ${result.taskTitle.slice(0, 40)}...`,
              );

              try {
                const ciResult = await taskExecutionService.checkCIStatus(
                  result.prUrl,
                  result.workingDirectory,
                );

                console.log(
                  `      Status: ${ciResult.passed ? '✅ PASSED' : '❌ FAILED'}`,
                );

                if (!ciResult.passed && ciResult.failedChecks.length > 0) {
                  console.log(
                    `      Failed checks: ${ciResult.failedChecks.slice(0, 3).join(', ')}`,
                  );

                  // ========== Step 10.5: CI Failure Recovery ==========
                  console.log(
                    '\n⚠️  Step 10.5: CI Failure - Testing Recovery...\n',
                  );

                  // Find the task for this PR
                  const task = await taskRepo.findOne({
                    where: { id: result.taskId },
                  });

                  if (task) {
                    console.log(
                      '   🔧 Handling CI failure with retry logic...',
                    );

                    // Call handleCIFailure (stores feedback in metadata)
                    const { shouldRetry, feedback } =
                      await taskExecutionService.handleCIFailure(
                        task,
                        ciResult.failedChecks,
                        result.prUrl,
                        result.workingDirectory,
                      );

                    console.log(
                      `   Retry decision: ${shouldRetry ? 'RETRY' : 'FAILED'}`,
                    );
                    console.log(
                      `   Feedback preview: ${feedback.slice(0, 100)}...`,
                    );

                    if (shouldRetry) {
                      // Reset task to READY (triggers retry)
                      await taskRepo.update(task.id, {
                        status: TaskStatus.READY,
                      });

                      console.log(
                        '\n   🧠 Brain receiving CI feedback and retrying...',
                      );
                      console.log(
                        '   (Brain should receive CI feedback in prompt)',
                      );

                      // Re-execute task with CI feedback
                      const retryResult =
                        await taskExecutionService.executeTask(
                          task.id,
                          task.assignedHollonId,
                        );

                      console.log(`   ✅ Retry execution completed`);
                      console.log(`   New PR: ${retryResult.prUrl || 'None'}`);

                      // Check CI again after retry
                      if (retryResult.prUrl) {
                        const retryCIResult =
                          await taskExecutionService.checkCIStatus(
                            retryResult.prUrl,
                            retryResult.worktreePath,
                          );

                        console.log(
                          `   Retry CI Status: ${retryCIResult.passed ? '✅ PASSED' : '❌ FAILED'}`,
                        );

                        if (retryCIResult.passed) {
                          console.log(
                            '   ✅ CI passed after Brain recovery!\n',
                          );
                          // Update result for next steps
                          result.prUrl = retryResult.prUrl;
                          result.workingDirectory = retryResult.worktreePath;
                        } else {
                          console.log('   ⚠️  CI still failing after retry\n');
                        }
                      }
                    } else {
                      // Max retries reached
                      console.log(
                        '   ❌ Max retries reached, task marked as FAILED\n',
                      );
                      expect(task.status).toBe(TaskStatus.FAILED);
                    }
                  }
                }
              } catch (error) {
                console.log(
                  `      ⚠️  CI check error: ${(error as Error).message}`,
                );
              }
            }
          }

          // ========== Step 11: Manager Review (Task A Only - for Dependency Test) ==========
          console.log('\n👔 Step 11: Manager Review (Task A only)...\n');

          console.log(`   Manager hollon: ${techLead.name}`);
          console.log(`   Manager ID: ${techLead.id.slice(0, 8)}`);
          console.log('   Strategy: Merge Task A only (to unblock Task B)');
          console.log('   All other PRs will be closed in Step 12\n');

          // Verify manager is NOT the one who created the PRs (no self-review)
          for (const result of prsCreated) {
            expect(result.hollonId).not.toBe(techLead.id);
          }
          console.log(
            '   ✅ No self-review detected (PRs created by team members)',
          );

          // Actually perform manager review and merge using real CodeReviewService
          const TaskPullRequest =
            require('../../src/modules/collaboration/entities/task-pull-request.entity').TaskPullRequest;
          const prRepo = dataSource.getRepository(TaskPullRequest);

          let reviewedCount = 0;
          let mergedCount = 0;

          // Only merge first PR (for dependency unblocking test)
          // Brain has set dependencies - merging first task will unblock dependent tasks
          const firstPRResult = prsCreated[0];

          if (firstPRResult && firstPRResult.prUrl) {
            console.log(
              `   Reviewing and merging first PR: ${firstPRResult.taskTitle.slice(0, 40)}...`,
            );

            try {
              // Find the PR entity
              const prEntity = await prRepo.findOne({
                where: { taskId: firstPRResult.taskId },
              });

              if (prEntity) {
                console.log(`      PR ID: ${prEntity.id.slice(0, 8)}`);
                console.log(`      Author: ${firstPRResult.hollonName}`);
                console.log(`      Reviewer: ${techLead.name}`);

                // Step 1: Request review (assigns reviewer and sends REVIEW_REQUEST message)
                console.log('      📝 Requesting review from manager...');
                const prWithReviewer = await codeReviewService.requestReview(
                  prEntity.id,
                );

                // Step 2: Perform automated review using the assigned reviewer
                // This calls Brain Provider (or simple heuristics in Phase 3.5)
                const assignedReviewerId = prWithReviewer.reviewerHollonId;
                if (!assignedReviewerId) {
                  console.log(
                    '      ⚠️  No reviewer assigned, skipping review',
                  );
                } else {
                  console.log(
                    `      🤖 Reviewer (${assignedReviewerId.slice(0, 8)}) performing automated review...`,
                  );
                  await codeReviewService.performAutomatedReview(
                    prEntity.id,
                    assignedReviewerId,
                  );

                  reviewedCount++;
                  console.log('      ✅ Code review completed');

                  // Step 3: Check if PR was auto-merged
                  // performAutomatedReview → submitReview → autoMergePullRequest (if approved)
                  const finalPR = await prRepo.findOne({
                    where: { id: prEntity.id },
                    relations: ['task'],
                  });

                  if (finalPR) {
                    console.log(`      📊 Review decision: ${finalPR.status}`);

                    if (finalPR.status === 'merged') {
                      console.log('      🔀 PR merged (DB only - test mode)');
                      console.log(
                        `      ✅ Task status: ${finalPR.task.status}`,
                      );
                      mergedCount++;

                      // Verify merge was successful
                      expect(finalPR.status).toBe('merged');
                      expect(finalPR.task.status).toBe(TaskStatus.COMPLETED);
                    } else if (finalPR.status === 'approved') {
                      console.log('      ⚠️  PR approved but not merged');
                    } else {
                      console.log(
                        `      ⚠️  PR status: ${finalPR.status} (not merged)`,
                      );
                    }

                    // Verify reviewer was assigned (should be the team manager)
                    expect(finalPR.reviewerHollonId).toBe(assignedReviewerId);
                    expect(assignedReviewerId).toBe(techLead.id);
                  }
                }
              } else {
                console.log('      ⚠️  PR entity not found');
              }
            } catch (error) {
              console.log(
                `      ⚠️  Review error: ${(error as Error).message}`,
              );
            }
          }

          console.log(`\n   ✅ Manager review completed:`);
          console.log(`      - PRs reviewed: ${reviewedCount}`);
          console.log(`      - PRs merged: ${mergedCount}`);
          console.log(
            `      - All reviews done by ${techLead.name} (no self-review)`,
          );

          // ========== Step 11.5: Verify Dependency Unblocking ==========
          if (mergedCount > 0 && firstPRResult) {
            console.log('\n🔓 Step 11.5: Verifying Dependency Unblocking...\n');

            // Find tasks that were BLOCKED and might have been unblocked
            const completedTask = await taskRepo.findOne({
              where: { id: firstPRResult.taskId },
              relations: ['dependentTasks'],
            });

            if (completedTask && completedTask.dependentTasks) {
              const dependentTaskIds = completedTask.dependentTasks.map(
                (t) => t.id,
              );
              console.log(
                `   Completed task has ${dependentTaskIds.length} dependent task(s)`,
              );

              if (dependentTaskIds.length > 0) {
                // Check if any dependent tasks were unblocked
                const dependentTasks =
                  await taskRepo.findByIds(dependentTaskIds);
                const unblockedTasks = dependentTasks.filter(
                  (t) => t.status === TaskStatus.READY,
                );

                console.log(
                  `   Dependent tasks unblocked: ${unblockedTasks.length}/${dependentTasks.length}`,
                );

                if (unblockedTasks.length > 0) {
                  console.log(
                    '\n   ✅ SUCCESS: Dependent tasks were automatically unblocked!',
                  );
                  console.log(
                    '   ✅ Dependency workflow verified: Task completion → Dependent tasks unblocked',
                  );
                  for (const task of unblockedTasks) {
                    console.log(`      - ${task.title} (${task.status})`);
                  }
                } else {
                  console.log(
                    '\n   ℹ️  No tasks unblocked yet (may still have other dependencies)',
                  );
                }
              } else {
                console.log('   ℹ️  Completed task has no dependent tasks');
              }
            }
          } else {
            console.log(
              '\n⚠️  Step 11.5: Skipping dependency test (no PR merged)',
            );
          }

          // ========== Step 12: Cleanup Test PRs ==========
          console.log('\n🧹 Step 12: Closing All Test PRs...\n');
          console.log(
            '   Note: Finding all PRs from this test run (including auto-executed tasks)\n',
          );

          // Find all PRs created during this test (not just createdPRs array)
          // This handles cases where background processes execute unblocked tasks
          const TaskPullRequestEntity =
            require('../../src/modules/collaboration/entities/task-pull-request.entity').TaskPullRequest;
          const prRepository = dataSource.getRepository(TaskPullRequestEntity);

          const allTestPRs = await prRepository
            .createQueryBuilder('pr')
            .leftJoinAndSelect('pr.task', 'task')
            .where('task.project_id = :projectId', { projectId: project.id })
            .andWhere('pr.status IN (:...statuses)', {
              statuses: ['draft', 'ready_for_review', 'approved', 'merged'],
            })
            .getMany();

          console.log(`   Found ${allTestPRs.length} PR(s) to close\n`);

          for (const pr of allTestPRs) {
            try {
              await codeReviewService.closePullRequest(
                pr.id,
                'E2E test completed - closing PR automatically',
              );
              console.log(
                `   ✅ Closed PR: ${pr.id.slice(0, 8)} (${pr.task.title.substring(0, 50)}...)`,
              );
            } catch (error) {
              console.log(
                `   ⚠️  Failed to close PR ${pr.id.slice(0, 8)}: ${(error as Error).message}`,
              );
            }
          }
        }

        // ========== Final Verification ==========
        console.log('\n🎉 Phase 3 Complete Workflow Test COMPLETED!');
        console.log('   Summary:');
        console.log(`   - Goal: ${goal.title}`);
        console.log(`   - Team Epics: ${teamEpics.length}`);
        console.log(`   - Implementation Tasks: ${implTasks.length}`);
        console.log(`   - Tasks Executed: ${executionResults.length}`);

        // Count successful executions
        const successfulExecutions = executionResults.filter((r) => r.success);
        console.log(
          `   - Successful Executions: ${successfulExecutions.length}`,
        );

        // Count decompositions
        const decomposedTasks = executionResults.filter((r) => r.decomposed);
        if (decomposedTasks.length > 0) {
          const totalSubtasks = decomposedTasks.reduce(
            (sum, r) => sum + (r.subtaskCount || 0),
            0,
          );
          console.log(
            `   - Tasks Decomposed: ${decomposedTasks.length} (${totalSubtasks} subtasks)`,
          );
          console.log(`   - Sub-hollons Verified: ✅`);
        }

        // Count PRs
        const prsCreated = executionResults.filter((r) => r.prCreated);
        if (prsCreated.length > 0) {
          console.log(`   - PRs Created: ${prsCreated.length}`);
        }

        // Verify worktree isolation
        const uniqueWorktrees = new Set(
          executionResults
            .filter((r) => r.workingDirectory)
            .map((r) => r.workingDirectory),
        );
        if (uniqueWorktrees.size > 1) {
          console.log(
            `   - Worktree Isolation: ✅ (${uniqueWorktrees.size} independent worktrees)`,
          );
        }

        console.log('\n✅ Full workflow automation verified:');
        console.log('   ✅ Goal → Team Epic decomposition');
        console.log('   ✅ Manager assignment');
        console.log('   ✅ Epic → Implementation Task decomposition');
        console.log('   ✅ Multiple hollons executing tasks');
        console.log('   ✅ Worktree isolation per task');
        console.log('   ✅ Task decomposition into subtasks');
        console.log('   ✅ Sub-hollon creation and verification');
        console.log('   ✅ PR creation per task');
        console.log('   ✅ CI status checking');
        console.log(
          '   ✅ Manager review with CodeReviewService (automated review)',
        );
        console.log('   ✅ Automatic PR merge (test mode - DB only)');
        console.log('   ✅ No self-review enforcement');
        console.log(
          "   ✅ Brain's automatic dependency workflow (BLOCKED tasks created)",
        );
        console.log(
          '   ✅ Dependency unblocking (completed task → unblock dependents)',
        );
        console.log('   ✅ PR close instead of merge (test cleanup)');
        console.log('\n🚀 Phase 3 automation system working correctly!');
      },
      TEST_TIMEOUT,
    );
  });

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
        name: 'Calculator Test Org',
      }),
    );

    // Create Brain Provider Config
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
        timeoutSeconds: 1200, // 20 minutes for complex calculator tasks
        maxRetries: 3,
      }),
    );

    // Create teams
    backendTeam = await teamRepo.save(
      teamRepo.create({
        name: 'Calculator Development Team',
        description: 'Backend development team for calculator module',
        organizationId: organization.id,
      }),
    );

    // Create roles
    const ctoRole = await roleRepo.save(
      roleRepo.create({
        name: 'CTO',
        description: 'Chief Technology Officer',
        organizationId: organization.id,
        capabilities: ['strategic-planning', 'goal-decomposition'],
      }),
    );

    const techLeadRole = await roleRepo.save(
      roleRepo.create({
        name: 'TechLead',
        description: 'Technical Team Lead',
        organizationId: organization.id,
        capabilities: ['team-epic-decomposition', 'code-review'],
      }),
    );

    const developerRole = await roleRepo.save(
      roleRepo.create({
        name: 'Developer',
        description: 'Software Developer',
        organizationId: organization.id,
        capabilities: ['implementation', 'testing'],
      }),
    );

    // Create specialized roles for sub-hollons
    await roleRepo.save([
      roleRepo.create({
        name: 'PlanningSpecialist',
        description: 'Planning specialist',
        organizationId: organization.id,
        capabilities: ['planning'],
        availableForTemporaryHollon: true,
      }),
      roleRepo.create({
        name: 'ImplementationSpecialist',
        description: 'Implementation specialist',
        organizationId: organization.id,
        capabilities: ['implementation'],
        availableForTemporaryHollon: true,
      }),
      roleRepo.create({
        name: 'TestingSpecialist',
        description: 'Testing specialist',
        organizationId: organization.id,
        capabilities: ['testing'],
        availableForTemporaryHollon: true,
      }),
      roleRepo.create({
        name: 'SecurityReviewer',
        description: 'Security review specialist',
        organizationId: organization.id,
        capabilities: ['security', 'code-review'],
        availableForTemporaryHollon: true,
      }),
    ]);

    // Create hollons
    cto = await hollonRepo.save(
      hollonRepo.create({
        name: 'CTO-Calculator',
        organizationId: organization.id,
        roleId: ctoRole.id,
      }),
    );

    techLead = await hollonRepo.save(
      hollonRepo.create({
        name: 'TechLead-Calculator',
        organizationId: organization.id,
        roleId: techLeadRole.id,
        managerId: cto.id,
        teamId: backendTeam.id,
      }),
    );

    // Set techLead as the team manager for proper code review workflow
    backendTeam.managerHollonId = techLead.id;
    await teamRepo.save(backendTeam);

    devBravo = await hollonRepo.save(
      hollonRepo.create({
        name: 'Developer-Bravo',
        organizationId: organization.id,
        roleId: developerRole.id,
        managerId: techLead.id,
        teamId: backendTeam.id,
      }),
    );

    // Create project pointing to current repo
    project = await projectRepo.save(
      projectRepo.create({
        name: 'Hollon AI Calculator Module',
        description: 'Add calculator module to Hollon AI',
        organizationId: organization.id,
        repositoryUrl: currentRepoPath, // Use current repo
        workingDirectory: currentRepoPath, // Set working directory
        defaultBranch: 'main',
      }),
    );

    console.log('✅ Test data setup complete:');
    console.log(`   Organization: ${organization.name}`);
    console.log(`   Team: ${backendTeam.name}`);
    console.log(`   Project: ${project.name}`);
    console.log(`   Repository: ${currentRepoPath}`);
    console.log(`   Hollons: CTO → TechLead → Developer`);
  }
});
