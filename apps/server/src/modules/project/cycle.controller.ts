import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CycleService } from './cycle.service';
import { Cycle } from './entities/cycle.entity';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { UpdateCycleDto } from './dto/update-cycle.dto';

@Controller('cycles')
export class CycleController {
  constructor(private readonly cycleService: CycleService) {}

  /**
   * Create a new cycle
   * POST /cycles
   */
  @Post()
  async create(@Body() dto: CreateCycleDto): Promise<Cycle> {
    return this.cycleService.create(dto);
  }

  /**
   * Get all cycles for a project
   * GET /cycles?projectId=xxx
   */
  @Get()
  async findByProject(
    @Query('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<Cycle[]> {
    return this.cycleService.findByProject(projectId);
  }

  /**
   * Get active cycles
   * GET /cycles/active
   */
  @Get('active')
  async findActive(): Promise<Cycle[]> {
    return this.cycleService.findActive();
  }

  /**
   * Get current active cycle for a project
   * GET /cycles/current/:projectId
   */
  @Get('current/:projectId')
  async getCurrentCycle(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ): Promise<Cycle | null> {
    return this.cycleService.getCurrentCycle(projectId);
  }

  /**
   * Get a cycle by ID
   * GET /cycles/:id
   */
  @Get(':id')
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<Cycle | null> {
    return this.cycleService.findOne(id);
  }

  /**
   * Update a cycle
   * PUT /cycles/:id
   */
  @Put(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCycleDto,
  ): Promise<Cycle> {
    return this.cycleService.update(id, dto);
  }

  /**
   * Delete a cycle
   * DELETE /cycles/:id
   */
  @Delete(':id')
  async remove(@Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.cycleService.remove(id);
  }

  /**
   * Create next cycle for a project
   * POST /cycles/next/:projectId
   */
  @Post('next/:projectId')
  async createNext(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Query('durationDays') durationDays?: number,
  ): Promise<Cycle> {
    return this.cycleService.createNextCycle(
      projectId,
      durationDays ? parseInt(durationDays.toString()) : 7,
    );
  }
}
