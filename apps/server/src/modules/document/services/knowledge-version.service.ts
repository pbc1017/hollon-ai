import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  KnowledgeVersion,
  ChangeType,
} from '../entities/knowledge-version.entity';
import { Document, DocumentType } from '../entities/document.entity';

interface VersionDiff {
  title?: {
    old: string;
    new: string;
  };
  content?: {
    additions: number;
    deletions: number;
    changes: Array<{
      type: 'add' | 'remove' | 'modify';
      line?: number;
      content: string;
    }>;
  };
  tags?: {
    added: string[];
    removed: string[];
  };
  metadata?: {
    added: Record<string, unknown>;
    removed: string[];
    modified: Record<string, unknown>;
  };
}

@Injectable()
export class KnowledgeVersionService {
  private readonly logger = new Logger(KnowledgeVersionService.name);

  constructor(
    @InjectRepository(KnowledgeVersion)
    private readonly versionRepository: Repository<KnowledgeVersion>,
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
  ) {}

  async createVersion(
    document: Document,
    previousVersion?: KnowledgeVersion,
  ): Promise<KnowledgeVersion> {
    const version = previousVersion ? previousVersion.version + 1 : 1;
    const changeTypes: ChangeType[] = [];
    let diff: VersionDiff | undefined;
    let changeSummary: string | null = null;

    if (previousVersion) {
      // Calculate diff
      diff = this.calculateDiff(previousVersion, document);
      changeTypes.push(...this.determineChangeTypes(diff));
      changeSummary = this.generateChangeSummary(diff);
    } else {
      changeTypes.push(ChangeType.CREATED);
      changeSummary = 'Initial version created';
    }

    const knowledgeVersion = this.versionRepository.create({
      documentId: document.id,
      taskId: document.taskId!,
      version,
      title: document.title,
      content: document.content,
      tags: document.tags || [],
      metadata: document.metadata || {},
      changeTypes,
      changeSummary,
      diff: diff || undefined,
    });

    const saved = await this.versionRepository.save(knowledgeVersion);
    this.logger.log(
      `Created version ${version} for document ${document.id} (task ${document.taskId})`,
    );

    return saved;
  }

  async getLatestVersion(documentId: string): Promise<KnowledgeVersion | null> {
    return this.versionRepository.findOne({
      where: { documentId },
      order: { version: 'DESC' },
    });
  }

  async getVersionHistory(documentId: string): Promise<KnowledgeVersion[]> {
    const versions = await this.versionRepository.find({
      where: { documentId },
      order: { version: 'ASC' },
    });
    return versions;
  }

  async getVersionByNumber(
    documentId: string,
    version: number,
  ): Promise<KnowledgeVersion | null> {
    return this.versionRepository.findOne({
      where: { documentId, version },
    });
  }

  async getVersionsByTask(taskId: string): Promise<KnowledgeVersion[]> {
    return this.versionRepository.find({
      where: { taskId },
      order: { version: 'ASC' },
    });
  }

  async findKnowledgeDocumentByTask(taskId: string): Promise<Document | null> {
    return this.documentRepository.findOne({
      where: {
        taskId,
        type: DocumentType.KNOWLEDGE,
      },
    });
  }

  private calculateDiff(
    oldVersion: KnowledgeVersion,
    newDocument: Document,
  ): VersionDiff {
    const diff: VersionDiff = {};

    // Title diff
    if (oldVersion.title !== newDocument.title) {
      diff.title = {
        old: oldVersion.title,
        new: newDocument.title,
      };
    }

    // Content diff (line-by-line comparison)
    if (oldVersion.content !== newDocument.content) {
      diff.content = this.calculateContentDiff(
        oldVersion.content,
        newDocument.content,
      );
    }

    // Tags diff
    const oldTags = new Set(oldVersion.tags || []);
    const newTags = new Set(newDocument.tags || []);
    const addedTags = [...newTags].filter((tag) => !oldTags.has(tag));
    const removedTags = [...oldTags].filter((tag) => !newTags.has(tag));

    if (addedTags.length > 0 || removedTags.length > 0) {
      diff.tags = {
        added: addedTags,
        removed: removedTags,
      };
    }

    // Metadata diff
    const metadataDiff = this.calculateMetadataDiff(
      oldVersion.metadata || {},
      newDocument.metadata || {},
    );
    if (
      Object.keys(metadataDiff.added).length > 0 ||
      metadataDiff.removed.length > 0 ||
      Object.keys(metadataDiff.modified).length > 0
    ) {
      diff.metadata = metadataDiff;
    }

    return diff;
  }

