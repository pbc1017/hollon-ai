import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThanOrEqual, In } from 'typeorm';
import { MeetingRecord, MeetingType } from '../entities/meeting-record.entity';
import { Team } from '../../team/entities/team.entity';
import { Hollon, HollonStatus } from '../../hollon/entities/hollon.entity';
import { Task, TaskStatus } from '../../task/entities/task.entity';
import {
  Document,
  DocumentType,
} from '../../document/entities/document.entity';
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
    @InjectRepository(Document)
    private readonly documentRepo: Repository<Document>,
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

    // Create summary document for knowledge base
    const document = await this.createStandupDocument(team, summary, responses);
    if (document) {
      // Link document to meeting record
      meeting.metadata = {
        ...meeting.metadata,
        documentId: document.id,
      };
      await this.meetingRepo.save(meeting);
    }

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
   * 홀론의 스탠드업 상태 수집
   * 어제 완료한 태스크, 오늘 계획, 블로커를 조회
   * @param hollon 대상 홀론
   * @returns 스탠드업 응답 데이터
   */
  private async collectStandupStatus(hollon: Hollon): Promise<StandupResponse> {
    const yesterday = subDays(new Date(), 1);
    const startOfYesterday = new Date(yesterday.setHours(0, 0, 0, 0));

    // 어제 완료된 태스크
    const completedYesterday = await this.taskRepo.find({
      where: {
        assignedHollonId: hollon.id,
        status: TaskStatus.COMPLETED,
        completedAt: MoreThanOrEqual(startOfYesterday),
      },
      take: 10,
    });

    // 오늘 계획된 태스크 (대기 중 또는 진행 중)
    const todayTasks = await this.taskRepo.find({
      where: [
        { assignedHollonId: hollon.id, status: TaskStatus.READY },
        { assignedHollonId: hollon.id, status: TaskStatus.IN_PROGRESS },
        { assignedHollonId: hollon.id, status: TaskStatus.PENDING },
      ],
      take: 10,
    });

    // 블로커가 있는 태스크
    const blockedTasks = await this.taskRepo.find({
      where: {
        assignedHollonId: hollon.id,
        status: TaskStatus.BLOCKED,
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
        reason: t.errorMessage || 'Unknown blocker',
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

  /**
   * 스탠드업 요약 Document 생성
   * 팀의 스탠드업 결과를 프로젝트 문서로 저장
   * @param team 팀 정보
   * @param summary 스탠드업 요약 내용
   * @param responses 각 홀론의 스탠드업 응답
   * @returns 생성된 Document (프로젝트가 없으면 null)
   */
  private async createStandupDocument(
    team: Team,
    summary: string,
    responses: StandupResponse[],
  ): Promise<Document | null> {
    // 팀에 연결된 프로젝트 ID가 필요
    // Team 엔티티에 projectId가 없으면 첫 번째 활성 홀론의 프로젝트 사용
    const firstHollonWithProject = responses.find((r) => r.hollonId);
    if (!firstHollonWithProject) {
      this.logger.warn(`No project found for team: ${team.name}`);
      return null;
    }

    // 프로젝트 ID 조회 (홀론을 통해)
    const hollon = await this.hollonRepo.findOne({
      where: { id: firstHollonWithProject.hollonId },
      relations: ['team', 'team.projects'],
    });

    const projectId = (hollon?.team as any)?.projects?.[0]?.id;
    if (!projectId) {
      this.logger.warn(`No project associated with team: ${team.name}`);
      return null;
    }

    const today = format(new Date(), 'yyyy-MM-dd');
    const document = this.documentRepo.create({
      title: `Daily Standup - ${team.name} - ${today}`,
      content: summary,
      type: DocumentType.KNOWLEDGE,
      projectId,
      tags: ['standup', 'daily', team.name.toLowerCase()],
      metadata: {
        meetingType: 'standup',
        teamId: team.id,
        teamName: team.name,
        date: today,
        participantCount: responses.length,
        totalCompletedTasks: responses.reduce(
          (sum, r) => sum + r.completedYesterday.length,
          0,
        ),
        totalPlannedTasks: responses.reduce(
          (sum, r) => sum + r.todayPlan.length,
          0,
        ),
        totalBlockers: responses.reduce((sum, r) => sum + r.blockers.length, 0),
      },
    });

    const savedDocument = await this.documentRepo.save(document);
    this.logger.log(`Created standup document: ${savedDocument.id}`);
    return savedDocument;
  }
}
