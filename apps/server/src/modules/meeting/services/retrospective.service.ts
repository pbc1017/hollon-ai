import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { MeetingRecord, MeetingType } from '../entities/meeting-record.entity';
import { Cycle, CycleStatus } from '../../project/entities/cycle.entity';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import { Hollon } from '../../hollon/entities/hollon.entity';
import { format, startOfWeek, endOfWeek } from 'date-fns';

interface CycleMetrics {
  cycleId: string;
  cycleName: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  blockedTasks: number;
  completionRate: number;
  avgLeadTime: number; // hours
  totalStoryPoints: number;
  completedStoryPoints: number;
}

interface HollonFeedback {
  hollonId: string;
  hollonName: string;
  tasksCompleted: number;
  storyPointsCompleted: number;
  blockersFaced: string[];
  suggestions: string[];
}

interface Improvement {
  category: 'process' | 'technical' | 'communication' | 'tools';
  description: string;
  priority: 'high' | 'medium' | 'low';
}

@Injectable()
export class RetrospectiveService {
  private readonly logger = new Logger(RetrospectiveService.name);

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
   * Run retrospective every Friday at 16:00
   */
  @Cron('0 16 * * 5')
  async runRetrospective(): Promise<void> {
    this.logger.log('Running retrospective...');

    try {
      const completedCycles = await this.findCompletedThisWeek();

      for (const cycle of completedCycles) {
        await this.runRetrospectiveForCycle(cycle);
      }

      this.logger.log('Retrospective completed');
    } catch (error) {
      this.logger.error('Failed to run retrospective', error);
    }
  }

