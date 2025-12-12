import {
  Controller,
  Get,
  Param,
  Query,
  NotFoundException,
  ParseUUIDPipe,
  ParseIntPipe,
} from '@nestjs/common';
import { KnowledgeVersionService } from '../services/knowledge-version.service';
import { KnowledgeVersion } from '../entities/knowledge-version.entity';

@Controller('api/knowledge-versions')
export class KnowledgeVersionController {
  constructor(
    private readonly knowledgeVersionService: KnowledgeVersionService,
  ) {}

  @Get('document/:documentId')
  async getVersionHistory(
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<KnowledgeVersion[]> {
    const versions =
      await this.knowledgeVersionService.getVersionHistory(documentId);

    if (!versions || versions.length === 0) {
      throw new NotFoundException(
        `No version history found for document ${documentId}`,
      );
    }

    return versions;
  }

  @Get('document/:documentId/latest')
  async getLatestVersion(
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ): Promise<KnowledgeVersion> {
    const version =
      await this.knowledgeVersionService.getLatestVersion(documentId);

    if (!version) {
      throw new NotFoundException(
        `No versions found for document ${documentId}`,
      );
    }

    return version;
  }

  @Get('document/:documentId/version/:versionNumber')
  async getVersionByNumber(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Param('versionNumber', ParseIntPipe) versionNumber: number,
  ): Promise<KnowledgeVersion> {
    const version = await this.knowledgeVersionService.getVersionByNumber(
      documentId,
      versionNumber,
    );

    if (!version) {
      throw new NotFoundException(
        `Version ${versionNumber} not found for document ${documentId}`,
      );
    }

    return version;
  }

  @Get('task/:taskId')
  async getVersionsByTask(
    @Param('taskId', ParseUUIDPipe) taskId: string,
  ): Promise<KnowledgeVersion[]> {
    const versions =
      await this.knowledgeVersionService.getVersionsByTask(taskId);

    if (!versions || versions.length === 0) {
      throw new NotFoundException(
        `No knowledge versions found for task ${taskId}`,
      );
    }

    return versions;
  }

  @Get('document/:documentId/diff')
  async getDiffBetweenVersions(
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Query('from', ParseIntPipe) fromVersion: number,
    @Query('to', ParseIntPipe) toVersion: number,
  ): Promise<{
    fromVersion: KnowledgeVersion;
    toVersion: KnowledgeVersion;
    diff: KnowledgeVersion['diff'];
  }> {
    const from = await this.knowledgeVersionService.getVersionByNumber(
      documentId,
      fromVersion,
    );
    const to = await this.knowledgeVersionService.getVersionByNumber(
      documentId,
      toVersion,
    );

    if (!from || !to) {
      throw new NotFoundException(
        `One or both versions not found (from: ${fromVersion}, to: ${toVersion})`,
      );
    }

    return {
      fromVersion: from,
      toVersion: to,
      diff: to.diff,
    };
  }
}
