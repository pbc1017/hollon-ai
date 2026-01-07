import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GraphNode } from './entities/graph-node.entity';
import { GraphEdge } from './entities/graph-edge.entity';
import { KnowledgeGraphService } from './knowledge-graph.service';
import { EntityExtractionService } from './services/entity-extraction.service';
import { GraphConstructionService } from './services/graph-construction.service';
import { MergeService } from './services/merge.service';

@Module({
  imports: [TypeOrmModule.forFeature([GraphNode, GraphEdge])],
  providers: [
    KnowledgeGraphService,
    EntityExtractionService,
    GraphConstructionService,
    MergeService,
  ],
  exports: [
    KnowledgeGraphService,
    EntityExtractionService,
    GraphConstructionService,
    MergeService,
  ],
})
export class KnowledgeGraphModule {}
