import { Injectable } from '@nestjs/common';
import { KnowledgeExtractionService } from '../knowledge-extraction/knowledge-extraction.service';
import { VectorSearchService } from '../vector-search/vector-search.service';
import { KnowledgeGraphService } from '../knowledge-graph/knowledge-graph.service';

@Injectable()
export class PromptComposerService {
  constructor(
    private readonly knowledgeExtractionService: KnowledgeExtractionService,
    private readonly vectorSearchService: VectorSearchService,
    private readonly knowledgeGraphService: KnowledgeGraphService,
  ) {}
}
