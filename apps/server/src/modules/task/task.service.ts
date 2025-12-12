import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Task, TaskStatus, TaskPriority } from './entities/task.entity';
import { Project } from '../project/entities/project.entity';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { DocumentService } from '../document/document.service';
import { DocumentType } from '../document/entities/document.entity';
import { KnowledgeVersionService } from '../document/services/knowledge-version.service';

const MAX_SUBTASK_DEPTH = 3;
const MAX_SUBTASKS_PER_TASK = 10;

export interface TaskCompletionResult {
  output?: string;
  pullRequestUrl?: string;
  filesChanged?: string[];
  testsPassed?: boolean;
  reviewComments?: string[];
  [key: string]: unknown;
}

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    private readonly documentService: DocumentService,
    private readonly knowledgeVersionService: KnowledgeVersionService,
  ) {}

  async create(dto: CreateTaskDto, creatorHollonId?: string): Promise<Task> {
    let depth = 0;
    let organizationId = dto.organizationId;

    // organizationId가 없으면 Project로부터 가져오기
    if (!organizationId) {
      const project = await this.projectRepo.findOne({
        where: { id: dto.projectId },
        select: ['organizationId'],
      });
      if (!project) {
        throw new NotFoundException(`Project #${dto.projectId} not found`);
      }
      organizationId = project.organizationId;
    }

    // 부모 태스크가 있으면 깊이 계산
    if (dto.parentTaskId) {
      const parentTask = await this.taskRepo.findOne({
        where: { id: dto.parentTaskId },
      });
      if (!parentTask) {
        throw new NotFoundException(
          `Parent task #${dto.parentTaskId} not found`,
        );
      }

      // 안전장치: 최대 깊이 체크
      if (parentTask.depth >= MAX_SUBTASK_DEPTH) {
        throw new BadRequestException(
          `Maximum subtask depth (${MAX_SUBTASK_DEPTH}) exceeded`,
        );
      }

      // 안전장치: 서브태스크 개수 체크
      const subtaskCount = await this.taskRepo.count({
        where: { parentTaskId: dto.parentTaskId },
      });
      if (subtaskCount >= MAX_SUBTASKS_PER_TASK) {
        throw new BadRequestException(
          `Maximum subtasks per task (${MAX_SUBTASKS_PER_TASK}) exceeded`,
        );
      }

      depth = parentTask.depth + 1;
    }

    const task = this.taskRepo.create({
      ...dto,
      organizationId,
      depth,
      creatorHollonId,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
    });

    return this.taskRepo.save(task);
  }

  async findAll(filters?: {
    projectId?: string;
    status?: TaskStatus | TaskStatus[];
    priority?: TaskPriority;
    assignedHollonId?: string;
  }): Promise<Task[]> {
    const query = this.taskRepo.createQueryBuilder('task');

    if (filters?.projectId) {
      query.andWhere('task.project_id = :projectId', {
        projectId: filters.projectId,
      });
    }

    if (filters?.status) {
      if (Array.isArray(filters.status)) {
        query.andWhere('task.status IN (:...statuses)', {
          statuses: filters.status,
        });
      } else {
        query.andWhere('task.status = :status', { status: filters.status });
      }
    }

    if (filters?.priority) {
      query.andWhere('task.priority = :priority', {
        priority: filters.priority,
      });
    }

    if (filters?.assignedHollonId) {
      query.andWhere('task.assigned_hollon_id = :hollonId', {
        hollonId: filters.assignedHollonId,
      });
    }

    return query
      .orderBy('task.priority', 'ASC')
      .addOrderBy('task.createdAt', 'ASC')
      .getMany();
  }

  async findOne(id: string): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: ['project', 'assignedHollon', 'parentTask', 'subtasks'],
    });
    if (!task) {
      throw new NotFoundException(`Task #${id} not found`);
    }
    return task;
  }

  async findReadyTasks(projectId: string): Promise<Task[]> {
    return this.taskRepo.find({
      where: {
        projectId,
        status: In([TaskStatus.PENDING, TaskStatus.READY]),
        assignedHollonId: undefined,
      },
      order: {
        priority: 'ASC',
        createdAt: 'ASC',
      },
    });
  }

  async update(id: string, dto: UpdateTaskDto): Promise<Task> {
    const task = await this.findOne(id);
    Object.assign(task, dto);
    return this.taskRepo.save(task);
  }

  async assignToHollon(taskId: string, hollonId: string): Promise<Task> {
    const task = await this.findOne(taskId);
    task.assignedHollonId = hollonId;
    task.status = TaskStatus.IN_PROGRESS;
    task.startedAt = new Date();
    return this.taskRepo.save(task);
  }

  /**
   * Phase 3.5: Task 완료 + 자동 지식 문서화
   * SSOT 원칙: 태스크 완료 시 자동으로 조직 지식 문서 생성
   *
   * @param id Task ID
   * @param hollonId 완료한 Hollon ID (지식 문서 작성자)
   * @param result 실행 결과 (PR URL, 변경된 파일, 테스트 결과 등)
   */
  async complete(
    id: string,
    hollonId?: string,
    result?: TaskCompletionResult,
  ): Promise<Task> {
    const task = await this.findOne(id);
    task.status = TaskStatus.COMPLETED;
    task.completedAt = new Date();

    const savedTask = await this.taskRepo.save(task);

    // ✅ 자동 지식 문서화 (비동기, 에러 무시)
    this.createKnowledgeDocument(savedTask, hollonId, result).catch((error) => {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(
        `Failed to create knowledge document for task ${id}: ${errorMessage}`,
      );
    });

    return savedTask;
  }

  /**
   * Phase 3.5: 조직 지식 문서 자동 생성
   * SSOT 원칙: projectId = null → 조직 전체가 공유하는 지식
   */
  private async createKnowledgeDocument(
    task: Task,
    hollonId?: string,
    result?: TaskCompletionResult,
  ): Promise<void> {
    // 스킬이나 태그가 있는 경우에만 지식 문서화
    const hasKnowledgeValue =
      (task.requiredSkills && task.requiredSkills.length > 0) ||
      (task.tags && task.tags.length > 0);

    if (!hasKnowledgeValue) {
      this.logger.debug(
        `Task ${task.id} has no skills/tags, skipping knowledge documentation`,
      );
      return;
    }

    // 지식 문서 내용 생성
    const content = this.generateKnowledgeContent(task, result);

    // 문서 태그: requiredSkills + task.tags + task.type + 자동 추출 태그
    const smartTags = this.extractSmartTags(task);
    const tags = [
      ...(task.requiredSkills || []),
      ...(task.tags || []),
      task.type,
      ...smartTags,
    ].filter((tag, index, self) => self.indexOf(tag) === index); // 중복 제거

    const metadata = {
      taskType: task.type,
      priority: task.priority,
      completedAt: task.completedAt,
      filesChanged: result?.filesChanged || [],
      pullRequestUrl: result?.pullRequestUrl || null,
    };

    try {
      // Check if knowledge document already exists for this task
      const existingDoc =
        await this.knowledgeVersionService.findKnowledgeDocumentByTask(task.id);

      if (existingDoc) {
        // Update existing document
        this.logger.log(
          `Updating existing knowledge document ${existingDoc.id} for task ${task.id}`,
        );

        // Get previous version before updating
        const previousVersion =
          await this.knowledgeVersionService.getLatestVersion(existingDoc.id);

        // Update the document
        const updatedDoc = await this.documentService.update(existingDoc.id, {
          title: `[지식] ${task.title} - 해결 패턴`,
          content,
          tags,
          metadata,
          hollonId: hollonId ?? existingDoc.hollonId,
        });

        // Create version snapshot
        await this.knowledgeVersionService.createVersion(
          updatedDoc,
          previousVersion || undefined,
        );

        this.logger.log(
          `✅ Knowledge document updated with version tracking: ${updatedDoc.id} for task ${task.id}`,
        );
      } else {
        // Create new document
        const document = await this.documentService.create({
          title: `[지식] ${task.title} - 해결 패턴`,
          content,
          type: DocumentType.KNOWLEDGE,
          organizationId: task.organizationId,
          projectId: null, // 🔑 조직 레벨 지식 (모든 홀론이 접근 가능)
          hollonId: hollonId ?? null,
          taskId: task.id,
          tags,
          metadata,
        });

        // Create initial version
        await this.knowledgeVersionService.createVersion(document);

        this.logger.log(
          `✅ Knowledge document created with version tracking: ${document.id} for task ${task.id}`,
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Failed to save knowledge document: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * Phase 3.5: 자동 태그 추출 개선
   *
   * Task 제목/설명에서 기술 키워드를 자동으로 추출하여 태그 생성
   */
  private extractSmartTags(task: Task): string[] {
    const text = `${task.title} ${task.description || ''}`.toLowerCase();

    // 기술 스택 키워드
    const techKeywords = [
      'react',
      'vue',
      'angular',
      'typescript',
      'javascript',
      'nodejs',
      'nestjs',
      'postgresql',
      'mongodb',
      'redis',
      'docker',
      'kubernetes',
      'aws',
      'gcp',
      'azure',
      'api',
      'rest',
      'graphql',
      'grpc',
      'auth',
      'security',
      'performance',
      'optimization',
      'refactoring',
      'testing',
      'e2e',
      'unit',
      'integration',
      'ci/cd',
      'git',
      'frontend',
      'backend',
      'fullstack',
      'database',
      'migration',
    ];

    // 작업 유형 키워드
    const actionKeywords = [
      'bug',
      'fix',
      'feature',
      'enhancement',
      'refactor',
      'docs',
      'test',
      'deploy',
      'config',
      'setup',
      'upgrade',
      'migration',
    ];

    const foundTags: string[] = [];

    // 기술 키워드 추출
    for (const keyword of techKeywords) {
      if (text.includes(keyword)) {
        foundTags.push(keyword);
      }
    }

    // 작업 유형 추출
    for (const keyword of actionKeywords) {
      if (text.includes(keyword)) {
        foundTags.push(keyword);
      }
    }

    return foundTags;
  }

  /**
   * 지식 문서 내용 생성
   */
  private generateKnowledgeContent(
    task: Task,
    result?: TaskCompletionResult,
  ): string {
    const sections: string[] = [];

    // 1. 태스크 개요
    sections.push(`# ${task.title}\n`);
    sections.push(`**Type**: ${task.type}`);
    sections.push(`**Priority**: ${task.priority}`);
    sections.push('');

    // 2. 요구 스킬
    if (task.requiredSkills && task.requiredSkills.length > 0) {
      sections.push('## Required Skills');
      sections.push(task.requiredSkills.map((s) => `- ${s}`).join('\n'));
      sections.push('');
    }

    // 3. 태스크 설명
    if (task.description) {
      sections.push('## Description');
      sections.push(task.description);
      sections.push('');
    }

    // 4. 실행 결과
    if (result) {
      sections.push('## Execution Result');

      if (result.output) {
        sections.push('### Output');
        sections.push('```');
        sections.push(result.output);
        sections.push('```');
        sections.push('');
      }

      if (result.filesChanged && result.filesChanged.length > 0) {
        sections.push('### Files Changed');
        sections.push(result.filesChanged.map((f) => `- ${f}`).join('\n'));
        sections.push('');
      }

      if (result.pullRequestUrl) {
        sections.push(`### Pull Request`);
        sections.push(`[View PR](${result.pullRequestUrl})`);
        sections.push('');
      }

      if (result.testsPassed !== undefined) {
        sections.push(
          `### Tests: ${result.testsPassed ? '✅ Passed' : '❌ Failed'}`,
        );
        sections.push('');
      }

      if (result.reviewComments && result.reviewComments.length > 0) {
        sections.push('### Review Comments');
        sections.push(result.reviewComments.map((c) => `- ${c}`).join('\n'));
        sections.push('');
      }
    }

    // 5. 의존성 정보
    if (task.dependencies && task.dependencies.length > 0) {
      sections.push('## Dependencies');
      sections.push(
        task.dependencies.map((d) => `- ${d.title} (${d.id})`).join('\n'),
      );
      sections.push('');
    }

    // 6. 태그
    if (task.tags && task.tags.length > 0) {
      sections.push('## Tags');
      sections.push(task.tags.map((t) => `#${t}`).join(' '));
      sections.push('');
    }

    // 7. 메타데이터
    sections.push('---');
    sections.push(
      `*Generated: ${new Date().toISOString()} | Task ID: ${task.id}*`,
    );

    return sections.join('\n');
  }

  async fail(id: string, errorMessage: string): Promise<Task> {
    const task = await this.findOne(id);
    task.status = TaskStatus.FAILED;
    task.errorMessage = errorMessage;
    task.retryCount += 1;
    return this.taskRepo.save(task);
  }

  async remove(id: string): Promise<void> {
    const task = await this.findOne(id);
    await this.taskRepo.remove(task);
  }

  // ============================================
  // 의존성 관리 메서드
  // ============================================

  /**
   * 태스크에 의존성 추가
   * taskId가 dependsOnId 완료를 기다림
   */
  async addDependency(taskId: string, dependsOnId: string): Promise<Task> {
    if (taskId === dependsOnId) {
      throw new BadRequestException('Task cannot depend on itself');
    }

    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['dependencies'],
    });
    if (!task) {
      throw new NotFoundException(`Task #${taskId} not found`);
    }

    const dependsOn = await this.taskRepo.findOne({
      where: { id: dependsOnId },
    });
    if (!dependsOn) {
      throw new NotFoundException(`Dependency task #${dependsOnId} not found`);
    }

    // 순환 의존성 체크
    if (await this.wouldCreateCycle(taskId, dependsOnId)) {
      throw new BadRequestException(
        'Adding this dependency would create a cycle',
      );
    }

    // 이미 의존성이 있는지 확인
    if (!task.dependencies) {
      task.dependencies = [];
    }
    if (!task.dependencies.find((d) => d.id === dependsOnId)) {
      task.dependencies.push(dependsOn);
      await this.taskRepo.save(task);
    }

    return this.findOne(taskId);
  }

  /**
   * 태스크에서 의존성 제거
   */
  async removeDependency(taskId: string, dependsOnId: string): Promise<Task> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['dependencies'],
    });
    if (!task) {
      throw new NotFoundException(`Task #${taskId} not found`);
    }

    task.dependencies =
      task.dependencies?.filter((d) => d.id !== dependsOnId) || [];
    await this.taskRepo.save(task);

    return this.findOne(taskId);
  }

  /**
   * 순환 의존성 감지
   */
  private async wouldCreateCycle(
    taskId: string,
    dependsOnId: string,
  ): Promise<boolean> {
    const visited = new Set<string>();
    const stack: string[] = [dependsOnId];

    while (stack.length > 0) {
      const currentId = stack.pop()!;
      if (currentId === taskId) {
        return true; // 순환 발견
      }
      if (visited.has(currentId)) {
        continue;
      }
      visited.add(currentId);

      const current = await this.taskRepo.findOne({
        where: { id: currentId },
        relations: ['dependencies'],
      });
      if (current?.dependencies) {
        for (const dep of current.dependencies) {
          stack.push(dep.id);
        }
      }
    }

    return false;
  }

  /**
   * 태스크의 의존성 목록 조회
   */
  async getDependencies(taskId: string): Promise<Task[]> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['dependencies'],
    });
    if (!task) {
      throw new NotFoundException(`Task #${taskId} not found`);
    }
    return task.dependencies || [];
  }

  /**
   * 이 태스크를 기다리는 태스크들 조회
   */
  async getDependentTasks(taskId: string): Promise<Task[]> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['dependentTasks'],
    });
    if (!task) {
      throw new NotFoundException(`Task #${taskId} not found`);
    }
    return task.dependentTasks || [];
  }

  // ============================================
  // 병렬 실행 분석 메서드
  // ============================================

  /**
   * 병렬로 실행 가능한 태스크 그룹 분석
   * 의존성 + affectedFiles 충돌을 고려
   */
  async analyzeParallelExecutionGroups(projectId: string): Promise<{
    parallelGroups: Task[][];
    blockedTasks: { task: Task; blockedBy: string[] }[];
    conflictingTasks: { tasks: Task[]; files: string[] }[];
  }> {
    const readyTasks = await this.taskRepo.find({
      where: { projectId, status: In([TaskStatus.READY, TaskStatus.PENDING]) },
      relations: ['dependencies'],
    });

    const completedTaskIds = new Set(
      (
        await this.taskRepo.find({
          where: { projectId, status: TaskStatus.COMPLETED },
          select: ['id'],
        })
      ).map((t) => t.id),
    );

    // 1. 의존성이 모두 완료된 태스크 찾기
    const executableTasks: Task[] = [];
    const blockedTasks: { task: Task; blockedBy: string[] }[] = [];

    for (const task of readyTasks) {
      const uncompletedDeps = (task.dependencies || [])
        .filter((dep) => !completedTaskIds.has(dep.id))
        .map((dep) => dep.title);

      if (uncompletedDeps.length === 0) {
        executableTasks.push(task);
      } else {
        blockedTasks.push({ task, blockedBy: uncompletedDeps });
      }
    }

    // 2. affectedFiles 충돌 감지
    const conflictingTasks: { tasks: Task[]; files: string[] }[] = [];
    const fileToTasks = new Map<string, Task[]>();

    for (const task of executableTasks) {
      for (const file of task.affectedFiles || []) {
        if (!fileToTasks.has(file)) {
          fileToTasks.set(file, []);
        }
        fileToTasks.get(file)!.push(task);
      }
    }

    // 충돌 그룹 찾기
    const conflictGroups = new Map<
      string,
      { tasks: Set<Task>; files: Set<string> }
    >();
    for (const [file, tasks] of fileToTasks.entries()) {
      if (tasks.length > 1) {
        // 이 파일을 공유하는 태스크들은 충돌
        const key = tasks
          .map((t) => t.id)
          .sort()
          .join(',');
        if (!conflictGroups.has(key)) {
          conflictGroups.set(key, { tasks: new Set(tasks), files: new Set() });
        }
        conflictGroups.get(key)!.files.add(file);
      }
    }

    for (const group of conflictGroups.values()) {
      conflictingTasks.push({
        tasks: Array.from(group.tasks),
        files: Array.from(group.files),
      });
    }

    // 3. 병렬 실행 그룹 생성 (충돌하지 않는 태스크들)
    const parallelGroups = this.groupNonConflictingTasks(executableTasks);

    return { parallelGroups, blockedTasks, conflictingTasks };
  }

  /**
   * 충돌하지 않는 태스크들을 그룹으로 묶기
   */
  private groupNonConflictingTasks(tasks: Task[]): Task[][] {
    if (tasks.length === 0) return [];

    const groups: Task[][] = [];
    const assigned = new Set<string>();

    // 우선순위별로 정렬
    const sortedTasks = [...tasks].sort((a, b) => {
      const priorityOrder = { P1: 0, P2: 1, P3: 2, P4: 3 };
      return (
        (priorityOrder[a.priority] || 2) - (priorityOrder[b.priority] || 2)
      );
    });

    for (const task of sortedTasks) {
      if (assigned.has(task.id)) continue;

      const currentGroup: Task[] = [task];
      const usedFiles = new Set(task.affectedFiles || []);
      assigned.add(task.id);

      // 이 태스크와 충돌하지 않는 다른 태스크 찾기
      for (const other of sortedTasks) {
        if (assigned.has(other.id)) continue;

        const otherFiles = other.affectedFiles || [];
        const hasConflict = otherFiles.some((f) => usedFiles.has(f));

        if (!hasConflict) {
          currentGroup.push(other);
          otherFiles.forEach((f) => usedFiles.add(f));
          assigned.add(other.id);
        }
      }

      groups.push(currentGroup);
    }

    return groups;
  }

  /**
   * 특정 태스크가 실행 가능한지 확인
   */
  async canExecute(taskId: string): Promise<{
    canExecute: boolean;
    reason?: string;
    blockedBy?: Task[];
  }> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
      relations: ['dependencies'],
    });

    if (!task) {
      throw new NotFoundException(`Task #${taskId} not found`);
    }

    if (
      task.status !== TaskStatus.READY &&
      task.status !== TaskStatus.PENDING
    ) {
      return {
        canExecute: false,
        reason: `Task is in ${task.status} status`,
      };
    }

    // 의존성 체크
    const uncompletedDeps = (task.dependencies || []).filter(
      (dep) => dep.status !== TaskStatus.COMPLETED,
    );

    if (uncompletedDeps.length > 0) {
      return {
        canExecute: false,
        reason: 'Has uncompleted dependencies',
        blockedBy: uncompletedDeps,
      };
    }

    return { canExecute: true };
  }
}
