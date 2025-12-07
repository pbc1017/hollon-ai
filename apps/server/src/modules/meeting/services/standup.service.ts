import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import { MeetingRecord, MeetingType } from '../entities/meeting-record.entity';
import { Team } from '../../team/entities/team.entity';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';
import { Task } from '../../task/entities/task.entity';
import { StandupResponse } from '../dto/standup-response.dto';
import { ChannelService } from '../../channel/channel.service';
import { subDays, format } from 'date-fns';

@Injectable()
export class StandupService {
  private readonly logger = new Logger(StandupService.name);

  constructor(
    @InjectRepository(MeetingRecord)
    private readonly meetingRepo: Repository<MeetingRecord>,
    @InjectRepository(Team)
    private readonly teamRepo: Repository<Team>,
    @InjectRepository(Hollon)
    private readonly hollonRepo: Repository<Hollon>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    private readonly channelService: ChannelService,
  ) {}

  /**
   * Daily standup - runs every day at 9:00 AM
   */
  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async runDailyStandup(): Promise<void> {
    this.logger.log('Running daily standup...');

    try {
      const teams = await this.teamRepo.find({
        relations: ['organization'],
      });

      for (const team of teams) {
        await this.runStandupForTeam(team);
      }

      this.logger.log('Daily standup completed');
    } catch (error) {
      this.logger.error('Failed to run daily standup', error);
    }
  }

  /**
   * Run standup for a specific team
   */
  async runStandupForTeam(team: Team): Promise<MeetingRecord | null> {
    this.logger.log(`Running standup for team: ${team.name}`);

    // Get active hollons in the team
    const hollons = await this.getActiveTeamHollons(team.id);

    if (hollons.length === 0) {
      this.logger.warn(`No active hollons found for team: ${team.name}`);
      return null;
    }

    // Collect standup status from each hollon
    const responses = await Promise.all(
      hollons.map((h) => this.collectStandupStatus(h)),
    );

    // Generate summary
    const summary = this.generateStandupSummary(team, responses);

    // Save meeting record
    const meeting = await this.meetingRepo.save({
      organizationId: team.organizationId,
      teamId: team.id,
      meetingType: MeetingType.STANDUP,
      title: `Daily Standup - ${team.name} - ${format(new Date(), 'yyyy-MM-dd')}`,
      content: summary,
      metadata: { responses },
      completedAt: new Date(),
    });

    // Send to team channel
    await this.channelService.sendToTeamChannel(team.id, summary);

    this.logger.log(`Standup completed for team: ${team.name}`);
    return meeting;
  }

  /**
   * 팀의 활성 홀론 목록 조회
   * @param teamId 팀 ID
   * @returns 활성 상태(IDLE, WORKING)인 홀론 배열
   */
  private async getActiveTeamHollons(teamId: string): Promise<Hollon[]> {
    return this.hollonRepo.find({
      where: {
        teamId,
        status: In([HollonStatus.IDLE, HollonStatus.WORKING]),
      },
      relations: ['role'],
    });
  }

  /**
   * Collect standup status from a hollon
   */
  private async collectStandupStatus(hollon: Hollon): Promise<StandupResponse> {
    const yesterday = subDays(new Date(), 1);
    const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));

    // Tasks completed yesterday
    const completedYesterday = await this.taskRepo.find({
      where: {
        assignedHollonId: hollon.id,
        status: 'done' as any,
        completedAt: MoreThanOrEqual(startOfYesterday) as any,
      },
      take: 10,
    });

    // Today's planned tasks
    const todayTasks = await this.taskRepo.find({
      where: [
        { assignedHollonId: hollon.id, status: 'todo' as any },
        { assignedHollonId: hollon.id, status: 'in_progress' as any },
      ],
      take: 10,
    });

    // Blocked tasks
    const blockedTasks = await this.taskRepo.find({
      where: {
        assignedHollonId: hollon.id,
        status: 'blocked' as any,
      },
      take: 5,
    });

    return {
      hollonId: hollon.id,
      hollonName: hollon.name,
      completedYesterday,
      todayPlan: todayTasks,
      blockers: blockedTasks.map((t) => ({
        taskId: t.id,
        reason: (t as any).blockedReason || 'Unknown',
      })),
    };
  }

  /**
   * Generate standup summary
   */
  private generateStandupSummary(
    team: Team,
    responses: StandupResponse[],
  ): string {
    const lines: string[] = [];

    lines.push(`# Daily Standup - ${team.name}`);
    lines.push(`Date: ${format(new Date(), 'yyyy-MM-dd')}`);
    lines.push('');

    for (const response of responses) {
      lines.push(`## ${response.hollonName}`);
      lines.push('');

      lines.push('### ✅ Completed Yesterday');
      if (response.completedYesterday.length === 0) {
        lines.push('- No tasks completed');
      } else {
        response.completedYesterday.forEach((task) => {
          lines.push(`- ${task.title}`);
        });
      }
      lines.push('');

      lines.push("### 📋 Today's Plan");
      if (response.todayPlan.length === 0) {
        lines.push('- No tasks planned');
      } else {
        response.todayPlan.forEach((task) => {
          lines.push(`- ${task.title} (${task.status})`);
        });
      }
      lines.push('');

      if (response.blockers.length > 0) {
        lines.push('### 🚫 Blockers');
        response.blockers.forEach((blocker) => {
          lines.push(`- Task ${blocker.taskId}: ${blocker.reason}`);
        });
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}
