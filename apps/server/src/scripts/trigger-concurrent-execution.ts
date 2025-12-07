import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { HollonOrchestratorService } from '../modules/orchestration/services/hollon-orchestrator.service';
import { HollonService } from '../modules/hollon/hollon.service';
import { TaskService } from '../modules/task/task.service';
import { TaskStatus } from '../modules/task/entities/task.entity';

interface ExecutionResult {
  hollonName: string;
  hollonId: string;
  success: boolean;
  taskTitle?: string;
  taskId?: string;
  duration: number;
  error?: string;
  noTaskAvailable?: boolean;
}

/**
 * Trigger concurrent execution for multiple Dogfooding Hollons
 * This script tests Phase 2 concurrency: multiple hollons working in parallel
 */
async function triggerConcurrentExecution() {
  console.log('🚀 Starting Phase 2 Concurrency Test...\n');
  console.log('='.repeat(60));

  // Create NestJS application context
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const orchestrator = app.get(HollonOrchestratorService);
    const hollonService = app.get(HollonService);
    const taskService = app.get(TaskService);

    // Find Dogfooding Hollons (all 5 Phase 2 hollons)
    const hollons = await hollonService.findAll();
    const dogfoodingHollons = hollons.filter((h) =>
      ['Alpha', 'Beta', 'DevBot-1', 'DevBot-2', 'ReviewBot'].includes(h.name),
    );

    if (dogfoodingHollons.length === 0) {
      console.error('❌ No Dogfooding Hollons found!');
      console.log('   Make sure to run: npm run db:seed');
      process.exit(1);
    }

    console.log(`\n📋 Found ${dogfoodingHollons.length} Dogfooding Hollons:\n`);
    for (const hollon of dogfoodingHollons) {
      // Find assigned task for this hollon
      const tasks = await taskService.findAll({
        assignedHollonId: hollon.id,
        status: TaskStatus.READY,
      });
      const assignedTask = tasks[0];
      console.log(`   🤖 ${hollon.name} (${hollon.id.substring(0, 8)}...)`);
      console.log(`      Role: ${hollon.role?.name || 'N/A'}`);
      console.log(`      Status: ${hollon.status}`);
      console.log(`      Assigned Task: ${assignedTask?.title || 'None'}\n`);
    }

    console.log('='.repeat(60));
    console.log('\n⏱️  Starting concurrent execution cycles...\n');

    const startTime = Date.now();

    // Execute all hollons concurrently using Promise.all
    const executionPromises = dogfoodingHollons.map(async (hollon) => {
      const hollonStartTime = Date.now();
      console.log(`🔄 [${hollon.name}] Starting execution cycle...`);

      try {
        const result = await orchestrator.runCycle(hollon.id);
        const duration = Date.now() - hollonStartTime;

        return {
          hollonName: hollon.name,
          hollonId: hollon.id,
          success: result.success,
          taskTitle: result.taskTitle,
          taskId: result.taskId,
          duration,
          noTaskAvailable: result.noTaskAvailable,
          error: result.error,
        } as ExecutionResult;
      } catch (error) {
        const duration = Date.now() - hollonStartTime;
        return {
          hollonName: hollon.name,
          hollonId: hollon.id,
          success: false,
          duration,
          error: error instanceof Error ? error.message : String(error),
        } as ExecutionResult;
      }
    });

    // Wait for all executions to complete
    const results = await Promise.all(executionPromises);

    const totalDuration = Date.now() - startTime;

    // Print results
    console.log('\n' + '='.repeat(60));
    console.log('📊 EXECUTION RESULTS\n');

    let successCount = 0;
    let failCount = 0;
    let noTaskCount = 0;

    for (const result of results) {
      const statusEmoji = result.success
        ? '✅'
        : result.noTaskAvailable
          ? '⚠️'
          : '❌';
      const status = result.success
        ? 'SUCCESS'
        : result.noTaskAvailable
          ? 'NO TASK'
          : 'FAILED';

      console.log(`${statusEmoji} [${result.hollonName}] ${status}`);
      console.log(`   Duration: ${result.duration}ms`);

      if (result.taskTitle) {
        console.log(`   Task: ${result.taskTitle}`);
      }
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      console.log('');

      if (result.success) successCount++;
      else if (result.noTaskAvailable) noTaskCount++;
      else failCount++;
    }

    console.log('='.repeat(60));
    console.log('\n📈 SUMMARY\n');
    console.log(`   Total Hollons: ${results.length}`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ⚠️  No Task: ${noTaskCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   ⏱️  Total Duration: ${totalDuration}ms`);
    console.log(
      `   ⚡ Parallelism Efficiency: ${results.length > 0 ? ((results.reduce((sum, r) => sum + r.duration, 0) / totalDuration) * 100).toFixed(1) : 0}%`,
    );

    // Concurrency analysis
    console.log('\n🔍 CONCURRENCY ANALYSIS\n');

    const sumDurations = results.reduce((sum, r) => sum + r.duration, 0);

    console.log(`   Sequential would take: ${sumDurations}ms`);
    console.log(`   Concurrent took: ${totalDuration}ms`);
    console.log(
      `   Time saved: ${sumDurations - totalDuration}ms (${(((sumDurations - totalDuration) / sumDurations) * 100).toFixed(1)}%)`,
    );

    console.log('\n✨ Phase 2 Concurrency Test completed!\n');
  } catch (error) {
    console.error('❌ Concurrent execution failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the concurrent trigger
triggerConcurrentExecution()
  .then(() => {
    console.log('🎉 Concurrent trigger completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Concurrent trigger failed:', error);
    process.exit(1);
  });
