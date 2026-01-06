import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { MeetingRecord, MeetingType } from '../entities/meeting-record.entity';
import { ChannelService } from '../../channel/channel.service';
import { addMinutes, isBefore, format } from 'date-fns';

export interface MeetingSchedule {
  id: string;
  meetingType: MeetingType;
  title: string;
  scheduledAt: Date;
  teamId?: string;
  organizationId: string;
}

export interface AdHocMeetingConfig {
  organizationId: string;
  teamId?: string;
  meetingType: MeetingType;
  title: string;
  content: string;
  scheduledAt: Date;
}

@Injectable()
export class MeetingSchedulerService {
  private readonly logger = new Logger(MeetingSchedulerService.name);

  constructor(
    @InjectRepository(MeetingRecord)
    private readonly meetingRepo: Repository<MeetingRecord>,
    private readonly channelService: ChannelService,
  ) {}

  /**
   * Send meeting reminders every 10 minutes
   * Check for meetings scheduled in the next 30 minutes
   */
  @Cron('*/10 * * * *')
  async sendReminders(): Promise<void> {
    this.logger.log('Checking for upcoming meetings to send reminders...');

    try {
      const now = new Date();
      const reminderWindow = addMinutes(now, 30);

      // Find meetings scheduled within the next 30 minutes that haven't been completed
      const upcomingMeetings = await this.meetingRepo.find({
        where: {
          scheduledAt: MoreThan(now) as any,
          completedAt: null as any,
        },
        take: 50,
      });

      // Filter meetings within reminder window
      const meetingsToRemind = upcomingMeetings.filter((meeting) => {
        return (
          meeting.scheduledAt &&
          isBefore(new Date(meeting.scheduledAt), reminderWindow)
        );
      });

      for (const meeting of meetingsToRemind) {
        await this.sendMeetingReminder(meeting);
      }

      if (meetingsToRemind.length > 0) {
        this.logger.log(`Sent ${meetingsToRemind.length} meeting reminders`);
      }
    } catch (error) {
      this.logger.error('Failed to send meeting reminders', error);
    }
  }

  /**
   * Send reminder for a specific meeting
   */
  private async sendMeetingReminder(meeting: MeetingRecord): Promise<void> {
    const reminderMessage = this.formatReminderMessage(meeting);

    // Send to team channel if teamId exists
    if (meeting.teamId) {
      try {
        await this.channelService.sendToTeamChannel(
          meeting.teamId,
          reminderMessage,
        );
      } catch (error) {
        this.logger.error(
          `Failed to send reminder for meeting ${meeting.id}`,
          error,
        );
      }
    }
  }

  /**
   * Format reminder message
   */
  private formatReminderMessage(meeting: MeetingRecord): string {
    const scheduledTime = meeting.scheduledAt
      ? format(new Date(meeting.scheduledAt), 'HH:mm')
      : 'soon';

    return `
# 🔔 Meeting Reminder

**${meeting.title}**

Type: ${meeting.meetingType}
Scheduled at: ${scheduledTime}

${meeting.content ? `\n${meeting.content.substring(0, 200)}...\n` : ''}

Please be prepared for the meeting.
    `.trim();
  }

  /**
   * Get upcoming meetings for a team
   */
  async getUpcomingMeetings(teamId: string): Promise<MeetingSchedule[]> {
    const now = new Date();

    const meetings = await this.meetingRepo.find({
      where: {
        teamId,
        scheduledAt: MoreThan(now) as any,
      },
      order: { scheduledAt: 'ASC' },
      take: 20,
    });

    return meetings.map((m) => ({
      id: m.id,
      meetingType: m.meetingType,
      title: m.title,
      scheduledAt: m.scheduledAt!,
      teamId: m.teamId || undefined,
      organizationId: m.organizationId,
    }));
  }

  /**
   * Schedule an ad-hoc meeting
   */
  async scheduleAdHocMeeting(
    config: AdHocMeetingConfig,
  ): Promise<MeetingRecord> {
    this.logger.log(`Scheduling ad-hoc meeting: ${config.title}`);

    const meeting = await this.meetingRepo.save({
      organizationId: config.organizationId,
      teamId: config.teamId,
      meetingType: config.meetingType,
      title: config.title,
      content: config.content,
      scheduledAt: config.scheduledAt,
      completedAt: null,
    });

    // Send notification to team channel
    if (config.teamId) {
      const notification = this.formatScheduleNotification(meeting);
      await this.channelService.sendToTeamChannel(config.teamId, notification);
    }

    this.logger.log(`Ad-hoc meeting scheduled: ${meeting.id}`);
    return meeting;
  }

  /**
   * Format schedule notification
   */
  private formatScheduleNotification(meeting: MeetingRecord): string {
    const scheduledDate = meeting.scheduledAt
      ? format(new Date(meeting.scheduledAt), 'yyyy-MM-dd HH:mm')
      : 'TBD';

    return `
# 📅 New Meeting Scheduled

**${meeting.title}**

Type: ${meeting.meetingType}
Scheduled for: ${scheduledDate}

${meeting.content ? `\n${meeting.content}\n` : ''}

You will receive a reminder 30 minutes before the meeting.
    `.trim();
  }

  /**
   * Mark meeting as completed
   */
  async completeMeeting(meetingId: string): Promise<MeetingRecord | null> {
    const meeting = await this.meetingRepo.findOne({
      where: { id: meetingId },
    });

    if (!meeting) {
      return null;
    }

    meeting.completedAt = new Date();
    return this.meetingRepo.save(meeting);
  }

  /**
   * Cancel a scheduled meeting
   */
  async cancelMeeting(meetingId: string): Promise<void> {
    const meeting = await this.meetingRepo.findOne({
      where: { id: meetingId },
    });

    if (meeting) {
      await this.meetingRepo.remove(meeting);
      this.logger.log(`Meeting cancelled: ${meetingId}`);

      // Send cancellation notification
      if (meeting.teamId) {
        const notification = `
# ❌ Meeting Cancelled

**${meeting.title}** scheduled for ${meeting.scheduledAt ? format(new Date(meeting.scheduledAt), 'yyyy-MM-dd HH:mm') : 'TBD'} has been cancelled.
        `.trim();

        await this.channelService.sendToTeamChannel(
          meeting.teamId,
          notification,
        );
      }
    }
  }
}
