import { KnowledgeItemDto } from './knowledge-item.dto';
import { KnowledgeSourceDto } from './knowledge-source.dto';

/**
 * DTO for extracting knowledge from content
 */
export class ExtractKnowledgeDto {
  /** The content to extract knowledge from */
  content: string;

  /** Source information for the content */
  source: KnowledgeSourceDto;

  /** Optional metadata about the extraction request */
  metadata?: Record<string, unknown>;

  /** Optional list of knowledge items if already extracted */
  knowledgeItems?: KnowledgeItemDto[];

  /** Timestamp when the extraction was requested */
  timestamp: Date;
}
