import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join, resolve } from 'path';
import { Hollon } from '../modules/hollon/entities/hollon.entity';
import { Task, TaskStatus } from '../modules/task/entities/task.entity';

// Load environment variables from project root
const projectRoot = resolve(__dirname, '../../../..');
dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config({ path: join(projectRoot, '.env') });

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'hollon',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hollon',
  entities: [__dirname + '/../**/*.entity{.ts,.js}'],
  synchronize: false,
});

async function assignTask() {
  await dataSource.initialize();
  console.log('🚀 Assigning Quick Test Task to DevBot-1...\n');

  try {
    const hollonRepo = dataSource.getRepository(Hollon);
    const taskRepo = dataSource.getRepository(Task);

    // Find DevBot-1
    const devBot = await hollonRepo.findOne({
      where: { name: 'DevBot-1' },
    });

    if (!devBot) {
      throw new Error('DevBot-1 not found! Run db:seed first.');
    }

    console.log(`✅ Found Hollon: ${devBot.name} (${devBot.id})`);

    // Find the Quick Test Task
    const task = await taskRepo.findOne({
      where: {
        title: 'StandupService에 getActiveTeamHollons 헬퍼 메서드 추가',
      },
      relations: ['project'],
    });

    if (!task) {
      throw new Error('Quick Test Task not found! Run db:seed first.');
    }

    console.log(`✅ Found Task: "${task.title}" (${task.id})`);
    console.log(`   Project: ${task.project?.name}`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Priority: ${task.priority}`);

    // Assign task to DevBot-1
    if (task.assignedHollonId) {
      console.log(`⚠️  Task already assigned to: ${task.assignedHollonId}`);
      console.log('   Reassigning to DevBot-1...');
    }

    task.assignedHollonId = devBot.id;
    task.status = TaskStatus.IN_PROGRESS;
    task.startedAt = new Date();

    await taskRepo.save(task);

    console.log('\n🎉 Task assigned successfully!');
    console.log('\n📋 Task Details:');
    console.log(`   ID: ${task.id}`);
    console.log(`   Title: ${task.title}`);
    console.log(`   Assigned to: ${devBot.name} (${devBot.id})`);
    console.log(`   Status: ${task.status}`);
    console.log(`   Started at: ${task.startedAt?.toISOString()}`);

    console.log('\n🔍 Next Steps:');
    console.log(
      '   1. The HollonOrchestrator should automatically detect this task',
    );
    console.log('   2. DevBot-1 will pull the task and execute it');
    console.log('   3. Monitor logs for execution progress');
    console.log('   4. Check the result in:');
    console.log('      - src/modules/meeting/services/standup.service.ts');
    console.log('      - Task status updates via WebSocket/API');

    console.log('\n💡 Monitoring Commands:');
    console.log('   - Check task status: GET /api/tasks/' + task.id);
    console.log('   - Check hollon status: GET /api/hollons/' + devBot.id);
    console.log('   - View server logs: check terminal output\n');
  } catch (error) {
    console.error('❌ Error assigning task:', error);
    throw error;
  } finally {
    await dataSource.destroy();
  }
}

// Run assignment
assignTask()
  .then(() => {
    console.log('✨ Assignment completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Assignment failed:', error);
    process.exit(1);
  });
