import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MeetingRecord, MeetingType } from '../entities/meeting-record.entity';
import { Cycle, CycleStatus } from '../../project/entities/cycle.entity';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { format, subWeeks } from 'date-fns';

interface LastSprintAnalysis {
  cycleId: string;
  cycleName: string;
  totalTasks: number;
  completedTasks: number;
  completionRate: number;
  velocity: number; // story points per week
  avgLeadTime: number; // hours
}

interface TaskAssignment {
  taskId: string;
  taskTitle: string;
  hollonId: string;
  hollonName: string;
  estimatedPoints: number;
  priority: string;
}

@Injectable()
export class SprintPlanningService {
  private readonly logger = new Logger(SprintPlanningService.name);

  constructor(
    @InjectRepository(MeetingRecord)
    private readonly meetingRepo: Repository<MeetingRecord>,
    @InjectRepository(Cycle)
    private readonly cycleRepo: Repository<Cycle>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
  ) {}

  /**
   * Run sprint planning every Monday at 10:00 AM
   */
  @Cron('0 10 * * 1')
  async runSprintPlanning(): Promise<void> {
    this.logger.log('Running sprint planning...');

    try {
      const activeCycles = await this.cycleRepo.find({
        where: { status: CycleStatus.ACTIVE },
        relations: ['project', 'project.organization'],
      });

      for (const cycle of activeCycles) {
        await this.runPlanningForCycle(cycle);
      }

      this.logger.log('Sprint planning completed');
    } catch (error) {
      this.logger.error('Failed to run sprint planning', error);
    }
  }

  /**
   * Run sprint planning for a specific cycle
   */
  async runPlanningForCycle(cycle: Cycle): Promise<MeetingRecord | null> {
    this.logger.log(
      `Running sprint planning for cycle: ${cycle.name || `Cycle ${cycle.number}`}`,
    );

    // Analyze last sprint
    const lastSprintAnalysis = await this.analyzeLastSprint(cycle);

    // Select tasks from backlog based on velocity
    const selectedTasks = await this.selectTasksForSprint(
      cycle,
      lastSprintAnalysis.velocity,
    );

    if (selectedTasks.length === 0) {
      this.logger.warn(
        `No tasks selected for cycle: ${cycle.name || `Cycle ${cycle.number}`}`,
      );
      return null;
    }

    // Propose task assignments
    const assignments = await this.proposeAssignments(
      selectedTasks,
      cycle.projectId,
    );

    // Generate planning document
    const planningDoc = this.formatPlanningDocument(
      cycle,
      lastSprintAnalysis,
      selectedTasks,
      assignments,
    );

    // Save meeting record
    const meeting = await this.meetingRepo.save({
      organizationId: cycle.project.organizationId,
      teamId: null,
      meetingType: MeetingType.SPRINT_PLANNING,
      title: `Sprint Planning - ${cycle.name || `Cycle ${cycle.number}`} - ${format(new Date(), 'yyyy-MM-dd')}`,
      content: planningDoc,
      metadata: { lastSprintAnalysis, selectedTasks, assignments },
      completedAt: new Date(),
    });

    this.logger.log(
      `Sprint planning completed for cycle: ${cycle.name || `Cycle ${cycle.number}`}`,
    );
    return meeting;
  }

  /**
   * Analyze last sprint to calculate velocity
   */
  private async analyzeLastSprint(cycle: Cycle): Promise<LastSprintAnalysis> {
    const oneWeekAgo = subWeeks(new Date(), 1);

    // Get tasks completed in the last week for this cycle
    const completedTasks = await this.taskRepo
      .createQueryBuilder('task')
      .where('task.cycleId = :cycleId', { cycleId: cycle.id })
      .andWhere('task.status = :status', { status: TaskStatus.COMPLETED })
      .andWhere('task.completedAt >= :since', { since: oneWeekAgo })
      .getMany();

    // Get all tasks in cycle
    const allTasks = await this.taskRepo.count({
      where: { cycleId: cycle.id },
    });

    const totalPoints = completedTasks.reduce((sum, task) => {
      return sum + ((task as any).storyPoints || 1);
    }, 0);

    // Calculate average lead time
    const leadTimes = completedTasks
      .filter((t) => t.startedAt && t.completedAt)
      .map((t) => {
        const startTime = new Date(t.startedAt!).getTime();
        const endTime = new Date(t.completedAt!).getTime();
        return (endTime - startTime) / (1000 * 60 * 60); // hours
      });

    const avgLeadTime =
      leadTimes.length > 0
        ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length
        : 0;

    const completionRate = allTasks > 0 ? completedTasks.length / allTasks : 0;

    return {
      cycleId: cycle.id,
      cycleName: cycle.name || `Cycle ${cycle.number}`,
      totalTasks: allTasks,
      completedTasks: completedTasks.length,
      completionRate,
      velocity: totalPoints,
      avgLeadTime,
    };
  }

