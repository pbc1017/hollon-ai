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
import { PriorityRebalancerService } from './services/priority-rebalancer.service';
import { UncertaintyDecisionService } from './services/uncertainty-decision.service';
import { PivotResponseService } from './services/pivot-response.service';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { TaskStatus, TaskPriority } from './entities/task.entity';
import { RebalancingOptions } from './interfaces/priority-rebalancing.interface';
import { DecisionOptions } from './interfaces/uncertainty-decision.interface';
import {
  PivotContext,
  PivotOptions,
} from './interfaces/pivot-response.interface';

@Controller('tasks')
export class TaskController {
  constructor(
    private readonly taskService: TaskService,
    private readonly dependencyAnalyzer: DependencyAnalyzerService,
    private readonly resourcePlanner: ResourcePlannerService,
    private readonly priorityRebalancer: PriorityRebalancerService,
    private readonly uncertaintyDecision: UncertaintyDecisionService,
    private readonly pivotResponse: PivotResponseService,
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

  // Priority Rebalancing endpoints
  @Post('projects/:projectId/rebalance-priorities')
  rebalancePriorities(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() options?: RebalancingOptions,
  ) {
    return this.priorityRebalancer.rebalanceProject(projectId, options);
  }

  @Get(':id/priority-score')
  evaluateTaskPriority(@Param('id', ParseUUIDPipe) id: string) {
    return this.priorityRebalancer.reevaluateTask(id);
  }

  // Uncertainty Detection endpoints
  @Post('projects/:projectId/detect-uncertainty')
  detectUncertainty(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body() options?: DecisionOptions,
  ) {
    return this.uncertaintyDecision.detectUncertainty(projectId, options);
  }

  @Get(':id/uncertainty-analysis')
  analyzeTaskUncertainty(@Param('id', ParseUUIDPipe) id: string) {
    const task = this.taskService.findOne(id);
    return this.uncertaintyDecision.analyzeTaskUncertainty(task as any);
  }

  // Pivot Response endpoints
  @Post('projects/:projectId/analyze-pivot')
  analyzePivot(
    @Param('projectId', ParseUUIDPipe) projectId: string,
    @Body('pivotContext') pivotContext: PivotContext,
    @Body('options') options?: PivotOptions,
  ) {
    return this.pivotResponse.analyzePivot(projectId, pivotContext, options);
  }
}
