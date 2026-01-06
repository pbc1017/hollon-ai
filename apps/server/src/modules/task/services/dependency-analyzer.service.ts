import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Task } from '../entities/task.entity';
import {
  DependencyAnalysisResult,
  DependencyGraph,
  TaskNode,
  ExecutionPhase,
  CriticalPath,
} from '../interfaces/dependency-analysis.interface';

@Injectable()
export class DependencyAnalyzerService {
  private readonly logger = new Logger(DependencyAnalyzerService.name);

  constructor(
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
  ) {}

  /**
   * 프로젝트의 모든 Task에 대한 의존성 분석
   */
  async analyzeProject(projectId: string): Promise<DependencyAnalysisResult> {
    this.logger.log(`Analyzing dependencies for project ${projectId}`);

    // 1. 프로젝트의 모든 Task 조회
    const tasks = await this.taskRepo.find({
      where: { projectId },
      order: { createdAt: 'ASC' },
    });

    if (tasks.length === 0) {
      return this.createEmptyAnalysis();
    }

    // 2. 의존성 그래프 구축
    const graph = this.buildDependencyGraph(tasks);

    // 3. 사이클 감지
    const cycles = this.detectCycles(graph);
    if (cycles.length > 0) {
      this.logger.warn(
        `Detected ${cycles.length} dependency cycles in project ${projectId}`,
      );
      graph.hasCycles = true;
      graph.cycles = cycles;
    }

    // 4. 위상 정렬 (Topological Sort)
    const executionOrder = graph.hasCycles
      ? tasks // 사이클이 있으면 원본 순서 유지
      : this.topologicalSort(graph, tasks);

    // 5. 실행 단계 그룹화
    const executionPhases = this.groupIntoPhases(graph, executionOrder);

    // 6. 크리티컬 패스 계산
    const criticalPath = this.calculateCriticalPath(graph, tasks);

    // 7. 병렬화 점수 계산
    const parallelizationScore = this.calculateParallelizationScore(
      executionPhases,
      tasks.length,
    );

    // 8. 경고 생성
    const warnings = this.generateWarnings(graph, criticalPath);

    this.logger.log(
      `Dependency analysis completed: ${tasks.length} tasks, ` +
        `${executionPhases.length} phases, ` +
        `parallelization: ${parallelizationScore.toFixed(1)}%`,
    );

    return {
      graph,
      executionOrder,
      executionPhases,
      criticalPath,
      parallelizationScore,
      warnings,
    };
  }

  /**
   * 단일 Task의 의존성 분석
   */
  async analyzeTask(taskId: string): Promise<{
    task: Task;
    directDependencies: Task[];
    allDependencies: Task[];
    directDependents: Task[];
    allDependents: Task[];
  }> {
    const task = await this.taskRepo.findOne({
      where: { id: taskId },
    });

    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const allTasks = await this.taskRepo.find({
      where: { projectId: task.projectId },
    });

    const graph = this.buildDependencyGraph(allTasks);
    const node = graph.nodes.get(taskId);

    if (!node) {
      return {
        task,
        directDependencies: [],
        allDependencies: [],
        directDependents: [],
        allDependents: [],
      };
    }

    const directDependencies = allTasks.filter((t) =>
      node.dependencies.includes(t.id),
    );
    const allDependencies = this.getAllDependencies(graph, taskId, allTasks);
    const directDependents = allTasks.filter((t) =>
      node.dependents.includes(t.id),
    );
    const allDependents = this.getAllDependents(graph, taskId, allTasks);

    return {
      task,
      directDependencies,
      allDependencies,
      directDependents,
      allDependents,
    };
  }

