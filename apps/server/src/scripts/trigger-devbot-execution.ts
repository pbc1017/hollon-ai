import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { HollonOrchestratorService } from '../modules/orchestration/services/hollon-orchestrator.service';
import { HollonService } from '../modules/hollon/hollon.service';

/**
 * Manually trigger DevBot-1 execution for the Dogfooding experiment
 */
async function triggerExecution() {
  console.log('🚀 Triggering DevBot-1 execution...\n');

  // Create NestJS application context
  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const orchestrator = app.get(HollonOrchestratorService);
    const hollonService = app.get(HollonService);

    // Find DevBot-1 by name
    const hollons = await hollonService.findAll();
    const devBot = hollons.find((h) => h.name === 'DevBot-1');

    if (!devBot) {
      console.error('❌ DevBot-1 not found in database!');
      console.log('   Make sure to run: npm run db:seed');
      process.exit(1);
    }

    const hollonId = devBot.id;

    console.log(`📋 Hollon: ${devBot.name} (${hollonId})`);
    console.log(`   Team: ${devBot.team?.name || 'N/A'}`);
    console.log(`   Role: ${devBot.role?.name || 'N/A'}`);
    console.log('⏰ Starting execution cycle...\n');

    // Run one execution cycle
    const result = await orchestrator.runCycle(hollonId);

    console.log('\n📊 Execution Result:');
    console.log(`   Success: ${result.success}`);
    console.log(`   Duration: ${result.duration}ms`);

    if (result.noTaskAvailable) {
      console.log('   ⚠️  No task available');
    } else if (result.success && result.taskId) {
      console.log(
        `   ✅ Task completed: ${result.taskTitle} (${result.taskId})`,
      );
      if (result.output) {
        console.log('\n📝 Output preview:');
        console.log(
          result.output.substring(0, 500) +
            (result.output.length > 500 ? '...' : ''),
        );
      }
    } else if (result.error) {
      console.log(`   ❌ Error: ${result.error}`);
    }

    console.log('\n✅ Execution cycle completed');
  } catch (error) {
    console.error('❌ Execution failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

// Run the trigger
triggerExecution()
  .then(() => {
    console.log('\n🎉 Trigger completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Trigger failed:', error);
    process.exit(1);
  });
