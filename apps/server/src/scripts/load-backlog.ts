/**
 * YAML 백로그 로더
 *
 * 사용법:
 *   npm run task:load -- path/to/backlog.yaml
 *   npm run task:load -- path/to/backlog.yaml --dry-run  # 실제 저장 없이 검증만
 *   npm run task:load -- path/to/backlog.yaml --clear    # 기존 태스크 삭제 후 로드
 */

import * as fs from 'fs';
import * as path from 'path';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { resolve, join } from 'path';
import {
  Task,
  TaskStatus,
  TaskPriority,
  TaskType,
} from '../modules/task/entities/task.entity';
import { Project } from '../modules/project/entities/project.entity';
import { Hollon } from '../modules/hollon/entities/hollon.entity';

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
  cyan: '\x1b[36m',
};

interface BacklogTask {
  title: string;
  description?: string;
  type?: string;
  priority?: string;
  status?: string;
  assignedTo?: string; // hollon name
  affectedFiles?: string[];
  tags?: string[];
  acceptanceCriteria?: string[];
  dependsOn?: string[]; // task titles
}

interface BacklogFile {
  project?: string; // project name or id
  tasks: BacklogTask[];
}

// Simple YAML parser (for our specific format)
function parseYaml(content: string): BacklogFile {
  const lines = content.split('\n');
  const result: BacklogFile = { tasks: [] };
  let currentTask: BacklogTask | null = null;
  let currentArray: string[] | null = null;
  let currentArrayKey: string | null = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;

    // Project name
    if (trimmed.startsWith('project:')) {
      result.project = trimmed
        .slice(8)
        .trim()
        .replace(/^["']|["']$/g, '');
      continue;
    }

    // New task item
    if (trimmed.startsWith('- title:')) {
      if (currentTask) {
        result.tasks.push(currentTask);
      }
      currentTask = {
        title: trimmed
          .slice(9)
          .trim()
          .replace(/^["']|["']$/g, ''),
      };
      currentArray = null;
      currentArrayKey = null;
      continue;
    }

    // Task properties
    if (currentTask) {
      // Array item
      if (
        trimmed.startsWith('- ') &&
        currentArray !== null &&
        currentArrayKey !== null
      ) {
        currentArray.push(
          trimmed
            .slice(2)
            .trim()
            .replace(/^["']|["']$/g, ''),
        );
        continue;
      }

      // Property with array value
      if (trimmed.endsWith(':')) {
        const key = trimmed.slice(0, -1).trim();
        currentArrayKey = key;
        currentArray = [];
        (currentTask as any)[key] = currentArray;
        continue;
      }

      // Simple property
      const colonIndex = trimmed.indexOf(':');
      if (colonIndex > 0) {
        const key = trimmed.slice(0, colonIndex).trim();
        let value = trimmed
          .slice(colonIndex + 1)
          .trim()
          .replace(/^["']|["']$/g, '');

        // Handle inline arrays [a, b, c]
        if (value.startsWith('[') && value.endsWith(']')) {
          value = value.slice(1, -1);
          (currentTask as any)[key] = value
            .split(',')
            .map((s) => s.trim().replace(/^["']|["']$/g, ''));
        } else if (value) {
          (currentTask as any)[key] = value;
        }

        // Reset array tracking if new property
        if (!trimmed.endsWith(':')) {
          currentArray = null;
          currentArrayKey = null;
        }
      }
    }
  }

  // Add last task
  if (currentTask) {
    result.tasks.push(currentTask);
  }

  return result;
}

function mapPriority(priority?: string): TaskPriority {
  switch (priority?.toUpperCase()) {
    case 'P1':
    case 'CRITICAL':
      return TaskPriority.P1_CRITICAL;
    case 'P2':
    case 'HIGH':
      return TaskPriority.P2_HIGH;
    case 'P4':
    case 'LOW':
      return TaskPriority.P4_LOW;
    default:
      return TaskPriority.P3_MEDIUM;
  }
}

function mapStatus(status?: string): TaskStatus {
  switch (status?.toLowerCase()) {
    case 'pending':
      return TaskStatus.PENDING;
    case 'in_progress':
    case 'in-progress':
      return TaskStatus.IN_PROGRESS;
    case 'completed':
    case 'done':
      return TaskStatus.COMPLETED;
    case 'blocked':
      return TaskStatus.BLOCKED;
    default:
      return TaskStatus.READY;
  }
}

function mapType(type?: string): TaskType {
  switch (type?.toLowerCase()) {
    case 'review':
      return TaskType.REVIEW;
    case 'research':
      return TaskType.RESEARCH;
    case 'bug_fix':
    case 'bug':
    case 'fix':
      return TaskType.BUG_FIX;
    case 'documentation':
    case 'docs':
      return TaskType.DOCUMENTATION;
    case 'discussion':
      return TaskType.DISCUSSION;
    default:
      return TaskType.IMPLEMENTATION;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const filePath = args.find((a) => !a.startsWith('--'));
  const dryRun = args.includes('--dry-run');
  const clearExisting = args.includes('--clear');

  if (!filePath) {
    console.error(`${colors.red}Error: YAML file path required${colors.reset}`);
    console.log(
      'Usage: npm run task:load -- path/to/backlog.yaml [--dry-run] [--clear]',
    );
    process.exit(1);
  }

  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    console.error(
      `${colors.red}Error: File not found: ${fullPath}${colors.reset}`,
    );
    process.exit(1);
  }

  console.log(
    `\n${colors.bright}Loading backlog from: ${colors.reset}${fullPath}`,
  );
  if (dryRun) {
    console.log(
      `${colors.yellow}(Dry run - no changes will be saved)${colors.reset}`,
    );
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const backlog = parseYaml(content);

  console.log(
    `${colors.cyan}Found ${backlog.tasks.length} tasks${colors.reset}`,
  );
  if (backlog.project) {
    console.log(`${colors.dim}Project: ${backlog.project}${colors.reset}`);
  }

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

  // UUID format validation helper
  const isUUID = (str: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  try {
    // Find project
    let project: Project | null = null;
    if (backlog.project) {
      // Try by ID first if it's a valid UUID, otherwise by name
      if (isUUID(backlog.project)) {
        project = await projectRepo.findOne({ where: { id: backlog.project } });
      }
      if (!project) {
        project = await projectRepo.findOne({
          where: { name: backlog.project },
        });
      }
    }
    if (!project) {
      project = await projectRepo.findOne({ where: {} });
    }
    if (!project) {
      console.error(`${colors.red}Error: No project found${colors.reset}`);
      process.exit(1);
    }

    console.log(`${colors.green}Using project: ${project.name}${colors.reset}`);

    // Clear existing tasks if requested
    if (clearExisting && !dryRun) {
      const deleted = await taskRepo.delete({ projectId: project.id });
      console.log(
        `${colors.yellow}Cleared ${deleted.affected || 0} existing tasks${colors.reset}`,
      );
    }

    // Load hollons for assignment lookup
    const hollons = await hollonRepo.find();
    const hollonByName = new Map(hollons.map((h) => [h.name.toLowerCase(), h]));

    // Create tasks
    const created: Task[] = [];
    const errors: string[] = [];

    for (const taskDef of backlog.tasks) {
      try {
        // Find assigned hollon if specified
        let assignedHollonId: string | null = null;
        if (taskDef.assignedTo) {
          const hollon = hollonByName.get(taskDef.assignedTo.toLowerCase());
          if (hollon) {
            assignedHollonId = hollon.id;
          } else {
            console.log(
              `${colors.yellow}Warning: Hollon "${taskDef.assignedTo}" not found${colors.reset}`,
            );
          }
        }

        const task = taskRepo.create({
          title: taskDef.title,
          description: taskDef.description || '',
          type: mapType(taskDef.type),
          priority: mapPriority(taskDef.priority),
          status: mapStatus(taskDef.status),
          projectId: project.id,
          assignedHollonId,
          affectedFiles: taskDef.affectedFiles || [],
          tags: taskDef.tags || [],
          acceptanceCriteria: taskDef.acceptanceCriteria || [],
        });

        if (!dryRun) {
          const saved = await taskRepo.save(task);
          created.push(saved);
        } else {
          created.push(task);
        }

        const priorityColor =
          {
            [TaskPriority.P1_CRITICAL]: colors.red,
            [TaskPriority.P2_HIGH]: colors.yellow,
            [TaskPriority.P3_MEDIUM]: colors.blue,
            [TaskPriority.P4_LOW]: colors.dim,
          }[task.priority] || colors.reset;

        console.log(
          `  ${colors.green}✓${colors.reset} ${priorityColor}[${task.priority}]${colors.reset} ${task.title}`,
        );
      } catch (err: any) {
        errors.push(`${taskDef.title}: ${err.message}`);
        console.log(
          `  ${colors.red}✗${colors.reset} ${taskDef.title}: ${err.message}`,
        );
      }
    }

    console.log(`\n${colors.bright}Summary${colors.reset}`);
    console.log(`  ${colors.green}Created: ${created.length}${colors.reset}`);
    if (errors.length > 0) {
      console.log(`  ${colors.red}Errors: ${errors.length}${colors.reset}`);
    }
    if (dryRun) {
      console.log(
        `\n${colors.yellow}Dry run complete. Run without --dry-run to save.${colors.reset}`,
      );
    }
    console.log();
  } finally {
    await dataSource.destroy();
  }
}

main().catch((err) => {
  console.error(`${colors.red}Error:${colors.reset}`, err.message);
  process.exit(1);
});