  /**
   * 의존성 그래프 구축
   */
  private buildDependencyGraph(tasks: Task[]): DependencyGraph {
    const nodes = new Map<string, TaskNode>();
    const edges: Array<{ from: string; to: string }> = [];

    // 1. 노드 초기화
    for (const task of tasks) {
      nodes.set(task.id, {
        task,
        dependencies: [],
        dependents: [],
        depth: 0,
      });
    }

    // 2. 의존성 파싱 (description에서 추출)
    for (const task of tasks) {
      const dependencies = this.extractDependencies(task);
      const node = nodes.get(task.id)!;

      for (const depIdentifier of dependencies) {
        // Task title 또는 ID로 찾기
        const depTask = this.findTaskByIdentifier(tasks, depIdentifier);
        if (depTask) {
          node.dependencies.push(depTask.id);
          edges.push({ from: depTask.id, to: task.id });

          // 역방향 참조 (dependents)
          const depNode = nodes.get(depTask.id);
          if (depNode) {
            depNode.dependents.push(task.id);
          }
        } else {
          this.logger.warn(
            `Task ${task.id} references unknown dependency: "${depIdentifier}"`,
          );
        }
      }
    }

    // 3. Depth 계산
    this.calculateDepths(nodes);

    return {
      nodes,
      edges,
      hasCycles: false,
      cycles: [],
    };
  }

  /**
   * Phase 3.5: Task title 또는 ID로 Task 찾기
   */
  private findTaskByIdentifier(tasks: Task[], identifier: string): Task | null {
    // 1. ID로 직접 찾기
    let task = tasks.find((t) => t.id === identifier);
    if (task) return task;

    // 2. Title로 정확히 일치하는 것 찾기 (대소문자 무시)
    task = tasks.find(
      (t) => t.title.toLowerCase() === identifier.toLowerCase(),
    );
    if (task) return task;

    // 3. Title 부분 일치 찾기 (마지막 수단)
    task = tasks.find((t) =>
      t.title.toLowerCase().includes(identifier.toLowerCase()),
    );
    if (task) return task;

    return null;
  }

