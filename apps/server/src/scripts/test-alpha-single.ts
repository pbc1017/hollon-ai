import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { HollonOrchestratorService } from '../modules/orchestration/services/hollon-orchestrator.service';
import { HollonService } from '../modules/hollon/hollon.service';

/**
 * Test Alpha hollon execution alone (without concurrent hollons)
 * This helps isolate whether Alpha's ENOENT error is timing/concurrency related
 */
async function testAlphaSingle() {
  console.log('🔬 Alpha Single Execution Test\n');
  console.log('='.repeat(60));

  const app = await NestFactory.createApplicationContext(AppModule);

  try {
    const orchestrator = app.get(HollonOrchestratorService);
    const hollonService = app.get(HollonService);

    // Find Alpha hollon
    const hollons = await hollonService.findAll();
    const alpha = hollons.find((h) => h.name === 'Alpha');

    if (!alpha) {
      console.error('❌ Alpha hollon not found!');
      process.exit(1);
    }

    console.log(`\n📋 Found Alpha hollon:`);
    console.log(`   ID: ${alpha.id}`);
    console.log(`   Status: ${alpha.status}`);
    console.log(`   Brain Provider: ${alpha.brainProviderId}`);

    // Reset Alpha to idle if in error state
    if (alpha.status === 'error') {
      console.log('\n⚠️  Alpha is in error state, resetting to idle...');
      await hollonService.update(alpha.id, { status: 'idle' as any });
      console.log('✅ Alpha reset to idle');
    }

    console.log('\n' + '='.repeat(60));
    console.log('🚀 Starting single execution cycle for Alpha...\n');

    const startTime = Date.now();

    try {
      const result = await orchestrator.runCycle(alpha.id);
      const duration = Date.now() - startTime;

      console.log('\n' + '='.repeat(60));
      console.log('📊 EXECUTION RESULT\n');

      if (result.success) {
        console.log('✅ SUCCESS');
        console.log(`   Task: ${result.taskTitle || 'N/A'}`);
        console.log(`   Task ID: ${result.taskId || 'N/A'}`);
      } else if (result.noTaskAvailable) {
        console.log('⚠️  NO TASK AVAILABLE');
      } else {
        console.log('❌ FAILED');
        console.log(`   Error: ${result.error}`);
      }

      console.log(`   Duration: ${duration}ms`);
    } catch (error) {
      const duration = Date.now() - startTime;
      console.log('\n' + '='.repeat(60));
      console.log('📊 EXECUTION RESULT\n');
      console.log('❌ EXCEPTION THROWN');
      console.log(
        `   Error: ${error instanceof Error ? error.message : String(error)}`,
      );
      console.log(`   Stack: ${error instanceof Error ? error.stack : 'N/A'}`);
      console.log(`   Duration: ${duration}ms`);
    }

    // Check final Alpha status
    const updatedAlpha = await hollonService.findOne(alpha.id);
    console.log(`\n📌 Final Alpha Status: ${updatedAlpha?.status}`);

    console.log('\n✨ Alpha Single Test completed!\n');
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  } finally {
    await app.close();
  }
}

testAlphaSingle()
  .then(() => {
    console.log('🎉 Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Test failed:', error);
    process.exit(1);
  });
