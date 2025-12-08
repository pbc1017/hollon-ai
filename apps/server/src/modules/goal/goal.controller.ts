import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { GoalService } from './goal.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { UpdateGoalDto } from './dto/update-goal.dto';
import { RecordProgressDto } from './dto/record-progress.dto';
import { GoalStatus, GoalType } from './entities/goal.entity';

@Controller('goals')
export class GoalController {
  constructor(private readonly goalService: GoalService) {}

  @Post()
  create(@Body() dto: CreateGoalDto) {
    return this.goalService.create(dto);
  }

  @Get()
  findAll(
    @Query('organizationId') organizationId?: string,
    @Query('teamId') teamId?: string,
    @Query('status') status?: GoalStatus,
    @Query('goalType') goalType?: GoalType,
    @Query('parentGoalId') parentGoalId?: string,
  ) {
    const filters: {
      organizationId?: string;
      teamId?: string;
      status?: GoalStatus;
      goalType?: GoalType;
      parentGoalId?: string | null;
    } = {
      organizationId,
      teamId,
      status,
      goalType,
    };

    // Handle parentGoalId: 'null' string means top-level goals only
    if (parentGoalId === 'null') {
      filters.parentGoalId = null;
    } else if (parentGoalId !== undefined) {
      filters.parentGoalId = parentGoalId;
    }

    return this.goalService.findAll(filters);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.goalService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateGoalDto) {
    return this.goalService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.goalService.remove(id);
  }

  // Progress tracking endpoints
  @Post(':id/progress')
  recordProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordProgressDto,
  ) {
    return this.goalService.recordProgress(id, dto);
  }

  @Get(':id/progress-history')
  getProgressHistory(@Param('id', ParseUUIDPipe) id: string) {
    return this.goalService.getProgressHistory(id);
  }

  // Hierarchy endpoints
  @Get(':id/children')
  getChildGoals(@Param('id', ParseUUIDPipe) id: string) {
    return this.goalService.getChildGoals(id);
  }

  @Get(':id/aggregated-progress')
  calculateAggregatedProgress(@Param('id', ParseUUIDPipe) id: string) {
    return this.goalService.calculateAggregatedProgress(id);
  }
}