  /**
   * Find cycles completed this week
   */
  private async findCompletedThisWeek(): Promise<Cycle[]> {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });

    return this.cycleRepo.find({
      where: {
        status: CycleStatus.COMPLETED,
        completedAt: Between(weekStart, weekEnd) as any,
      },
      relations: ['project', 'project.organization'],
    });
  }

  /**
   * Run retrospective for a specific cycle
   */
  async runRetrospectiveForCycle(cycle: Cycle): Promise<MeetingRecord | null> {
    this.logger.log(
      `Running retrospective for cycle: ${cycle.name || `Cycle ${cycle.number}`}`,
    );

    // Collect cycle metrics
    const metrics = await this.collectCycleMetrics(cycle);

    // Collect hollon feedback
    const feedback = await this.collectHollonFeedback(cycle);

    // Analyze improvements
    const improvements = await this.analyzeImprovements(metrics, feedback);

    // Generate retrospective document
    const retroDoc = this.formatRetrospectiveDocument(
      cycle,
      metrics,
      feedback,
      improvements,
    );

    // Save meeting record
    const meeting = await this.meetingRepo.save({
      organizationId: cycle.project.organizationId,
      teamId: null,
      meetingType: MeetingType.RETROSPECTIVE,
      title: `Retrospective - ${cycle.name || `Cycle ${cycle.number}`} - ${format(new Date(), 'yyyy-MM-dd')}`,
      content: retroDoc,
      metadata: { metrics, feedback, improvements },
      completedAt: new Date(),
    });

    this.logger.log(
      `Retrospective completed for cycle: ${cycle.name || `Cycle ${cycle.number}`}`,
    );
    return meeting;
  }

  /**
   * Collect cycle metrics
   */
  private async collectCycleMetrics(cycle: Cycle): Promise<CycleMetrics> {
    const tasks = await this.taskRepo.find({
      where: { cycleId: cycle.id },
    });

    const completedTasks = tasks.filter(
      (t) => t.status === TaskStatus.COMPLETED,
    );
    const inProgressTasks = tasks.filter(
      (t) => t.status === TaskStatus.IN_PROGRESS,
    );
    const blockedTasks = tasks.filter((t) => t.status === TaskStatus.BLOCKED);

    // Calculate story points
    const totalStoryPoints = tasks.reduce(
      (sum, t) => sum + ((t as any).storyPoints || 0),
      0,
    );
    const completedStoryPoints = completedTasks.reduce(
      (sum, t) => sum + ((t as any).storyPoints || 0),
      0,
    );

    // Calculate average lead time for completed tasks
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

    const completionRate =
      tasks.length > 0 ? completedTasks.length / tasks.length : 0;

    return {
      cycleId: cycle.id,
      cycleName: cycle.name || `Cycle ${cycle.number}`,
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      inProgressTasks: inProgressTasks.length,
      blockedTasks: blockedTasks.length,
      completionRate,
      avgLeadTime,
      totalStoryPoints,
      completedStoryPoints,
    };
  }

  /**
   * Collect feedback from hollons
   */
  private async collectHollonFeedback(cycle: Cycle): Promise<HollonFeedback[]> {
    // Get tasks for this cycle
    const tasks = await this.taskRepo.find({
      where: { cycleId: cycle.id },
    });

    // Group by hollon
    const tasksByHollon = tasks.reduce(
      (acc, task) => {
        const hollonId = task.assignedHollonId;
        if (hollonId) {
          if (!acc[hollonId]) {
            acc[hollonId] = [];
          }
          acc[hollonId].push(task);
        }
        return acc;
      },
      {} as Record<string, Task[]>,
    );

    // Collect feedback for each hollon
    const feedbackList: HollonFeedback[] = [];

    for (const [hollonId, holonTasks] of Object.entries(tasksByHollon)) {
      const hollon = await this.hollonRepo.findOne({
        where: { id: hollonId },
      });

      if (!hollon) continue;

      const completedTasks = holonTasks.filter(
        (t) => t.status === TaskStatus.COMPLETED,
      );
      const blockedTasks = holonTasks.filter(
        (t) => t.status === TaskStatus.BLOCKED,
      );

      const storyPointsCompleted = completedTasks.reduce(
        (sum, t) => sum + ((t as any).storyPoints || 0),
        0,
      );

      feedbackList.push({
        hollonId: hollon.id,
        hollonName: hollon.name,
        tasksCompleted: completedTasks.length,
        storyPointsCompleted,
        blockersFaced: blockedTasks.map(
          (t) => (t as any).blockedReason || 'Unknown blocker',
        ),
        suggestions: [], // Could be enhanced with actual hollon feedback
      });
    }

    return feedbackList;
  }

  /**
   * Analyze improvements based on metrics and feedback
   */
  private async analyzeImprovements(
    metrics: CycleMetrics,
    feedback: HollonFeedback[],
  ): Promise<Improvement[]> {
    const improvements: Improvement[] = [];

    // Low completion rate
    if (metrics.completionRate < 0.7) {
      improvements.push({
        category: 'process',
        description: `Completion rate is ${(metrics.completionRate * 100).toFixed(1)}%. Consider reducing sprint scope or improving task estimation.`,
        priority: 'high',
      });
    }

    // High average lead time
    if (metrics.avgLeadTime > 48) {
      improvements.push({
        category: 'process',
        description: `Average lead time is ${metrics.avgLeadTime.toFixed(1)} hours. Investigate bottlenecks and improve task breakdown.`,
        priority: 'medium',
      });
    }

    // Blocked tasks
    if (metrics.blockedTasks > 0) {
      improvements.push({
        category: 'process',
        description: `${metrics.blockedTasks} task(s) are blocked. Review dependencies and improve team collaboration.`,
        priority: 'high',
      });
    }

    // In-progress tasks not completed
    if (metrics.inProgressTasks > metrics.totalTasks * 0.2) {
      improvements.push({
        category: 'process',
        description: `${metrics.inProgressTasks} task(s) still in progress. Encourage focus on completing tasks before starting new ones.`,
        priority: 'medium',
      });
    }

    // Common blockers across hollons
    const allBlockers = feedback.flatMap((f) => f.blockersFaced);
    if (allBlockers.length > 0) {
      improvements.push({
        category: 'communication',
        description: `Common blockers identified: ${allBlockers.slice(0, 3).join(', ')}. Address these systematically.`,
        priority: 'high',
      });
    }

    // If no improvements identified, add a positive note
    if (improvements.length === 0) {
      improvements.push({
        category: 'process',
        description:
          'Great work! Cycle completed successfully with good metrics.',
        priority: 'low',
      });
    }

    return improvements;
  }

  /**
   * Format retrospective document
   */
  private formatRetrospectiveDocument(
    cycle: Cycle,
    metrics: CycleMetrics,
    feedback: HollonFeedback[],
    improvements: Improvement[],
  ): string {
    const lines: string[] = [];

    lines.push(`# Retrospective - ${cycle.name || `Cycle ${cycle.number}`}`);
    lines.push(`Date: ${format(new Date(), 'yyyy-MM-dd')}`);
    lines.push('');

    lines.push('## Cycle Metrics');
    lines.push(`- Total Tasks: ${metrics.totalTasks}`);
    lines.push(`- Completed: ${metrics.completedTasks}`);
    lines.push(`- In Progress: ${metrics.inProgressTasks}`);
    lines.push(`- Blocked: ${metrics.blockedTasks}`);
    lines.push(
      `- Completion Rate: ${(metrics.completionRate * 100).toFixed(1)}%`,
    );
    lines.push(`- Average Lead Time: ${metrics.avgLeadTime.toFixed(1)} hours`);
    lines.push(
      `- Story Points: ${metrics.completedStoryPoints}/${metrics.totalStoryPoints}`,
    );
    lines.push('');

    lines.push('## Team Performance');
    if (feedback.length === 0) {
      lines.push('- No hollon feedback available');
    } else {
      feedback.forEach((f) => {
        lines.push(`### ${f.hollonName}`);
        lines.push(`- Tasks Completed: ${f.tasksCompleted}`);
        lines.push(`- Story Points: ${f.storyPointsCompleted}`);

        if (f.blockersFaced.length > 0) {
          lines.push('- Blockers:');
          f.blockersFaced.forEach((blocker) => {
            lines.push(`  - ${blocker}`);
          });
        }

        if (f.suggestions.length > 0) {
          lines.push('- Suggestions:');
          f.suggestions.forEach((suggestion) => {
            lines.push(`  - ${suggestion}`);
          });
        }

        lines.push('');
      });
    }

    lines.push('## Identified Improvements');
    if (improvements.length === 0) {
      lines.push('- No improvements identified');
    } else {
      const highPriority = improvements.filter((i) => i.priority === 'high');
      const mediumPriority = improvements.filter(
        (i) => i.priority === 'medium',
      );
      const lowPriority = improvements.filter((i) => i.priority === 'low');

      if (highPriority.length > 0) {
        lines.push('### High Priority');
        highPriority.forEach((imp) => {
          lines.push(`- [${imp.category}] ${imp.description}`);
        });
        lines.push('');
      }

      if (mediumPriority.length > 0) {
        lines.push('### Medium Priority');
        mediumPriority.forEach((imp) => {
          lines.push(`- [${imp.category}] ${imp.description}`);
        });
        lines.push('');
      }

      if (lowPriority.length > 0) {
        lines.push('### Low Priority');
        lowPriority.forEach((imp) => {
          lines.push(`- [${imp.category}] ${imp.description}`);
        });
        lines.push('');
      }
    }

    lines.push('## Action Items');
    lines.push(
      '- Review improvement suggestions and create follow-up tasks as needed',
    );
    lines.push('- Address high-priority blockers in the next sprint');
    lines.push('- Continue monitoring metrics for trend analysis');
    lines.push('');

    return lines.join('\n');
  }
}
