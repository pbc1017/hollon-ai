/**
 * Task CLI - 태스크 관리 도구
 *
 * 사용법:
 *   npm run task -- list [--status ready] [--project PROJECT_ID]
 *   npm run task -- add "제목" --project PROJECT_ID [--priority P2] [--description "설명"]
 *   npm run task -- show TASK_ID
 *   npm run task -- assign TASK_ID HOLLON_ID
 *   npm run task -- update TASK_ID --status ready
 *   npm run task -- delete TASK_ID
 *   npm run task -- run [HOLLON_ID]  # 홀론 실행
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join, resolve } from 'path';
import {
  Task,
  TaskStatus,
  TaskPriority,
} from '../modules/task/entities/task.entity';
import { Project } from '../modules/project/entities/project.entity';
import { Hollon, HollonStatus } from '../modules/hollon/entities/hollon.entity';

// Load environment variables from project root
const projectRoot = resolve(__dirname, '../../../..');
dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config({ path: join(projectRoot, '.env') });

// ANSI colors
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

const statusColors: Record<string, string> = {
  [TaskStatus.PENDING]: colors.dim,
  [TaskStatus.READY]: colors.cyan,
  [TaskStatus.IN_PROGRESS]: colors.yellow,
  [TaskStatus.COMPLETED]: colors.green,
  [TaskStatus.FAILED]: colors.red,
  [TaskStatus.BLOCKED]: colors.magenta,
};

const priorityColors: Record<string, string> = {
  [TaskPriority.P1_CRITICAL]: colors.red,
  [TaskPriority.P2_HIGH]: colors.yellow,
  [TaskPriority.P3_MEDIUM]: colors.blue,
  [TaskPriority.P4_LOW]: colors.dim,
};

function parseArgs(args: string[]): {
  command: string;
  positional: string[];
  flags: Record<string, string>;
} {
  const command = args[0] || 'help';
  const positional: string[] = [];
  const flags: Record<string, string> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const value =
        args[i + 1] && !args[i + 1].startsWith('--') ? args[++i] : 'true';
      flags[key] = value;
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

function formatTask(task: Task, verbose = false): string {
  const statusColor = statusColors[task.status] || colors.reset;
  const priorityColor = priorityColors[task.priority] || colors.reset;

  let output = `${colors.bright}${task.id.slice(0, 8)}${colors.reset} `;
  output += `${priorityColor}[${task.priority}]${colors.reset} `;
  output += `${statusColor}${task.status.padEnd(12)}${colors.reset} `;
  output += task.title;

  if (task.assignedHollonId) {
    output += ` ${colors.dim}→ ${task.assignedHollon?.name || task.assignedHollonId.slice(0, 8)}${colors.reset}`;
  }

  if (verbose) {
    output += `\n   ${colors.dim}Project: ${task.projectId.slice(0, 8)}${colors.reset}`;
    if (task.description) {
      output += `\n   ${colors.dim}${task.description.slice(0, 100)}${task.description.length > 100 ? '...' : ''}${colors.reset}`;
    }
    if (task.affectedFiles?.length) {
      output += `\n   ${colors.dim}Files: ${task.affectedFiles.join(', ')}${colors.reset}`;
    }
  }

  return output;
}

async function main() {
  const args = process.argv.slice(2);
  const { command, positional, flags } = parseArgs(args);

  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'hollon',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hollon',
    schema: process.env.DB_SCHEMA || 'hollon',
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
    synchronize: false,
  });

  await dataSource.initialize();

  const taskRepo = dataSource.getRepository(Task);
  const projectRepo = dataSource.getRepository(Project);
  const hollonRepo = dataSource.getRepository(Hollon);

  try {
    switch (command) {
      case 'list': {
        const query = taskRepo
          .createQueryBuilder('task')
          .leftJoinAndSelect('task.assignedHollon', 'hollon')
          .leftJoinAndSelect('task.project', 'project');

        if (flags.status) {
          query.andWhere('task.status = :status', { status: flags.status });
        }
        if (flags.project) {
          query.andWhere('task.project_id = :projectId', {
            projectId: flags.project,
          });
        }
        if (flags.hollon) {
          query.andWhere('task.assigned_hollon_id = :hollonId', {
            hollonId: flags.hollon,
          });
        }

        query
          .orderBy('task.priority', 'ASC')
          .addOrderBy('task.createdAt', 'ASC');

        const tasks = await query.getMany();

        if (tasks.length === 0) {
          console.log(`${colors.dim}No tasks found${colors.reset}`);
        } else {
          console.log(
            `\n${colors.bright}Tasks (${tasks.length})${colors.reset}\n`,
          );
          tasks.forEach((task) =>
            console.log(formatTask(task, !!flags.verbose)),
          );
          console.log();
        }
        break;
      }

      case 'add': {
        const title = positional[0];
        if (!title) {
          console.error(`${colors.red}Error: Title required${colors.reset}`);
          console.log('Usage: npm run task -- add "제목" --project PROJECT_ID');
          process.exit(1);
        }

        let projectId = flags.project;
        if (!projectId) {
          // 기본 프로젝트 찾기
          const defaultProject = await projectRepo.findOne({ where: {} });
          if (!defaultProject) {
            console.error(
              `${colors.red}Error: No project found. Create a project first or specify --project${colors.reset}`,
            );
            process.exit(1);
          }
          projectId = defaultProject.id;
        }

        const priority =
          (flags.priority as TaskPriority) || TaskPriority.P3_MEDIUM;
        const status = (flags.status as TaskStatus) || TaskStatus.READY;

        const task = taskRepo.create({
          title,
          description: flags.description || '',
          projectId,
          priority,
          status,
          affectedFiles: flags.files ? flags.files.split(',') : [],
          tags: flags.tags ? flags.tags.split(',') : [],
        });

        const saved = await taskRepo.save(task);
        console.log(`\n${colors.green}✓ Task created${colors.reset}`);
        console.log(formatTask(saved, true));
        console.log();
        break;
      }

      case 'show': {
        const taskId = positional[0];
        if (!taskId) {
          console.error(`${colors.red}Error: Task ID required${colors.reset}`);
          process.exit(1);
        }

        const task = await taskRepo.findOne({
          where: { id: taskId },
          relations: ['assignedHollon', 'project', 'parentTask', 'subtasks'],
        });

        if (!task) {
          console.error(`${colors.red}Error: Task not found${colors.reset}`);
          process.exit(1);
        }

        console.log(`\n${colors.bright}Task Details${colors.reset}\n`);
        console.log(`ID:          ${task.id}`);
        console.log(`Title:       ${task.title}`);
        console.log(
          `Status:      ${statusColors[task.status]}${task.status}${colors.reset}`,
        );
        console.log(
          `Priority:    ${priorityColors[task.priority]}${task.priority}${colors.reset}`,
        );
        console.log(`Project:     ${task.project?.name || task.projectId}`);
        console.log(
          `Assigned:    ${task.assignedHollon?.name || task.assignedHollonId || 'Unassigned'}`,
        );
        console.log(`Description: ${task.description || '(none)'}`);
        if (task.affectedFiles?.length) {
          console.log(`Files:       ${task.affectedFiles.join(', ')}`);
        }
        if (task.tags?.length) {
          console.log(`Tags:        ${task.tags.join(', ')}`);
        }
        console.log(`Created:     ${task.createdAt}`);
        if (task.startedAt) console.log(`Started:     ${task.startedAt}`);
        if (task.completedAt) console.log(`Completed:   ${task.completedAt}`);
        console.log();
        break;
      }

      case 'assign': {
        const [taskId, hollonId] = positional;
        if (!taskId || !hollonId) {
          console.error(
            `${colors.red}Error: Task ID and Hollon ID required${colors.reset}`,
          );
          console.log('Usage: npm run task -- assign TASK_ID HOLLON_ID');
          process.exit(1);
        }

        const task = await taskRepo.findOne({ where: { id: taskId } });
        if (!task) {
          console.error(`${colors.red}Error: Task not found${colors.reset}`);
          process.exit(1);
        }

        const hollon = await hollonRepo.findOne({ where: { id: hollonId } });
        if (!hollon) {
          console.error(`${colors.red}Error: Hollon not found${colors.reset}`);
          process.exit(1);
        }

        task.assignedHollonId = hollonId;
        if (task.status === TaskStatus.PENDING) {
          task.status = TaskStatus.READY;
        }

        await taskRepo.save(task);
        console.log(
          `\n${colors.green}✓ Task assigned to ${hollon.name}${colors.reset}\n`,
        );
        break;
      }

      case 'update': {
        const taskId = positional[0];
        if (!taskId) {
          console.error(`${colors.red}Error: Task ID required${colors.reset}`);
          process.exit(1);
        }

        const task = await taskRepo.findOne({ where: { id: taskId } });
        if (!task) {
          console.error(`${colors.red}Error: Task not found${colors.reset}`);
          process.exit(1);
        }

        if (flags.status) task.status = flags.status as TaskStatus;
        if (flags.priority) task.priority = flags.priority as TaskPriority;
        if (flags.title) task.title = flags.title;
        if (flags.description) task.description = flags.description;

        await taskRepo.save(task);
        console.log(`\n${colors.green}✓ Task updated${colors.reset}`);
        console.log(formatTask(task, true));
        console.log();
        break;
      }

      case 'delete': {
        const taskId = positional[0];
        if (!taskId) {
          console.error(`${colors.red}Error: Task ID required${colors.reset}`);
          process.exit(1);
        }

        const task = await taskRepo.findOne({ where: { id: taskId } });
        if (!task) {
          console.error(`${colors.red}Error: Task not found${colors.reset}`);
          process.exit(1);
        }

        await taskRepo.remove(task);
        console.log(`\n${colors.green}✓ Task deleted${colors.reset}\n`);
        break;
      }

      case 'hollons': {
        const hollons = await hollonRepo.find({
          relations: ['role', 'team'],
          order: { name: 'ASC' },
        });

        console.log(
          `\n${colors.bright}Hollons (${hollons.length})${colors.reset}\n`,
        );
        hollons.forEach((h) => {
          const statusColor =
            h.status === HollonStatus.IDLE
              ? colors.green
              : h.status === HollonStatus.WORKING
                ? colors.yellow
                : colors.dim;
          console.log(
            `${colors.bright}${h.id.slice(0, 8)}${colors.reset} ${statusColor}${h.status.padEnd(10)}${colors.reset} ${h.name} (${h.role?.name || 'no role'})`,
          );
        });
        console.log();
        break;
      }

      case 'projects': {
        const projects = await projectRepo.find({
          order: { name: 'ASC' },
        });

        console.log(
          `\n${colors.bright}Projects (${projects.length})${colors.reset}\n`,
        );
        projects.forEach((p) => {
          console.log(
            `${colors.bright}${p.id.slice(0, 8)}${colors.reset} ${p.name}`,
          );
          if (p.description) {
            console.log(
              `   ${colors.dim}${p.description.slice(0, 80)}${colors.reset}`,
            );
          }
        });
        console.log();
        break;
      }

      case 'help':
      default:
        console.log(`
${colors.bright}Task CLI - 태스크 관리 도구${colors.reset}

${colors.cyan}Commands:${colors.reset}
  list                        태스크 목록 조회
    --status STATUS           상태 필터 (pending, ready, in_progress, completed, failed)
    --project PROJECT_ID      프로젝트 필터
    --hollon HOLLON_ID        할당된 홀론 필터
    --verbose                 상세 정보 표시

  add "제목"                  새 태스크 추가
    --project PROJECT_ID      프로젝트 ID (필수, 없으면 기본 프로젝트)
    --priority P1|P2|P3|P4    우선순위 (기본: P3)
    --status STATUS           상태 (기본: ready)
    --description "설명"      설명
    --files "a.ts,b.ts"       영향 파일 (콤마 구분)
    --tags "tag1,tag2"        태그 (콤마 구분)

  show TASK_ID                태스크 상세 조회

  assign TASK_ID HOLLON_ID    태스크 할당

  update TASK_ID              태스크 수정
    --status STATUS
    --priority P1|P2|P3|P4
    --title "새 제목"
    --description "새 설명"

  delete TASK_ID              태스크 삭제

  hollons                     홀론 목록 조회
  projects                    프로젝트 목록 조회

${colors.cyan}Examples:${colors.reset}
  npm run task -- list --status ready
  npm run task -- add "MessageService 구현" --priority P2
  npm run task -- assign abc123 def456
  npm run task -- update abc123 --status in_progress
`);
        break;
    }
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(`${colors.red}Error:${colors.reset}`, err.message);
  process.exit(1);
});
