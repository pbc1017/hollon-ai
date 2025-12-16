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
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { KnowledgeRepository } from './services/knowledge.repository';
import { KnowledgeExtractionService } from './services/knowledge-extraction.service';
import { KnowledgeRetrievalService } from './services/knowledge-retrieval.service';
import {
  CreateKnowledgeEntryDto,
  UpdateKnowledgeEntryDto,
  SearchKnowledgeDto,
  SemanticSearchDto,
} from './dto';
import {
  KnowledgeEntry,
  KnowledgeCategory,
} from './entities/knowledge-entry.entity';

@ApiTags('knowledge')
@Controller('knowledge')
export class KnowledgeController {
  constructor(
    private readonly knowledgeRepo: KnowledgeRepository,
    private readonly extractionService: KnowledgeExtractionService,
    private readonly retrievalService: KnowledgeRetrievalService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new knowledge entry' })
  @ApiResponse({
    status: 201,
    description: 'Knowledge entry created',
    type: KnowledgeEntry,
  })
  create(@Body() dto: CreateKnowledgeEntryDto) {
    return this.knowledgeRepo.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Search knowledge entries' })
  @ApiResponse({
    status: 200,
    description: 'List of knowledge entries',
    type: [KnowledgeEntry],
  })
  search(@Query() searchDto: SearchKnowledgeDto) {
    return this.knowledgeRepo.search(searchDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a knowledge entry by ID' })
  @ApiResponse({
    status: 200,
    description: 'Knowledge entry found',
    type: KnowledgeEntry,
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.knowledgeRepo.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a knowledge entry' })
  @ApiResponse({
    status: 200,
    description: 'Knowledge entry updated',
    type: KnowledgeEntry,
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKnowledgeEntryDto,
  ) {
    return this.knowledgeRepo.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a knowledge entry' })
  @ApiResponse({ status: 200, description: 'Knowledge entry deleted' })
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.knowledgeRepo.remove(id);
  }

  @Post('semantic-search')
  @ApiOperation({ summary: 'Perform semantic search on knowledge entries' })
  @ApiResponse({
    status: 200,
    description: 'Search results',
    type: [KnowledgeEntry],
  })
  semanticSearch(@Body() searchDto: SemanticSearchDto) {
    return this.retrievalService.semanticSearch(searchDto);
  }

  @Get('tasks/:taskId')
  @ApiOperation({ summary: 'Get knowledge entries for a task' })
  @ApiResponse({
    status: 200,
    description: 'Knowledge entries for task',
    type: [KnowledgeEntry],
  })
  findByTask(@Param('taskId', ParseUUIDPipe) taskId: string) {
    return this.knowledgeRepo.findByTask(taskId);
  }

  @Get('hollons/:hollonId')
  @ApiOperation({ summary: 'Get knowledge entries extracted by a hollon' })
  @ApiResponse({
    status: 200,
    description: 'Knowledge entries by hollon',
    type: [KnowledgeEntry],
  })
  findByHollon(@Param('hollonId', ParseUUIDPipe) hollonId: string) {
    return this.knowledgeRepo.findByHollon(hollonId);
  }

  @Get('organizations/:organizationId/best-practices')
  @ApiOperation({ summary: 'Get best practices for an organization' })
  @ApiResponse({
    status: 200,
    description: 'Best practices',
    type: [KnowledgeEntry],
  })
  findBestPractices(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Query('category') category?: string,
    @Query('limit') limit?: number,
  ) {
    return this.knowledgeRepo.findBestPractices(organizationId, {
      category: category as KnowledgeCategory | undefined,
      limit: limit ? parseInt(limit.toString(), 10) : undefined,
    });
  }

  @Get('organizations/:organizationId/statistics')
  @ApiOperation({ summary: 'Get knowledge statistics for an organization' })
  @ApiResponse({ status: 200, description: 'Knowledge statistics' })
  getStatistics(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.knowledgeRepo.getStatistics(organizationId);
  }

  @Get('organizations/:organizationId/insights')
  @ApiOperation({ summary: 'Get knowledge insights for an organization' })
  @ApiResponse({ status: 200, description: 'Knowledge insights' })
  getInsights(@Param('organizationId', ParseUUIDPipe) organizationId: string) {
    return this.retrievalService.getInsights(organizationId);
  }

  @Get(':id/similar')
  @ApiOperation({ summary: 'Find similar knowledge entries' })
  @ApiResponse({
    status: 200,
    description: 'Similar knowledge entries',
    type: [KnowledgeEntry],
  })
  findSimilar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit?: number,
    @Query('minConfidence') minConfidence?: number,
  ) {
    return this.retrievalService.findSimilar(id, {
      limit: limit ? parseInt(limit.toString(), 10) : undefined,
      minConfidence: minConfidence
        ? parseInt(minConfidence.toString(), 10)
        : undefined,
    });
  }

  @Post('tasks/:taskId/extract')
  @ApiOperation({ summary: 'Extract knowledge from a completed task' })
  @ApiResponse({
    status: 201,
    description: 'Knowledge extracted',
    type: KnowledgeEntry,
  })
  extractFromTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Query('hollonId', ParseUUIDPipe) hollonId?: string,
  ) {
    return this.extractionService.extractFromTaskCompletion(taskId, hollonId);
  }

  @Post('tasks/batch-extract')
  @ApiOperation({ summary: 'Extract knowledge from multiple tasks' })
  @ApiResponse({
    status: 201,
    description: 'Knowledge extracted from tasks',
    type: [KnowledgeEntry],
  })
  batchExtractFromTasks(
    @Body('taskIds') taskIds: string[],
    @Body('hollonId') hollonId?: string,
  ) {
    return this.extractionService.batchExtractFromTasks(taskIds, hollonId);
  }

  @Post('organizations/:organizationId/extract')
  @ApiOperation({
    summary: 'Extract knowledge from organization completed tasks',
  })
  @ApiResponse({
    status: 201,
    description: 'Knowledge extracted',
    type: [KnowledgeEntry],
  })
  extractFromOrganization(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
    @Body('fromDate') fromDate?: Date,
    @Body('toDate') toDate?: Date,
    @Body('limit') limit?: number,
  ) {
    return this.extractionService.extractFromOrganization(organizationId, {
      fromDate,
      toDate,
      limit,
    });
  }

  @Patch(':id/increment-application')
  @ApiOperation({
    summary: 'Increment application count for a knowledge entry',
  })
  @ApiResponse({
    status: 200,
    description: 'Application count incremented',
    type: KnowledgeEntry,
  })
  incrementApplication(@Param('id', ParseUUIDPipe) id: string) {
    return this.knowledgeRepo.incrementApplicationCount(id);
  }

  @Post('tasks/:taskId/recommendations')
  @ApiOperation({ summary: 'Get knowledge recommendations for a task' })
  @ApiResponse({
    status: 200,
    description: 'Recommended knowledge entries',
    type: [KnowledgeEntry],
  })
  getTaskRecommendations(
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @Body('organizationId', ParseUUIDPipe) organizationId: string,
    @Body('tags') tags?: string[],
    @Body('type') type?: string,
    @Body('limit') limit?: number,
  ) {
    return this.retrievalService.getRecommendationsForTask(
      taskId,
      organizationId,
      {
        tags,
        type,
        limit,
      },
    );
  }

  @Post('organizations/:organizationId/update-embeddings')
  @ApiOperation({ summary: 'Update embeddings for knowledge entries' })
  @ApiResponse({ status: 200, description: 'Number of entries updated' })
  updateEmbeddings(
    @Param('organizationId', ParseUUIDPipe) organizationId: string,
  ) {
    return this.retrievalService.updateEmbeddings(organizationId);
  }
}
