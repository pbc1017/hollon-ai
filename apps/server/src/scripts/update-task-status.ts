import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Task } from '../modules/task/entities/task.entity';

async function updateTaskStatuses() {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  const taskRepo = app.get(getRepositoryToken(Task));

  // 완료로 표시할 태스크 제목들
  const completedTasks = [
    'StandupService 완성',
    'CrossTeamContract 엔티티 구현',
  ];

  console.log('===== 태스크 상태 업데이트 =====');

  for (const title of completedTasks) {
    const task = await taskRepo.findOne({ where: { title } });
    if (task) {
      if (task.status !== 'completed') {
        await taskRepo.update(task.id, {
          status: 'completed',
          completedAt: new Date(),
          errorMessage: null,
        });
        console.log('Updated to completed:', title);
      } else {
        console.log('Already completed:', title);
      }
    } else {
      console.log('Not found:', title);
    }
  }

  // 최종 상태 확인
  const statusCounts: Record<string, number> = {};
  const allTasks = await taskRepo.find();
  for (const t of allTasks) {
    statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
  }

  console.log('\n===== 최종 태스크 상태 =====');
  for (const [status, count] of Object.entries(statusCounts).sort()) {
    console.log('  ' + status + ':', count);
  }

  await app.close();
}

updateTaskStatuses();