  private calculateContentDiff(
    oldContent: string,
    newContent: string,
  ): VersionDiff['content'] {
    const oldLines = oldContent.split('\n');
    const newLines = newContent.split('\n');
    const changes: Array<{
      type: 'add' | 'remove' | 'modify';
      line?: number;
      content: string;
    }> = [];

    let additions = 0;
    let deletions = 0;
    const maxLen = Math.max(oldLines.length, newLines.length);

    for (let i = 0; i < maxLen; i++) {
      const oldLine = oldLines[i];
      const newLine = newLines[i];

      if (oldLine === undefined && newLine !== undefined) {
        // Line added
        additions++;
        changes.push({
          type: 'add',
          line: i + 1,
          content: newLine,
        });
      } else if (oldLine !== undefined && newLine === undefined) {
        // Line removed
        deletions++;
        changes.push({
          type: 'remove',
          line: i + 1,
          content: oldLine,
        });
      } else if (oldLine !== newLine) {
        // Line modified
        additions++;
        deletions++;
        changes.push({
          type: 'modify',
          line: i + 1,
          content: `- ${oldLine}\n+ ${newLine}`,
        });
      }
    }

    return {
      additions,
      deletions,
      changes: changes.slice(0, 50), // Limit to first 50 changes for performance
    };
  }

  private calculateMetadataDiff(
    oldMetadata: Record<string, unknown>,
    newMetadata: Record<string, unknown>,
  ): {
    added: Record<string, unknown>;
    removed: string[];
    modified: Record<string, unknown>;
  } {
    const added: Record<string, unknown> = {};
    const removed: string[] = [];
    const modified: Record<string, unknown> = {};

    const allKeys = new Set([
      ...Object.keys(oldMetadata),
      ...Object.keys(newMetadata),
    ]);

    for (const key of allKeys) {
      const oldValue = oldMetadata[key];
      const newValue = newMetadata[key];

      if (oldValue === undefined && newValue !== undefined) {
        added[key] = newValue;
      } else if (oldValue !== undefined && newValue === undefined) {
        removed.push(key);
      } else if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        modified[key] = { old: oldValue, new: newValue };
      }
    }

    return { added, removed, modified };
  }

  private determineChangeTypes(diff: VersionDiff): ChangeType[] {
    const types: ChangeType[] = [ChangeType.UPDATED];

    if (diff.content) {
      types.push(ChangeType.CONTENT_CHANGED);
    }
    if (diff.tags) {
      types.push(ChangeType.TAGS_CHANGED);
    }
    if (diff.metadata) {
      types.push(ChangeType.METADATA_CHANGED);
    }

    return types;
  }

  private generateChangeSummary(diff: VersionDiff): string {
    const parts: string[] = [];

    if (diff.title) {
      parts.push(`Title changed`);
    }
    if (diff.content) {
      parts.push(
        `Content: +${diff.content.additions} -${diff.content.deletions} lines`,
      );
    }
    if (diff.tags) {
      if (diff.tags.added.length > 0) {
        parts.push(`Tags added: ${diff.tags.added.join(', ')}`);
      }
      if (diff.tags.removed.length > 0) {
        parts.push(`Tags removed: ${diff.tags.removed.join(', ')}`);
      }
    }
    if (diff.metadata) {
      const metaChanges = [
        ...Object.keys(diff.metadata.added),
        ...diff.metadata.removed,
        ...Object.keys(diff.metadata.modified),
      ];
      if (metaChanges.length > 0) {
        parts.push(`Metadata fields changed: ${metaChanges.join(', ')}`);
      }
    }

    return parts.join('; ');
  }
}
