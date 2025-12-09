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
import { TaskService } from './task.service';
import { DependencyAnalyzerService } from './services/dependency-analyzer.service';
import { ResourcePlannerService } from './services/resource-planner.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus, TaskPriority } from './entities/task.entity';

@Controller('tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly dependencyAnalyzer: DependencyAnalyzerService,
    private readonly resourcePlanner: ResourcePlannerService,
  ) {}

  @Post()
  create(@Body() dto: CreateTaskDto) {
    return this.taskService.create(dto);
  }

  @Get()
  findAll(
    @Query('projectId') projectId?: string,
    @Query('status') status?: TaskStatus,
    @Query('priority') priority?: TaskPriority,
    @Query('assignedHollonId') assignedHollonId?: string,
  ) {
    return this.taskService.findAll({
      projectId,
      status,
      priority,
      assignedHollonId,
    });
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTaskDto) {
    return this.taskService.update(id, dto);
  }

  @Patch(':id/assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('hollonId', ParseUUIDPipe) hollonId: string,
  ) {
    return this.taskService.assignToHollon(id, hollonId);
  }

  @Patch(':id/complete')
  complete(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskService.complete(id);
  }

  @Patch(':id/fail')
  fail(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('errorMessage') errorMessage: string,
  ) {
    return this.taskService.fail(id, errorMessage);
  }

  @Delete(':id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.taskService.remove(id);
  }

  // Dependency Analysis endpoints
  @Get('projects/:projectId/dependency-analysis')
  analyzeProjectDependencies(
    @Param('projectId', ParseUUIDPipe) projectId: string,
  ) {
    return this.dependencyAnalyzer.analyzeProject(projectId);
  }

  @Get(':id/dependencies')
  analyzeTaskDependencies(@Param('id', ParseUUIDPipe) id: string) {
    return this.dependencyAnalyzer.analyzeTask(id);
  }

  // Resource Planning endpoints
  @Post('projects/:projectId/assign-resources')
  assignProjectResources(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.resourcePlanner.assignProject(projectId);
  }

  @Post('projects/:projectId/rebalance-workload')
  rebalanceWorkload(@Param('projectId', ParseUUIDPipe) projectId: string) {
    return this.resourcePlanner.rebalanceWorkload(projectId);
  }

  @Get(':id/recommend-hollon')
  recommendHollon(@Param('id', ParseUUIDPipe) id: string) {
    const task = this.taskService.findOne(id);
    return this.resourcePlanner.recommendHollon(task as any);
  }
}