  /**
   * Phase 3.5: Task description에서 의존성 추출 (다양한 형식 지원)
   *
   * 지원 형식:
   * 1. **Dependencies:** 섹션 (마크다운)
   * 2. "depends on [Task Title]" (자연어)
   * 3. "blocked by [Task Title]" (자연어)
   * 4. "requires [Task Title]" (자연어)
   * 5. 태그 기반: #depends:task-id
   */
  private extractDependencies(task: Task): string[] {
    if (!task.description) return [];

    const dependencies = new Set<string>();
    const description = task.description;

    // 1. **Dependencies:** 섹션 파싱 (마크다운)
    const depSectionMatch = description.match(
      /\*\*Dependencies:\*\*\s*\n((?:[-*]\s*.+\n?)+)/i,
    );
    if (depSectionMatch) {
      const lines = depSectionMatch[1].split('\n');
      for (const line of lines) {
        const cleanLine = line.replace(/^[-*]\s*/, '').trim();
        if (cleanLine.length > 0) {
          dependencies.add(cleanLine);
        }
      }
    }

    // 2. 자연어 패턴: "depends on [Task Title]"
    const dependsOnPattern = /depends\s+on\s+["`']?([^"`'\n.]+)["`']?/gi;
    let match;
    while ((match = dependsOnPattern.exec(description)) !== null) {
      const taskTitle = match[1].trim();
      if (taskTitle) {
        dependencies.add(taskTitle);
      }
    }

    // 3. 자연어 패턴: "blocked by [Task Title]"
    const blockedByPattern = /blocked\s+by\s+["`']?([^"`'\n.]+)["`']?/gi;
    while ((match = blockedByPattern.exec(description)) !== null) {
      const taskTitle = match[1].trim();
      if (taskTitle) {
        dependencies.add(taskTitle);
      }
    }

    // 4. 자연어 패턴: "requires [Task Title]"
    const requiresPattern = /requires\s+["`']?([^"`'\n.]+)["`']?/gi;
    while ((match = requiresPattern.exec(description)) !== null) {
      const taskTitle = match[1].trim();
      // "requires" 다음에 스킬이 아닌 Task title인지 확인
      // (스킬은 보통 소문자이고 짧음)
      if (taskTitle.length > 5 && /[A-Z]/.test(taskTitle[0])) {
        dependencies.add(taskTitle);
      }
    }

    // 5. Task ID 패턴: #task-xxx, task:xxx
    const taskIdPattern = /#?task[-:]([a-f0-9-]+)/gi;
    while ((match = taskIdPattern.exec(description)) !== null) {
      const taskId = match[1];
      if (taskId) {
        dependencies.add(taskId);
      }
    }

    this.logger.debug(
      `Extracted ${dependencies.size} dependencies from task ${task.id}: ${Array.from(dependencies).join(', ')}`,
    );

    return Array.from(dependencies);
  }

  /**
   * Depth 계산 (루트부터의 거리)
   */
  private calculateDepths(nodes: Map<string, TaskNode>): void {
    const visited = new Set<string>();

    const dfs = (nodeId: string, depth: number) => {
      if (visited.has(nodeId)) return;
      visited.add(nodeId);

      const node = nodes.get(nodeId);
      if (!node) return;

      node.depth = Math.max(node.depth, depth);

      for (const depId of node.dependents) {
        dfs(depId, depth + 1);
      }
    };

    // 루트 노드 (의존성이 없는 노드)부터 시작
    for (const [nodeId, node] of nodes) {
      if (node.dependencies.length === 0) {
        dfs(nodeId, 0);
      }
    }
  }

  /**
   * 사이클 감지 (DFS)
   */
  private detectCycles(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const currentPath: string[] = [];

    const dfs = (nodeId: string) => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      currentPath.push(nodeId);

      const node = graph.nodes.get(nodeId);
      if (node) {
        for (const depId of node.dependencies) {
          if (!visited.has(depId)) {
            dfs(depId);
          } else if (recursionStack.has(depId)) {
            // 사이클 발견
            const cycleStart = currentPath.indexOf(depId);
            cycles.push(currentPath.slice(cycleStart));
          }
        }
      }

      currentPath.pop();
      recursionStack.delete(nodeId);
    };

    for (const nodeId of graph.nodes.keys()) {
      if (!visited.has(nodeId)) {
        dfs(nodeId);
      }
    }

    return cycles;
  }

  /**
   * 위상 정렬 (Kahn's Algorithm)
   */
  private topologicalSort(graph: DependencyGraph, _tasks: Task[]): Task[] {
    const inDegree = new Map<string, number>();
    const result: Task[] = [];
    const queue: string[] = [];

    // 1. In-degree 계산
    for (const [nodeId, node] of graph.nodes) {
      inDegree.set(nodeId, node.dependencies.length);
      if (node.dependencies.length === 0) {
        queue.push(nodeId);
      }
    }

    // 2. BFS
    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      const node = graph.nodes.get(nodeId);
      if (!node) continue;

      result.push(node.task);

      // Dependents의 in-degree 감소
      for (const depId of node.dependents) {
        const currentDegree = inDegree.get(depId) || 0;
        inDegree.set(depId, currentDegree - 1);

        if (currentDegree - 1 === 0) {
          queue.push(depId);
        }
      }
    }

    return result;
  }

  /**
   * 실행 단계로 그룹화 (같은 depth의 Task는 병렬 실행 가능)
   */
  private groupIntoPhases(
    graph: DependencyGraph,
    _executionOrder: Task[],
  ): ExecutionPhase[] {
    const phaseMap = new Map<number, Task[]>();

    // Depth별로 그룹화
    for (const node of graph.nodes.values()) {
      const depth = node.depth;
      if (!phaseMap.has(depth)) {
        phaseMap.set(depth, []);
      }
      phaseMap.get(depth)!.push(node.task);
    }

    // ExecutionPhase 배열로 변환
    const phases: ExecutionPhase[] = [];
    const sortedDepths = Array.from(phaseMap.keys()).sort((a, b) => a - b);

    for (const depth of sortedDepths) {
      const tasks = phaseMap.get(depth)!;
      phases.push({
        phase: depth,
        tasks,
        canRunInParallel: tasks.length > 1,
        estimatedDuration: 0, // TODO: Add estimatedHours to Task entity
      });
    }

    return phases;
  }

  /**
   * 크리티컬 패스 계산 (가장 긴 경로)
   */
  private calculateCriticalPath(
    graph: DependencyGraph,
    tasks: Task[],
  ): CriticalPath {
    let longestPath: Task[] = [];
    let maxDuration = 0;

    // 각 루트 노드부터 DFS로 가장 긴 경로 찾기
    for (const [nodeId, node] of graph.nodes) {
      if (node.dependencies.length === 0) {
        const path = this.findLongestPath(graph, nodeId);
        const duration = path.length; // TODO: Use estimatedHours when available

        if (duration > maxDuration) {
          maxDuration = duration;
          longestPath = path;
        }
      }
    }

    // 병목 지점 찾기 (가장 많은 dependents를 가진 Task)
    const bottlenecks = tasks
      .filter((t) => {
        const node = graph.nodes.get(t.id);
        return node && node.dependents.length >= 3;
      })
      .sort((a, b) => {
        const nodeA = graph.nodes.get(a.id)!;
        const nodeB = graph.nodes.get(b.id)!;
        return nodeB.dependents.length - nodeA.dependents.length;
      })
      .slice(0, 3);

    return {
      tasks: longestPath,
      totalDuration: maxDuration,
      bottlenecks,
    };
  }

  /**
   * 가장 긴 경로 찾기 (DFS)
   */
  private findLongestPath(graph: DependencyGraph, startId: string): Task[] {
    const node = graph.nodes.get(startId);
    if (!node) return [];

    if (node.dependents.length === 0) {
      return [node.task];
    }

    let longestSubPath: Task[] = [];
    let maxDuration = 0;

    for (const depId of node.dependents) {
      const subPath = this.findLongestPath(graph, depId);
      const duration = subPath.length; // TODO: Use estimatedHours when available

      if (duration > maxDuration) {
        maxDuration = duration;
        longestSubPath = subPath;
      }
    }

    return [node.task, ...longestSubPath];
  }

  /**
   * 병렬화 점수 계산
   */
  private calculateParallelizationScore(
    phases: ExecutionPhase[],
    totalTasks: number,
  ): number {
    if (totalTasks === 0) return 0;

    const parallelTasks = phases
      .filter((p) => p.canRunInParallel)
      .reduce((sum, p) => sum + p.tasks.length, 0);

    return (parallelTasks / totalTasks) * 100;
  }

  /**
   * 모든 의존성 가져오기 (재귀)
   */
  private getAllDependencies(
    graph: DependencyGraph,
    taskId: string,
    allTasks: Task[],
  ): Task[] {
    const visited = new Set<string>();
    const result: Task[] = [];

    const dfs = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = graph.nodes.get(id);
      if (!node) return;

      for (const depId of node.dependencies) {
        const task = allTasks.find((t) => t.id === depId);
        if (task) {
          result.push(task);
          dfs(depId);
        }
      }
    };

    dfs(taskId);
    return result;
  }