  /**
   * Select tasks from backlog based on velocity
   */
  private async selectTasksForSprint(
    cycle: Cycle,
    velocity: number,
  ): Promise<Task[]> {
    // Get backlog tasks for this cycle's project (ready status, ordered by priority)
    const backlogTasks = await this.taskRepo.find({
      where: { projectId: cycle.projectId, status: TaskStatus.READY },
      order: { priority: 'DESC', createdAt: 'ASC' },
      take: 20,
    });

    // Select tasks up to velocity capacity
    const selectedTasks: Task[] = [];
    let totalPoints = 0;
    const targetPoints = Math.max(velocity, 5); // minimum 5 points

    for (const task of backlogTasks) {
      const taskPoints = (task as any).storyPoints || 1;

      if (totalPoints + taskPoints <= targetPoints) {
        selectedTasks.push(task);
        totalPoints += taskPoints;
      }

      if (totalPoints >= targetPoints) {
        break;
      }
    }

    return selectedTasks;
  }

  /**
   * Propose task assignments to available hollons
   */
  private async proposeAssignments(
    tasks: Task[],
    projectId: string,
  ): Promise<TaskAssignment[]> {
    // Get available hollons for the project
    const hollons = await this.hollonRepo
      .createQueryBuilder('hollon')
      .innerJoin('hollon.team', 'team')
      .innerJoin('team.projects', 'project')
      .where('project.id = :projectId', { projectId })
      .andWhere('hollon.status = :status', { status: 'idle' })
      .getMany();

    if (hollons.length === 0) {
      return [];
    }

    // Simple round-robin assignment
    const assignments: TaskAssignment[] = [];
    let hollonIndex = 0;

    for (const task of tasks) {
      const hollon = hollons[hollonIndex % hollons.length];

      assignments.push({
        taskId: task.id,
        taskTitle: task.title,
        hollonId: hollon.id,
        hollonName: hollon.name,
        estimatedPoints: (task as any).storyPoints || 1,
        priority: task.priority,
      });

      hollonIndex++;
    }

    return assignments;
  }

  /**
   * Format planning document
   */
  private formatPlanningDocument(
    cycle: Cycle,
    analysis: LastSprintAnalysis,
    selectedTasks: Task[],
    assignments: TaskAssignment[],
  ): string {
    const lines: string[] = [];

    lines.push(`# Sprint Planning - ${cycle.name || `Cycle ${cycle.number}`}`);
    lines.push(`Date: ${format(new Date(), 'yyyy-MM-dd')}`);
    lines.push('');

    lines.push('## Last Sprint Analysis');
    lines.push(`- Total Tasks: ${analysis.totalTasks}`);
    lines.push(`- Completed: ${analysis.completedTasks}`);
    lines.push(
      `- Completion Rate: ${(analysis.completionRate * 100).toFixed(1)}%`,
    );
    lines.push(`- Velocity: ${analysis.velocity} story points`);
    lines.push(`- Average Lead Time: ${analysis.avgLeadTime.toFixed(1)} hours`);
    lines.push('');

    lines.push('## Selected Tasks for This Sprint');
    if (selectedTasks.length === 0) {
      lines.push('- No tasks selected');
    } else {
      const totalPoints = selectedTasks.reduce(
        (sum, t) => sum + ((t as any).storyPoints || 1),
        0,
      );
      lines.push(`- Total: ${selectedTasks.length} tasks`);
      lines.push(`- Total Story Points: ${totalPoints}`);
      lines.push('');

      selectedTasks.forEach((task, idx) => {
        lines.push(
          `${idx + 1}. **${task.title}** (Priority: ${task.priority}, Points: ${(task as any).storyPoints || 1})`,
        );
        if (task.description) {
          lines.push(`   ${task.description.substring(0, 100)}...`);
        }
      });
    }
    lines.push('');

    lines.push('## Proposed Task Assignments');
    if (assignments.length === 0) {
      lines.push('- No assignments proposed');
    } else {
      const assignmentsByHollon = assignments.reduce(
        (acc, a) => {
          if (!acc[a.hollonName]) {
            acc[a.hollonName] = [];
          }
          acc[a.hollonName].push(a);
          return acc;
        },
        {} as Record<string, TaskAssignment[]>,
      );

      Object.entries(assignmentsByHollon).forEach(([hollonName, tasks]) => {
        lines.push(`### ${hollonName}`);
        tasks.forEach((task) => {
          lines.push(
            `- ${task.taskTitle} (${task.estimatedPoints} points, Priority: ${task.priority})`,
          );
        });
        lines.push('');
      });
    }

    return lines.join('\n');
  }
}
