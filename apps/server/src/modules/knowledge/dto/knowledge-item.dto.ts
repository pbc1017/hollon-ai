import { KnowledgeSourceDto } from './knowledge-source.dto';

/**
 * DTO for a single knowledge item extracted from content
 */
export class KnowledgeItemDto {
  /** The actual knowledge content */
  content: string;

  /** Metadata about the knowledge item */
  metadata?: Record<string, unknown>;

  /** Source information for this knowledge item */
  source: KnowledgeSourceDto;

  /** Timestamp when the knowledge was extracted */
  timestamp: Date;
}