  /**
   * 모든 의존자 가져오기 (재귀)
   */
  private getAllDependents(
    graph: DependencyGraph,
    taskId: string,
    allTasks: Task[],
  ): Task[] {
    const visited = new Set<string>();
    const result: Task[] = [];

    const dfs = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);

      const node = graph.nodes.get(id);
      if (!node) return;

      for (const depId of node.dependents) {
        const task = allTasks.find((t) => t.id === depId);
        if (task) {
          result.push(task);
          dfs(depId);
        }
      }
    };

    dfs(taskId);
    return result;
  }

  /**
   * 경고 생성
   */
  private generateWarnings(
    graph: DependencyGraph,
    criticalPath: CriticalPath,
  ): string[] {
    const warnings: string[] = [];

    if (graph.hasCycles) {
      warnings.push(
        `Circular dependencies detected. Please resolve before execution.`,
      );
    }

    if (criticalPath.bottlenecks.length > 0) {
      warnings.push(
        `${criticalPath.bottlenecks.length} bottleneck tasks detected that block multiple downstream tasks.`,
      );
    }

    if (criticalPath.totalDuration > 160) {
      // ~1 month
      warnings.push(
        `Critical path is very long (${criticalPath.totalDuration}h). Consider breaking down tasks or increasing parallelism.`,
      );
    }

    return warnings;
  }

  /**
   * 빈 분석 결과 생성
   */
  private createEmptyAnalysis(): DependencyAnalysisResult {
    return {
      graph: {
        nodes: new Map(),
        edges: [],
        hasCycles: false,
        cycles: [],
      },
      executionOrder: [],
      executionPhases: [],
      criticalPath: {
        tasks: [],
        totalDuration: 0,
        bottlenecks: [],
      },
      parallelizationScore: 0,
      warnings: ['No tasks found in project'],
    };
  }
}
