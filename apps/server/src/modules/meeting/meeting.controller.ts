import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { MeetingRecord, MeetingType } from './entities/meeting-record.entity';
import { StandupService } from './services/standup.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateMeetingDto } from './dto/meeting-config.dto';

@Controller('meetings')
export class MeetingController {
  constructor(
    @InjectRepository(MeetingRecord)
    private readonly meetingRepo: Repository<MeetingRecord>,
    private readonly standupService: StandupService,
  ) {}

  /**
   * Trigger standup manually for a team
   * POST /meetings/standup/team/:teamId
   */
  @Post('standup/team/:teamId')
  async triggerStandup(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ): Promise<MeetingRecord | null> {
    const team = { id: teamId } as any; // Simplified - should fetch full team
    return this.standupService.runStandupForTeam(team);
  }

  /**
   * Get meeting records
   * GET /meetings
   */
  @Get()
  async getMeetings(
    @Query('organizationId') organizationId?: string,
    @Query('teamId') teamId?: string,
    @Query('type') type?: MeetingType,
  ): Promise<MeetingRecord[]> {
    const where: any = {};
    if (organizationId) where.organizationId = organizationId;
    if (teamId) where.teamId = teamId;
    if (type) where.meetingType = type;

    return this.meetingRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }

  /**
   * Get meeting by ID
   * GET /meetings/:id
   */
  @Get(':id')
  async getMeeting(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<MeetingRecord | null> {
    return this.meetingRepo.findOne({ where: { id } });
  }

  /**
   * Create meeting record
   * POST /meetings
   */
  @Post()
  async createMeeting(@Body() dto: CreateMeetingDto): Promise<MeetingRecord> {
    return this.meetingRepo.save({
      ...dto,
      completedAt: new Date(),
    });
  }
}
