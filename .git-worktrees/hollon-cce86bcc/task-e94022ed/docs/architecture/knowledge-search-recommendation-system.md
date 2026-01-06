# Knowledge Search and Recommendation System Architecture

> **Date**: 2025-12-23
> **Phase**: Phase 4 (Knowledge System & Collaboration)
> **Duration**: 6 weeks (3 sprints: Phase 4.1, 4.2, 4.3)
> **Owner**: Architecture Team
> **SSOT References**: § 5.5 (Document-Memory), § 5.6 (Hybrid RAG)

---

## 📑 Table of Contents

1. [Executive Summary](#executive-summary)
2. [System Overview](#system-overview)
3. [7 Work Items Breakdown](#7-work-items-breakdown)
4. [Architecture Layers](#architecture-layers)
5. [Search Indexing Strategy](#search-indexing-strategy)
6. [Recommendation Engine](#recommendation-engine)
7. [API Specification](#api-specification)
8. [Caching Strategy](#caching-strategy)
9. [Dependency Map](#dependency-map)
10. [Integration Points](#integration-points)
11. [Data Flows](#data-flows)
12. [Performance Targets](#performance-targets)
13. [Testing Strategy](#testing-strategy)

---

## Executive Summary

The Knowledge Search and Recommendation System is a multi-component architecture enabling the Hollon-AI system to:

1. **Automatically capture and index organizational knowledge** from task completions, decisions, and code reviews
2. **Retrieve relevant context** using hybrid semantic (vector) and relationship (graph) based search
3. **Inject learned knowledge** into LLM prompts to improve decision-making
4. **Recommend actions** based on historical patterns and team performance
5. **Optimize prompts** through continuous analysis and learning
6. **Collaborate in real-time** through channels and automated improvements

**Key Metrics**:
- Vector search accuracy: **85%+**
- Graph traversal accuracy: **80%+**
- Token savings from optimization: **15%**
- Automation coverage: **100%** (automatic extraction, analysis, recommendations)

---

## System Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Frontend & APIs                             │
│   (Web UI, CLI Tool, External Integrations)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Knowledge System Layer                             │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Extraction │ Indexing │ Search │ Recommendation │ Caching │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              Storage Layer (PostgreSQL)                         │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │ Documents │ Embeddings │ Relationships │ Metrics │ Cache │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│              External Services                                 │
│  (OpenAI Embeddings, Claude Brain Provider, Event Bus)         │
└─────────────────────────────────────────────────────────────────┘
```

### System Capabilities

| Capability | Component | Purpose |
|-----------|-----------|---------|
| **Knowledge Extraction** | KnowledgeExtractionService | Auto-create documents from tasks, decisions, reviews |
| **Vector Search** | VectorSearchService | Semantic similarity search via embeddings |
| **Graph Navigation** | KnowledgeGraphService | Relationship-based document discovery |
| **Hybrid RAG** | PromptComposerService | Combined vector + graph search for memory injection |
| **Collaboration** | ChannelService | Real-time team communication and alerts |
| **Continuous Analysis** | ContinuousImprovementService | Event-driven performance analysis |
| **Performance Tracking** | PerformanceAnalyzerService | Metric collection and hollon scoring |
| **Prompt Optimization** | PromptOptimizerService | A/B testing and token usage analysis |
| **Best Practices** | BestPracticeService | Pattern extraction from high performers |

---

## 7 Work Items Breakdown

### Phase 4.1: Knowledge System (Week 1-2)

#### Work Item 1: Knowledge Extraction Service

**Objective**: Automatically extract and document organizational knowledge from task completion, decision logs, and code reviews.

**Location**: `apps/server/src/modules/knowledge/services/knowledge-extraction.service.ts`

**Core Functionality**:

```typescript
@Injectable()
export class KnowledgeExtractionService {
  // Extract from completed tasks
  async extractFromCompletedTask(task: Task): Promise<Document> {
    const keywords = await this.extractKeywords(task);
    const summary = await this.generateSummary(task);
    const importance = this.calculateImportance(task);

    return await this.documentService.create({
      title: `Task Completion: ${task.title}`,
      content: summary,
      docType: 'knowledge',
      scope: task.projectId ? 'project' : 'team',
      scopeId: task.projectId || task.assignedHollon.teamId,
      keywords,
      importance,
      autoGenerated: true,
      metadata: {
        sourceTaskId: task.id,
        hollonId: task.assignedHollon.id,
        completionTime: task.completedAt - task.startedAt,
        qualityScore: task.qualityScore,
      },
    });
  }

  // Extract from decisions
  async extractFromDecisionLog(log: DecisionLog): Promise<Document>;

  // Extract from code reviews
  async extractFromPRReview(pr: TaskPullRequest): Promise<Document>;

  // Batch processing
  async extractMissingDocuments(
    options: { projectId?: string; teamId?: string },
  ): Promise<Document[]>;
}
```

**Event Integration**:
```typescript
@OnEvent('task.completed')
async handleTaskCompletion(event: TaskCompletedEvent) {
  await this.extractFromCompletedTask(event.task);
  // Triggers vector embedding generation
  // Updates knowledge graph relationships
}
```

**Keyword Extraction Strategy**:
- Extract from title, description, and tags
- Use NLP for semantic keywords
- Filter by importance (relevance to project/team)
- Deduplicate and normalize

**Importance Calculation** (0-10 scale):
```
base = 5
+ 2 if estimated > 4 hours (complex task)
+ 1 if quality_score > 90 (high quality)
+ 1 if used_by_other_tasks (reusable knowledge)
+ 1 if escalation_count == 0 (smooth execution)
= importance (capped at 10)
```

**Success Criteria**:
- [ ] Task completion triggers document creation (100%)
- [ ] Keywords extracted accurately from all task types
- [ ] Importance scores reflect task value
- [ ] Batch extraction handles 1000+ tasks efficiently

---

#### Work Item 2: Vector Search Service

**Objective**: Enable semantic similarity search using OpenAI embeddings and pgvector.

**Location**: `apps/server/src/modules/knowledge/services/vector-search.service.ts`

**Core Functionality**:

```typescript
@Injectable()
export class VectorSearchService {
  // Generate embeddings using OpenAI API
  async generateEmbedding(text: string): Promise<number[]> {
    const response = await this.openaiClient.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      dimensions: 1536, // Default dimension size
    });

    return response.data[0].embedding;
  }

  // Vector similarity search with scope filtering
  async vectorSimilaritySearch(
    query: string,
    options: {
      scope?: 'organization' | 'team' | 'project' | 'hollon';
      scopeId?: string;
      limit?: number;
      minSimilarity?: number; // Cosine similarity threshold (0-1)
      docTypes?: DocumentType[];
    } = {},
  ): Promise<Document[]> {
    const embedding = await this.generateEmbedding(query);

    const query = this.documentRepository
      .createQueryBuilder('doc')
      .select([
        'doc.id',
        'doc.title',
        'doc.content',
        'doc.docType',
        'doc.importance',
        'doc.keywords',
        'doc.createdAt',
      ])
      .addSelect('doc.embedding <=> :embedding AS similarity')
      .where('1=1');

    // Apply scope filters
    if (options.scope && options.scopeId) {
      query.andWhere('doc.scope = :scope AND doc.scopeId = :scopeId', {
        scope: options.scope,
        scopeId: options.scopeId,
      });
    }

    // Filter by document type
    if (options.docTypes?.length) {
      query.andWhere('doc.docType IN (:docTypes)', {
        docTypes: options.docTypes,
      });
    }

    // Order by similarity (lower distance = higher similarity)
    query.orderBy('similarity', 'ASC');

    // Apply similarity threshold
    if (options.minSimilarity) {
      query.andWhere('(doc.embedding <=> :embedding) <= :minSimilarity', {
        minSimilarity: 1 - options.minSimilarity, // Convert to distance
      });
    }

    const results = await query
      .limit(options.limit || 10)
      .getMany();

    return results;
  }

  // Batch embedding generation
  async generateEmbeddingsForDocuments(
    documentIds: string[],
    batchSize: number = 100,
  ): Promise<void> {
    for (let i = 0; i < documentIds.length; i += batchSize) {
      const batch = documentIds.slice(i, i + batchSize);
      const documents = await this.documentService.findByIds(batch);

      const embeddings = await Promise.all(
        documents.map(doc =>
          this.generateEmbedding(`${doc.title}\n\n${doc.content}`),
        ),
      );

      await this.documentRepository.update(
        documents.map((_, idx) => batch[idx]),
        documents.map((_, idx) => ({
          embedding: embeddings[idx],
        })),
      );
    }
  }
}
```

**Database Configuration**:

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add embedding column to documents
ALTER TABLE documents
ADD COLUMN IF NOT EXISTS embedding vector(1536);

-- Create index for fast similarity search
CREATE INDEX IF NOT EXISTS ix_document_embedding
ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);
```

**Embedding Strategy**:
- Model: `text-embedding-3-small` (1536 dimensions)
- Input: `"${title}\n\n${content}"` for rich context
- Caching: Pre-computed and stored in database
- Updates: Regenerate on document modification

**Performance Characteristics**:
- Single vector search: ~50-100ms (with IVFFLAT index)
- Batch generation: ~2-5 seconds per 100 documents
- Storage: ~6KB per embedding (1536 floats)

**Success Criteria**:
- [ ] Vector search accuracy ≥85% (measured against manual relevance)
- [ ] Search latency <100ms for scope-filtered queries
- [ ] Embedding generation for all new documents
- [ ] IVFFLAT index reduces search time by 10x

---

#### Work Item 3: Knowledge Graph Service

**Objective**: Build relationship-based navigation for discovering related documents.

**Location**: `apps/server/src/modules/knowledge/services/knowledge-graph.service.ts`

**Core Entities**:

```typescript
@Entity('document_relationships')
export class DocumentRelationship {
  @PrimaryColumn('uuid')
  fromDocumentId: string;

  @PrimaryColumn('uuid')
  toDocumentId: string;

  @ManyToOne(() => Document)
  @JoinColumn({ name: 'fromDocumentId' })
  fromDocument: Document;

  @ManyToOne(() => Document)
  @JoinColumn({ name: 'toDocumentId' })
  toDocument: Document;

  @Column('enum', {
    enum: ['references', 'depends_on', 'supersedes', 'related_to'],
    default: 'related_to',
  })
  relationType: DocumentRelationType;

  @Column('jsonb', { nullable: true })
  metadata: {
    confidence?: number; // 0-1 score
    extractedAt?: Date;
    reasons?: string[]; // Why these are related
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Core Functionality**:

```typescript
@Injectable()
export class KnowledgeGraphService {
  // Automatically extract relationships from document content
  async extractRelationships(document: Document): Promise<void> {
    // 1. Use regex to find internal document references
    const documentRefs = this.findDocumentReferences(document.content);

    // 2. Use LLM to identify semantic relationships
    const llmRelationships = await this.brainProvider.executeWithTracking({
      systemPrompt: 'Extract document relationships from the following text.',
      userPrompt: `Document: ${document.title}\n\n${document.content}`,
      maxTokens: 500,
    });

    // 3. Store relationships
    for (const ref of documentRefs) {
      await this.relationshipRepository.save({
        fromDocumentId: document.id,
        toDocumentId: ref.documentId,
        relationType: ref.type,
        metadata: {
          confidence: ref.confidence,
          extractedAt: new Date(),
        },
      });
    }
  }

  // Graph-based document discovery
  async findRelatedDocuments(
    documentId: string,
    options: {
      depth?: number;
      relationTypes?: DocumentRelationType[];
      direction?: 'forward' | 'backward' | 'both';
      maxResults?: number;
    } = {},
  ): Promise<Document[]> {
    const {
      depth = 2,
      relationTypes,
      direction = 'both',
      maxResults = 20,
    } = options;

    const visited = new Set<string>();
    const results = new Map<string, { doc: Document; depth: number }>();

    // BFS traversal of the knowledge graph
    const queue: Array<{ documentId: string; currentDepth: number }> = [
      { documentId, currentDepth: 0 },
    ];

    while (queue.length > 0) {
      const { documentId: currentId, currentDepth } = queue.shift()!;

      if (visited.has(currentId) || currentDepth >= depth) {
        continue;
      }

      visited.add(currentId);

      // Find related documents
      const relationships = await this.relationshipRepository.find({
        where: [
          ...(direction === 'forward' || direction === 'both'
            ? [
                {
                  fromDocumentId: currentId,
                  ...(relationTypes && { relationType: In(relationTypes) }),
                },
              ]
            : []),
          ...(direction === 'backward' || direction === 'both'
            ? [
                {
                  toDocumentId: currentId,
                  ...(relationTypes && { relationType: In(relationTypes) }),
                },
              ]
            : []),
        ],
        relations: [
          direction === 'forward' || direction === 'both' ? 'toDocument' : '',
          direction === 'backward' || direction === 'both' ? 'fromDocument' : '',
        ],
      });

      for (const rel of relationships) {
        const relatedDoc =
          rel.fromDocumentId === currentId ? rel.toDocument : rel.fromDocument;

        if (!visited.has(relatedDoc.id)) {
          results.set(relatedDoc.id, {
            doc: relatedDoc,
            depth: currentDepth + 1,
          });
          queue.push({
            documentId: relatedDoc.id,
            currentDepth: currentDepth + 1,
          });
        }
      }
    }

    // Sort by depth (closest first) then by importance
    return Array.from(results.values())
      .sort((a, b) => a.depth - b.depth || b.doc.importance - a.doc.importance)
      .slice(0, maxResults)
      .map(item => item.doc);
  }

  // Find strongly connected clusters
  async findDocumentClusters(scopeId: string): Promise<DocumentCluster[]> {
    // Use Tarjan's algorithm for SCC finding
    // Return clusters of closely related documents
  }

  // Calculate graph metrics
  async calculateGraphMetrics(documentId: string): Promise<{
    centralityScore: number;
    reachability: number;
    clusteringCoefficient: number;
  }>;
}
```

**Relationship Types**:

| Type | Meaning | Example |
|------|---------|---------|
| **references** | Document A mentions/cites Document B | ADR references previous design decision |
| **depends_on** | Document A depends on Document B for context | Implementation depends on requirements doc |
| **supersedes** | Document A replaces/updates Document B | New API spec supersedes old one |
| **related_to** | Document A is related to Document B | Similar features in different areas |

**Graph Construction**:
1. **Regex-based**: Find `[DOC-123]` style references
2. **LLM-based**: Use Claude to identify semantic relationships
3. **Metrics-based**: Link documents with similar keywords or topics
4. **Event-based**: Link task completion documents to parent tasks

**Success Criteria**:
- [ ] Graph traversal accuracy ≥80%
- [ ] Relationship extraction for all new documents
- [ ] Multi-depth traversal working (2-3 levels)
- [ ] Cluster detection identifying topic groups

---

#### Work Item 4: Prompt Composer Service Integration (Hybrid RAG)

**Objective**: Integrate vector and graph search into the prompt composition pipeline.

**Location**: `apps/server/src/modules/orchestration/services/prompt-composer.service.ts`

**Hybrid RAG Strategy**:

```typescript
@Injectable()
export class PromptComposerService {
  /**
   * Fetch relevant memory using hybrid search (vector + graph)
   * This replaces the old ILIKE keyword-based search
   */
  async fetchRelevantMemories(
    task: Task,
    hollon: Hollon,
    options: {
      maxDocuments?: number;
      minImportance?: number;
    } = {},
  ): Promise<Document[]> {
    const { maxDocuments = 10, minImportance = 3 } = options;

    // 1. Vector search (semantic similarity)
    const vectorResults = await this.vectorSearchService.vectorSimilaritySearch(
      `${task.title}\n\n${task.description}`,
      {
        scope: task.projectId ? 'project' : 'team',
        scopeId: task.projectId || task.assignedHollon.teamId,
        limit: Math.ceil(maxDocuments * 0.6), // 60% from vector
        minSimilarity: 0.7, // Only high similarity results
        docTypes: ['knowledge', 'guide', 'best_practice'],
      },
    );

    // 2. Graph search (relationship-based discovery)
    const graphResults: Document[] = [];
    if (task.parentTaskId) {
      const parentDoc = await this.documentService.findByTaskId(
        task.parentTaskId,
      );
      if (parentDoc) {
        const related = await this.knowledgeGraphService.findRelatedDocuments(
          parentDoc.id,
          {
            depth: 2,
            maxResults: Math.ceil(maxDocuments * 0.4), // 40% from graph
          },
        );
        graphResults.push(...related);
      }
    }

    // 3. RRF (Reciprocal Rank Fusion) merging
    const merged = this.mergeResultsWithRRF(vectorResults, graphResults);

    // 4. Filter by importance and deduplicate
    const filtered = Array.from(
      new Map(
        merged
          .filter(doc => doc.importance >= minImportance)
          .map(doc => [doc.id, doc]),
      ).values(),
    ).slice(0, maxDocuments);

    return filtered;
  }

  /**
   * RRF merging algorithm for combining vector and graph results
   * Higher score = more relevant
   */
  private mergeResultsWithRRF(
    vectorResults: Document[],
    graphResults: Document[],
  ): Document[] {
    const scores = new Map<string, number>();
    const k = 60; // RRF parameter

    // Score vector results
    vectorResults.forEach((doc, index) => {
      const score = scores.get(doc.id) || 0;
      scores.set(doc.id, score + 1 / (k + index + 1));
    });

    // Score graph results
    graphResults.forEach((doc, index) => {
      const score = scores.get(doc.id) || 0;
      scores.set(doc.id, score + 1 / (k + index + 1));
    });

    // Return sorted by RRF score
    return Array.from(scores.entries())
      .map(([docId, score]) => ({
        doc: vectorResults.concat(graphResults).find(d => d.id === docId)!,
        score,
      }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.doc);
  }

  /**
   * Compose final prompt with all layers + retrieved memory
   */
  async composePrompt(
    task: Task,
    hollon: Hollon,
    context: PromptContext,
  ): Promise<string> {
    // Fetch relevant memory using hybrid search
    const memory = await this.fetchRelevantMemories(task, hollon);

    // Build 6-layer prompt
    let prompt = '';

    // Layer 1: Organization
    prompt += `# Organization Context\n${context.organizationPrompt}\n\n`;

    // Layer 2: Team
    prompt += `# Team Context\n${context.teamPrompt}\n\n`;

    // Layer 3: Role
    prompt += `# Your Role\n${context.rolePrompt}\n\n`;

    // Layer 4: Hollon
    prompt += `# Your Background\n${context.hollonPrompt}\n\n`;

    // Layer 5: Long-term Memory (Knowledge System)
    if (memory.length > 0) {
      prompt += `# Relevant Knowledge\n`;
      memory.forEach((doc, index) => {
        prompt += `\n## ${index + 1}. ${doc.title}\n`;
        prompt += `_Importance: ${doc.importance}/10 | Source: ${doc.metadata?.sourceTaskId ? 'Task Completion' : 'Knowledge Base'}_\n`;
        prompt += `${doc.content}\n`;
      });
      prompt += '\n';
    }

    // Layer 6: Current Task
    prompt += `# Current Task\n${context.taskPrompt}\n\n`;

    return prompt;
  }
}
```

**RRF (Reciprocal Rank Fusion) Formula**:
```
RRF(d) = Σ(1 / (k + rank(d, S)))
```
Where:
- `rank(d, S)` = rank of document d in result set S (1-indexed)
- `k` = RRF parameter (typically 60)
- Multiple result sets are combined by summing RRF scores

**Memory Retrieval Pipeline**:
```
Task Input
    ↓
Extract Keywords (title, description, tags)
    ↓
├─ Vector Search (semantic) → 6 documents
├─ Graph Search (relationships) → 4 documents
    ↓
RRF Merging (combine rankings)
    ↓
Filter by importance (≥3/10)
    ↓
Sort by importance + relevance
    ↓
Select top 10 documents
    ↓
Inject into prompt (Layer 5)
```

**Success Criteria**:
- [ ] PromptComposerService integration complete
- [ ] Memory injection working for all task types
- [ ] RRF merging producing optimal ranking
- [ ] Retrieval latency <500ms for full pipeline

---

### Phase 4.2: Real-time Collaboration (Week 3-4)

#### Work Item 5: Channel Entity and Collaboration Service

**Objective**: Implement real-time group communication and team coordination.

**Location**: `apps/server/src/modules/channel/`

**Core Entities**:

```typescript
@Entity('channels')
export class Channel {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string; // "general", "incidents", "team-updates", etc.

  @Column({ type: 'text' })
  description: string;

  @ManyToOne(() => Team, { eager: true })
  @JoinColumn()
  team: Team;

  @ManyToMany(() => Hollon, { eager: true })
  @JoinTable()
  members: Hollon[];

  @Column({ type: 'enum', enum: ['public', 'private'], default: 'public' })
  visibility: 'public' | 'private';

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    purpose?: string; // 'alerts', 'updates', 'discussion', 'incidents'
    archivePolicy?: 'never' | '30_days' | '90_days';
    allowBots?: boolean;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('channel_messages')
export class ChannelMessage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Channel)
  @JoinColumn()
  channel: Channel;

  @ManyToOne(() => Hollon, { nullable: true })
  @JoinColumn()
  sender: Hollon | null; // null = system message

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: {
    type?: 'normal' | 'alert' | 'system' | 'recommendation';
    severity?: 'low' | 'medium' | 'high' | 'critical';
    relatedTaskId?: string;
    relatedDocumentId?: string;
  };

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

**Channel Service**:

```typescript
@Injectable()
export class ChannelService {
  async createChannel(
    data: CreateChannelDto,
    createdBy: Hollon,
  ): Promise<Channel> {
    const channel = this.channelRepository.create({
      ...data,
      team: { id: data.teamId },
      members: [createdBy],
    });
    return this.channelRepository.save(channel);
  }

  async addMessage(
    channelId: string,
    content: string,
    sender: Hollon | null,
    metadata?: ChannelMessage['metadata'],
  ): Promise<ChannelMessage> {
    const message = this.messageRepository.create({
      channel: { id: channelId },
      sender,
      content,
      metadata,
    });
    return this.messageRepository.save(message);
  }

  async sendSystemAlert(
    channel: Channel,
    alert: {
      title: string;
      message: string;
      severity: 'low' | 'medium' | 'high' | 'critical';
      relatedTaskId?: string;
    },
  ): Promise<ChannelMessage> {
    const content = `🚨 **${alert.title}**\n\n${alert.message}`;
    return this.addMessage(channel.id, content, null, {
      type: 'alert',
      severity: alert.severity,
      relatedTaskId: alert.relatedTaskId,
    });
  }

  async getChannelMessages(
    channelId: string,
    options: {
      limit?: number;
      offset?: number;
      startDate?: Date;
      endDate?: Date;
    } = {},
  ): Promise<ChannelMessage[]> {
    const query = this.messageRepository
      .createQueryBuilder('msg')
      .where('msg.channelId = :channelId', { channelId })
      .orderBy('msg.createdAt', 'DESC');

    if (options.startDate) {
      query.andWhere('msg.createdAt >= :startDate', {
        startDate: options.startDate,
      });
    }

    if (options.endDate) {
      query.andWhere('msg.createdAt <= :endDate', { endDate: options.endDate });
    }

    return query
      .limit(options.limit || 50)
      .offset(options.offset || 0)
      .getMany();
  }
}
```

**Standard Channels**:

Every team automatically gets these channels:

```typescript
export const STANDARD_CHANNELS = [
  {
    name: 'general',
    description: 'General team discussions and announcements',
    metadata: { purpose: 'discussion', allowBots: true },
  },
  {
    name: 'team-updates',
    description: 'Automated daily performance updates and alerts',
    metadata: { purpose: 'alerts', allowBots: true },
  },
  {
    name: 'incidents',
    description: 'Critical issues and escalations',
    metadata: { purpose: 'incidents', allowBots: true },
  },
  {
    name: 'random',
    description: 'Off-topic discussions',
    metadata: { purpose: 'discussion', allowBots: false },
  },
];
```

**Success Criteria**:
- [ ] Channel creation and deletion working
- [ ] Message transmission to all members
- [ ] Public/private visibility enforced
- [ ] System alerts delivering correctly
- [ ] Message history queryable with filters

---

#### Work Item 6: Continuous Improvement Service

**Objective**: Replace periodic meetings with event-driven, real-time performance analysis.

**Location**: `apps/server/src/modules/improvement/services/continuous-improvement.service.ts`

**Core Functionality**:

```typescript
@Injectable()
export class ContinuousImprovementService {
  /**
   * Daily automated analysis (02:00 UTC)
   * Collects metrics, checks thresholds, creates improvement tasks
   */
  @Cron('0 2 * * *')
  async analyzeDailyPerformance() {
    this.logger.log('🔍 Starting daily performance analysis');

    const teams = await this.teamService.findAll({
      relations: ['hollons'],
    });

    for (const team of teams) {
      try {
        const metrics = await this.collectMetrics(team);
        const analysis = await this.analyzeMetrics(team, metrics);
        await this.applyImprovements(team, analysis);
      } catch (error) {
        this.logger.error(
          `Failed to analyze team ${team.id}: ${error.message}`,
        );
      }
    }

    this.logger.log('✅ Daily performance analysis completed');
  }

  /**
   * Real-time task completion analysis (event-driven)
   */
  @OnEvent('task.completed')
  async onTaskCompleted(event: TaskCompletedEvent) {
    const { task, hollon } = event;

    try {
      // 1. Extract knowledge automatically
      await this.knowledgeExtractionService.extractFromCompletedTask(task);

      // 2. Update performance metrics
      const performance = await this.performanceAnalyzerService.analyzeTaskCompletion(
        hollon.id,
        task.id,
      );

      // 3. Check for anomalies
      if (performance.speed > 2.0 || performance.quality < 70) {
        await this.alertTeamOfAnomaly(hollon.team, performance);
      }

      // 4. Extract best practices if quality is high
      if (performance.quality > 90) {
        await this.bestPracticeService.extractPatternsFromTask(task);
      }
    } catch (error) {
      this.logger.error(
        `Failed to analyze task completion for ${task.id}: ${error.message}`,
      );
    }
  }

  /**
   * Collect metrics for a team
   */
  private async collectMetrics(
    team: Team,
  ): Promise<{
    completedTasks: number;
    avgCompletionTime: number;
    escalationRate: number;
    blockedTasks: number;
    incidentCount: number;
    teamSize: number;
    activeHollons: number;
  }> {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const completedTasks = await this.taskService.count({
      where: {
        team: { id: team.id },
        status: 'COMPLETED',
        completedAt: MoreThan(yesterday),
      },
    });

    const escalations = await this.escalationService.count({
      where: {
        task: { team: { id: team.id } },
        createdAt: MoreThan(yesterday),
      },
    });

    const blockedTasks = await this.taskService.count({
      where: {
        team: { id: team.id },
        status: 'BLOCKED',
      },
    });

    const incidents = await this.incidentService.count({
      where: {
        team: { id: team.id },
        createdAt: MoreThan(yesterday),
      },
    });

    const avgCompletionTime =
      completedTasks > 0
        ? (await this.taskService
            .createQueryBuilder('task')
            .select('AVG(task.completedAt - task.startedAt)', 'avg')
            .where('task.teamId = :teamId', { teamId: team.id })
            .andWhere('task.status = :status', { status: 'COMPLETED' })
            .andWhere('task.completedAt > :yesterday', { yesterday })
            .getRawOne()
            .then(r => r.avg || 0)) / 3600 // Convert to hours
        : 0;

    return {
      completedTasks,
      avgCompletionTime,
      escalationRate: completedTasks > 0 ? escalations / completedTasks : 0,
      blockedTasks,
      incidentCount: incidents,
      teamSize: team.hollons.length,
      activeHollons: team.hollons.filter(h => h.status === 'active').length,
    };
  }

  /**
   * Analyze metrics and identify problems
   */
  private async analyzeMetrics(
    team: Team,
    metrics: ReturnType<typeof this.collectMetrics>,
  ): Promise<{
    summary: string;
    recommendations: string[];
    alertSeverity: 'low' | 'medium' | 'high';
    issues: Array<{
      type: string;
      description: string;
      metric: string;
      current: number;
      threshold: number;
    }>;
  }> {
    const issues: ReturnType<typeof this.analyzeMetrics>['issues'] = [];
    let summary = `📊 **Daily Performance Report - ${team.name}**\n\n`;
    summary += `✅ Tasks Completed: ${metrics.completedTasks}\n`;
    summary += `⏱️ Avg Time: ${metrics.avgCompletionTime.toFixed(1)}h\n`;
    summary += `📈 Escalation Rate: ${(metrics.escalationRate * 100).toFixed(1)}%\n`;
    summary += `🚧 Blocked: ${metrics.blockedTasks}\n`;
    summary += `🔴 Incidents: ${metrics.incidentCount}\n\n`;

    let alertSeverity: 'low' | 'medium' | 'high' = 'low';

    // Check escalation rate
    if (metrics.escalationRate > 0.3) {
      issues.push({
        type: 'escalation_rate',
        description:
          'High escalation rate indicates frequent blockers or complexity issues',
        metric: 'escalationRate',
        current: metrics.escalationRate,
        threshold: 0.3,
      });
      alertSeverity = 'medium';
    }

    // Check blocked tasks
    if (metrics.blockedTasks > 5) {
      issues.push({
        type: 'blocked_tasks',
        description:
          'Multiple blocked tasks suggest dependency or capacity issues',
        metric: 'blockedTasks',
        current: metrics.blockedTasks,
        threshold: 5,
      });
      alertSeverity = 'high';
    }

    // Check incidents
    if (metrics.incidentCount > 3) {
      issues.push({
        type: 'incidents',
        description: 'High incident count requires investigation',
        metric: 'incidentCount',
        current: metrics.incidentCount,
        threshold: 3,
      });
      alertSeverity = 'high';
    }

    const recommendations: string[] = [];
    if (issues.some(i => i.type === 'escalation_rate')) {
      recommendations.push('- Review task complexity and consider splitting');
      recommendations.push('- Increase knowledge sharing on recurring issues');
    }

    if (issues.some(i => i.type === 'blocked_tasks')) {
      recommendations.push('- Prioritize unblocking dependencies');
      recommendations.push('- Pair block hollon with expert for assistance');
    }

    if (issues.some(i => i.type === 'incidents')) {
      recommendations.push('- Schedule incident postmortem');
      recommendations.push('- Extract learnings to knowledge base');
    }

    return {
      summary,
      recommendations,
      alertSeverity,
      issues,
    };
  }

  /**
   * Apply improvements based on analysis
   */
  private async applyImprovements(
    team: Team,
    analysis: ReturnType<typeof this.analyzeMetrics>,
  ) {
    // Send summary to channel
    const channel = await this.channelService.findByTeamAndName(
      team.id,
      'team-updates',
    );

    if (channel) {
      let message = analysis.summary;
      if (analysis.recommendations.length > 0) {
        message += '\n**Recommendations:**\n';
        message += analysis.recommendations.join('\n');
      }

      await this.channelService.addMessage(
        channel.id,
        message,
        null,
        {
          type: 'alert',
          severity: analysis.alertSeverity,
        },
      );
    }

    // Create improvement tasks for high severity
    if (analysis.alertSeverity === 'high') {
      for (const issue of analysis.issues) {
        const improvementTask = await this.taskService.create({
          title: `[AUTO] ${issue.description}`,
          description: `Issue: ${issue.type}\nCurrent: ${issue.current} (threshold: ${issue.threshold})`,
          type: 'research',
          team: team,
          assignedToTeam: true,
          priority: 'P0',
          status: 'READY',
          metadata: {
            autoGenerated: true,
            triggeredBy: 'continuous-improvement',
          },
        });

        this.logger.log(
          `Created improvement task ${improvementTask.id} for issue ${issue.type}`,
        );
      }
    }
  }

  /**
   * Alert team of anomalies in real-time
   */
  private async alertTeamOfAnomaly(
    team: Team,
    performance: any,
  ) {
    const channel = await this.channelService.findByTeamAndName(
      team.id,
      'general',
    );

    if (channel) {
      let alert = '⚠️ **Performance Anomaly Detected**\n\n';

      if (performance.speed > 2.0) {
        alert += `⏱️ Task took ${performance.speed.toFixed(1)}x longer than estimated\n`;
      }

      if (performance.quality < 70) {
        alert += `❌ Quality score is low (${performance.quality.toFixed(0)}/100)\n`;
      }

      await this.channelService.addMessage(channel.id, alert, null, {
        type: 'alert',
        severity: performance.quality < 70 ? 'high' : 'medium',
      });
    }
  }
}
```

**Metrics Dashboard** (Real-time):

```typescript
interface TeamMetricsSnapshot {
  teamId: string;
  timestamp: Date;
  metrics: {
    completedTasks: number;
    avgCompletionTime: number;
    escalationRate: number;
    blockedTasks: number;
    incidents: number;
  };
  healthScore: number; // 0-100
  trends: {
    escalationTrend: 'improving' | 'stable' | 'degrading';
    velocityTrend: 'improving' | 'stable' | 'degrading';
    qualityTrend: 'improving' | 'stable' | 'degrading';
  };
}
```

**Success Criteria**:
- [ ] Daily analysis runs at 02:00 UTC consistently
- [ ] Real-time task completion analysis <1s
- [ ] Channel alerts delivering correctly
- [ ] Improvement tasks created automatically
- [ ] 60% reduction in manual status meeting overhead

---

### Phase 4.3: Self-Improvement (Week 5-6)

#### Work Item 7: Performance Analysis and Optimization System

**Objective**: Multi-component system enabling Hollon self-analysis and continuous improvement.

**Location**: `apps/server/src/modules/performance/`

##### 7A. PerformanceAnalyzer Service

```typescript
@Injectable()
export class PerformanceAnalyzerService {
  /**
   * Analyze individual task completion performance
   */
  async analyzeTaskCompletion(
    hollonId: string,
    taskId: string,
  ): Promise<{
    duration: number; // seconds
    estimatedDuration: number;
    speed: number; // actual / estimated ratio
    qualityScore: number; // 0-100
    escalations: number;
    reviewCycles: number;
    performanceRating: 'excellent' | 'good' | 'acceptable' | 'needs_improvement';
  }> {
    const task = await this.taskService.findOne(taskId);
    const hollon = await this.hollonService.findOne(hollonId);

    const duration =
      task.completedAt.getTime() - task.startedAt.getTime() / 1000;
    const estimatedDuration = task.estimatedDuration * 3600; // Convert hours to seconds
    const speed = duration / estimatedDuration;

    const qualityScore = await this.calculateQualityScore(task);
    const escalations = task.escalations?.length || 0;
    const reviewCycles = task.reviewCount || 0;

    let performanceRating: 'excellent' | 'good' | 'acceptable' | 'needs_improvement';
    if (speed < 0.8 && qualityScore > 90) {
      performanceRating = 'excellent';
    } else if (speed < 1.2 && qualityScore > 80) {
      performanceRating = 'good';
    } else if (speed < 1.5 && qualityScore > 70) {
      performanceRating = 'acceptable';
    } else {
      performanceRating = 'needs_improvement';
    }

    // Update HollonPerformanceSummary
    await this.updateHollonPerformanceSummary(hollon, {
      duration,
      estimatedDuration,
      speed,
      qualityScore,
      escalations,
      reviewCycles,
      rating: performanceRating,
    });

    return {
      duration,
      estimatedDuration,
      speed,
      qualityScore,
      escalations,
      reviewCycles,
      performanceRating,
    };
  }

  /**
   * Calculate quality score (0-100) based on multiple factors
   */
  private async calculateQualityScore(task: Task): Promise<number> {
    let score = 50; // base score

    // Code quality (if applicable)
    if (task.pullRequests?.length > 0) {
      const avgQuality =
        task.pullRequests.reduce((sum, pr) => sum + (pr.qualityScore || 0), 0) /
        task.pullRequests.length;
      score += avgQuality * 0.3; // 30% weight
    }

    // Review feedback
    if (task.reviews?.length > 0) {
      const avgRating =
        task.reviews.reduce((sum, r) => sum + (r.rating || 0), 0) /
        task.reviews.length;
      score += avgRating * 0.2; // 20% weight
    }

    // Task completion without escalations
    if (!task.escalations || task.escalations.length === 0) {
      score += 10; // 10 point bonus
    } else {
      score -= task.escalations.length * 5;
    }

    // On-time completion
    if (task.completedAt <= task.dueDate) {
      score += 5;
    }

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate productivity score for a period
   */
  async calculateProductivityScore(
    hollonId: string,
    period: 'week' | 'month',
  ): Promise<{
    score: number; // 0-100
    completedTasks: number;
    avgQuality: number;
    timelineAdherence: number; // percentage
    trend: 'improving' | 'stable' | 'degrading';
  }> {
    const days = period === 'week' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const tasks = await this.taskService.find({
      where: {
        assignedHollon: { id: hollonId },
        status: 'COMPLETED',
        completedAt: MoreThan(startDate),
      },
    });

    if (tasks.length === 0) {
      return {
        score: 50,
        completedTasks: 0,
        avgQuality: 0,
        timelineAdherence: 0,
        trend: 'stable',
      };
    }

    const avgQuality =
      tasks.reduce((sum, t) => sum + (t.qualityScore || 0), 0) / tasks.length;
    const onTimeCount = tasks.filter(t => t.completedAt <= t.dueDate).length;
    const timelineAdherence = (onTimeCount / tasks.length) * 100;

    const score = (avgQuality * 0.7 + timelineAdherence * 0.3);

    // Compare to previous period for trend
    const prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - days);
    const prevEndDate = new Date(startDate);

    const prevTasks = await this.taskService.find({
      where: {
        assignedHollon: { id: hollonId },
        status: 'COMPLETED',
        completedAt: Between(prevStartDate, prevEndDate),
      },
    });

    let trend: 'improving' | 'stable' | 'degrading' = 'stable';
    if (prevTasks.length > 0) {
      const prevScore =
        prevTasks.reduce((sum, t) => sum + (t.qualityScore || 0), 0) /
        prevTasks.length;
      if (score > prevScore * 1.05) {
        trend = 'improving';
      } else if (score < prevScore * 0.95) {
        trend = 'degrading';
      }
    }

    return {
      score,
      completedTasks: tasks.length,
      avgQuality,
      timelineAdherence,
      trend,
    };
  }

  /**
   * Identify high performers for pattern extraction
   */
  async findTopPerformers(
    teamId: string,
    options: { percentile: number; period: 'week' | 'month' } = {
      percentile: 20,
      period: 'month',
    },
  ): Promise<Task[]> {
    const days = options.period === 'week' ? 7 : 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const allTasks = await this.taskService.find({
      where: {
        team: { id: teamId },
        status: 'COMPLETED',
        completedAt: MoreThan(startDate),
      },
      relations: ['assignedHollon', 'reviews'],
    });

    // Sort by quality score
    allTasks.sort((a, b) => (b.qualityScore || 0) - (a.qualityScore || 0));

    // Select top percentile
    const count = Math.max(1, Math.ceil(allTasks.length * (options.percentile / 100)));
    return allTasks.slice(0, count);
  }
}
```

##### 7B. PromptOptimizer Service

```typescript
@Injectable()
export class PromptOptimizerService {
  /**
   * Analyze prompt effectiveness using A/B testing
   */
  async analyzePromptEffectiveness(
    hollon: Hollon,
    tasks: Task[],
  ): Promise<{
    variants: Array<{
      promptTemplate: string;
      count: number;
      avgQuality: number;
      avgTokens: number;
      costPerTask: number;
    }>;
    winner: string | null;
    confidence: number;
  }> {
    // Group tasks by prompt template
    const variants = new Map<
      string,
      { tasks: Task[]; avgQuality: number; avgTokens: number }
    >();

    for (const task of tasks) {
      const template =
        task.metadata?.promptTemplateId || 'default';

      if (!variants.has(template)) {
        variants.set(template, { tasks: [], avgQuality: 0, avgTokens: 0 });
      }

      variants.get(template)!.tasks.push(task);
    }

    // Calculate metrics for each variant
    const results = Array.from(variants.entries()).map(([template, data]) => {
      const avgQuality =
        data.tasks.reduce((sum, t) => sum + (t.qualityScore || 0), 0) /
        data.tasks.length;
      const avgTokens =
        data.tasks.reduce(
          (sum, t) => sum + (t.metadata?.totalTokens || 0),
          0,
        ) / data.tasks.length;

      return {
        promptTemplate: template,
        count: data.tasks.length,
        avgQuality,
        avgTokens,
        costPerTask: (avgTokens * 0.00001), // Rough estimate
      };
    });

    // Perform statistical significance test (t-test)
    let winner = null;
    let confidence = 0;

    if (results.length === 2) {
      const [a, b] = results;
      if (a.count >= 5 && b.count >= 5) {
        const tScore = this.calculateTTest(
          variants.get(a.promptTemplate)!.tasks.map(t => t.qualityScore || 0),
          variants.get(b.promptTemplate)!.tasks.map(t => t.qualityScore || 0),
        );

        // p-value < 0.05 means significant difference
        confidence = Math.min(0.99, Math.max(0, 1 - Math.abs(tScore) / 10));

        if (confidence > 0.8) {
          winner = a.avgQuality > b.avgQuality ? a.promptTemplate : b.promptTemplate;
        }
      }
    }

    return {
      variants: results,
      winner,
      confidence,
    };
  }

  /**
   * Suggest prompt optimizations
   */
  async suggestOptimizations(
    hollon: Hollon,
  ): Promise<{
    currentTokenUsage: number;
    optimizedTokenUsage: number;
    savings: number; // percentage
    suggestedChanges: string[];
  }> {
    // Analyze recent tasks
    const recentTasks = await this.taskService.find({
      where: {
        assignedHollon: { id: hollon.id },
        status: 'COMPLETED',
        completedAt: MoreThan(
          new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        ),
      },
      order: { completedAt: 'DESC' },
      take: 20,
    });

    if (recentTasks.length === 0) {
      return {
        currentTokenUsage: 0,
        optimizedTokenUsage: 0,
        savings: 0,
        suggestedChanges: [],
      };
    }

    const currentTokenUsage =
      recentTasks.reduce((sum, t) => sum + (t.metadata?.totalTokens || 0), 0) /
      recentTasks.length;

    // Use Brain Provider to analyze optimization opportunities
    const analysis = await this.brainProvider.executeWithTracking({
      systemPrompt: `You are an LLM optimization expert. Analyze prompt usage patterns and suggest optimizations.
        
Target: 15% token reduction while maintaining quality.
        
Focus on:
1. Removing redundant context
2. Using structured formats instead of prose
3. Batching related queries
4. Caching common analyses`,
      userPrompt: `Analyze these task metrics and suggest optimizations:
        
Token usage: ${currentTokenUsage.toFixed(0)} per task
Quality: ${recentTasks.map(t => t.qualityScore).join(', ')}
Task types: ${Array.from(new Set(recentTasks.map(t => t.type))).join(', ')}
        
Suggest specific optimizations.`,
      maxTokens: 500,
    });

    const suggestions =
      analysis.output
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.trim()) || [];

    const optimizedTokenUsage = currentTokenUsage * 0.85; // 15% savings target

    return {
      currentTokenUsage: Math.round(currentTokenUsage),
      optimizedTokenUsage: Math.round(optimizedTokenUsage),
      savings: 15,
      suggestedChanges: suggestions,
    };
  }

  /**
   * Simple t-test implementation
   */
  private calculateTTest(sample1: number[], sample2: number[]): number {
    const mean1 = sample1.reduce((a, b) => a + b, 0) / sample1.length;
    const mean2 = sample2.reduce((a, b) => a + b, 0) / sample2.length;

    const variance1 =
      sample1.reduce((sum, x) => sum + Math.pow(x - mean1, 2), 0) /
      (sample1.length - 1);
    const variance2 =
      sample2.reduce((sum, x) => sum + Math.pow(x - mean2, 2), 0) /
      (sample2.length - 1);

    const pooledStdDev = Math.sqrt(
      (variance1 / sample1.length + variance2 / sample2.length),
    );

    return (mean1 - mean2) / pooledStdDev;
  }
}
```

##### 7C. BestPractice Service

```typescript
@Injectable()
export class BestPracticeService {
  /**
   * Extract patterns from high-performing tasks
   */
  async extractPatternsFromHighPerformance(
    team: Team,
  ): Promise<{
    patterns: string[];
    commonElements: {
      architecture: string[];
      testingApproaches: string[];
      collaborationMethods: string[];
      toolsUsed: string[];
    };
    document: Document;
  }> {
    // Select top 20% performing tasks
    const topTasks = await this.performanceAnalyzer.findTopPerformers(
      team.id,
      { percentile: 20, period: 'month' },
    );

    if (topTasks.length === 0) {
      return {
        patterns: [],
        commonElements: {
          architecture: [],
          testingApproaches: [],
          collaborationMethods: [],
          toolsUsed: [],
        },
        document: null,
      };
    }

    // Analyze patterns with Brain Provider
    const patterns = await this.brainProvider.executeWithTracking({
      systemPrompt: `You are a software architecture and process expert. 
        Analyze task completion patterns and extract best practices.
        Focus on reproducible patterns that lead to success.`,
      userPrompt: `Analyze these high-performance tasks:
        
${topTasks
  .map(
    t => `
Task: ${t.title}
Description: ${t.description}
Quality Score: ${t.qualityScore}
Complexity: ${t.metadata?.complexity || 'unknown'}
Time Taken: ${((t.completedAt.getTime() - t.startedAt.getTime()) / 3600000).toFixed(1)}h
Dependencies: ${t.dependencies?.map(d => d.title).join(', ') || 'none'}`,
  )
  .join('\n')}

Extract:
1. Common code/architecture patterns
2. Testing approaches
3. Collaboration methods
4. Tools and libraries frequently used
5. Lessons learned`,
      maxTokens: 1000,
    });

    // Create best practice document
    const content = `# Best Practices - ${team.name}

${patterns.output}

## Key Takeaways

1. These patterns were identified from the top 20% of completed tasks
2. Consider adopting these practices in similar future tasks
3. Ensure new team members learn these patterns during onboarding`;

    const document = await this.documentService.create({
      title: `Best Practices - ${team.name}`,
      content,
      docType: 'guide',
      scope: 'team',
      scopeId: team.id,
      keywords: ['best-practice', 'patterns', 'high-performance'],
      importance: 9,
      autoGenerated: true,
      metadata: {
        sourceType: 'performance-analysis',
        extractedAt: new Date(),
        sampledTasks: topTasks.length,
      },
    });

    return {
      patterns: patterns.output.split('\n').slice(0, 10),
      commonElements: {
        architecture: [],
        testingApproaches: [],
        collaborationMethods: [],
        toolsUsed: [],
      },
      document,
    };
  }

  /**
   * Apply best practices to new tasks
   */
  async applyBestPracticesToTask(task: Task, team: Team): Promise<void> {
    // Find team's best practice document
    const bestPracticeDoc = await this.documentService.findOne({
      where: {
        scope: 'team',
        scopeId: team.id,
        docType: 'guide',
        keywords: Like('%best-practice%'),
      },
    });

    if (bestPracticeDoc) {
      // Inject into prompt context
      task.metadata = task.metadata || {};
      task.metadata.bestPractices = bestPracticeDoc.id;
      await this.taskService.update(task.id, task);
    }
  }
}
```

**Success Criteria**:
- [ ] Performance metrics collected for 100% of tasks
- [ ] Prompt optimization achieving 15% token savings
- [ ] Best practice documents auto-generated monthly
- [ ] Task efficiency improved by 20% on repeated tasks
- [ ] Statistical analysis (t-test) working correctly

---

## Architecture Layers

### 1. Data Layer (PostgreSQL)

```
┌─────────────────────────────────────┐
│         PostgreSQL Database         │
├─────────────────────────────────────┤
│ Tables:                             │
│ - documents                         │ Main knowledge store
│ - document_relationships            │ Graph edges
│ - channel_messages                  │ Team communication
│ - performance_summaries             │ Metrics storage
│ - embedding_cache                   │ Vector pre-computation
└─────────────────────────────────────┘
```

### 2. Service Layer (NestJS)

**Knowledge Services**:
- KnowledgeExtractionService
- VectorSearchService
- KnowledgeGraphService

**Collaboration Services**:
- ChannelService
- ContinuousImprovementService

**Analysis Services**:
- PerformanceAnalyzerService
- PromptOptimizerService
- BestPracticeService

### 3. Integration Layer

**External APIs**:
- OpenAI (embeddings)
- Claude API (Brain Provider)

**Internal Integrations**:
- PromptComposerService (memory injection)
- TaskService (knowledge extraction events)
- HollonService (performance tracking)

### 4. Presentation Layer

**REST APIs**:
- SearchController (knowledge search)
- RecommendationController (recommendations)
- ChannelController (team communication)
- AnalyticsController (performance dashboards)

**CLI Tool**:
- `hollon-cli search <query>`
- `hollon-cli recommendations`
- `hollon-cli performance --hollon <id>`

---

## Search Indexing Strategy

### Indexing Pipeline

```
Task Completion/Decision/Review
    │
    ▼
KnowledgeExtractionService
├─ Extract keywords
├─ Generate summary
├─ Calculate importance
    │
    ▼
DocumentService.create()
├─ Store metadata
├─ Queue embedding generation
    │
    ▼
VectorSearchService.generateEmbedding()
├─ Call OpenAI API
├─ Cache in document.embedding
    │
    ▼
KnowledgeGraphService.extractRelationships()
├─ Find document references
├─ LLM-based relationship detection
├─ Store relationships
    │
    ▼
Ready for Search & Retrieval
```

### Index Types

| Index | Purpose | Implementation |
|-------|---------|-----------------|
| **Vector Index** | Semantic similarity | pgvector IVFFLAT |
| **Keyword Index** | Full-text search | PostgreSQL TSVECTOR |
| **Relationship Index** | Graph traversal | Document_relationships PK |
| **Time Index** | Temporal queries | documents.createdAt |
| **Scope Index** | Filtering by scope | Composite (scope, scopeId) |

### Index Configuration

```sql
-- Vector similarity search
CREATE INDEX ix_document_embedding
ON documents USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Full-text search
CREATE INDEX ix_document_fts
ON documents USING GIN (to_tsvector('english', content));

-- Scope-based filtering
CREATE INDEX ix_document_scope
ON documents (scope, "scopeId", "docType");

-- Temporal queries
CREATE INDEX ix_document_created
ON documents ("createdAt" DESC);

-- Relationship lookups
CREATE INDEX ix_relationship_from
ON document_relationships ("fromDocumentId");

CREATE INDEX ix_relationship_to
ON document_relationships ("toDocumentId");
```

---

## Recommendation Engine

### Recommendation Types

#### 1. Knowledge Recommendations

**Trigger**: New task assigned to hollon

**Logic**:
```typescript
async getKnowledgeRecommendations(task: Task): Promise<Document[]> {
  // 1. Vector search (semantic match)
  const vectorDocs = await vectorSearch(task.title);
  
  // 2. Graph search (related to parent task)
  const graphDocs = await graphSearch(task.parentTaskId);
  
  // 3. RRF merging
  return mergeWithRRF(vectorDocs, graphDocs);
}
```

#### 2. Team Recommendations

**Trigger**: Task escalation or blocker

**Logic**:
```typescript
async getTeamRecommendations(task: Task): Promise<Hollon[]> {
  // 1. Find hollons who completed similar tasks
  const similarTasks = await findSimilarCompletedTasks(task);
  
  // 2. Rank by expertise and availability
  return rankHollonsByExpertise(similarTasks);
}
```

#### 3. Process Recommendations

**Trigger**: Daily performance analysis

**Logic**:
```typescript
async getProcessRecommendations(team: Team): Promise<string[]> {
  // 1. Collect metrics
  const metrics = await collectMetrics(team);
  
  // 2. Identify patterns and issues
  const issues = analyzeMetrics(metrics);
  
  // 3. Generate recommendations
  return generateRecommendations(issues);
}
```

#### 4. Best Practice Recommendations

**Trigger**: Task type matches high-performing patterns

**Logic**:
```typescript
async getBestPracticeRecommendations(task: Task): Promise<Document[]> {
  // 1. Find team's best practice documents
  const bestPractices = await findBestPractices(task.team);
  
  // 2. Filter by task type
  return bestPractices.filter(bp => bp.metadata.taskTypes.includes(task.type));
}
```

### Recommendation Scoring

```
Score = (Relevance × 0.4) + (Importance × 0.3) + (Recency × 0.2) + (Quality × 0.1)

Where:
- Relevance: 0-100 (vector similarity or keyword match)
- Importance: 0-10 (document importance score)
- Recency: 0-1 (exponential decay by days old)
- Quality: 0-100 (average quality of related completions)
```

---

## API Specification

### Knowledge Search API

```http
POST /api/knowledge/search
Content-Type: application/json

{
  "query": "JWT authentication implementation",
  "scope": "project",
  "scopeId": "proj_123",
  "limit": 10,
  "minSimilarity": 0.7,
  "docTypes": ["knowledge", "guide"]
}

Response:
{
  "results": [
    {
      "id": "doc_1",
      "title": "JWT Implementation Guide",
      "content": "...",
      "similarity": 0.92,
      "importance": 9,
      "createdAt": "2025-12-20T10:00:00Z"
    },
    ...
  ],
  "queryTime": 145,  // milliseconds
  "totalResults": 23
}
```

### Recommendation API

```http
GET /api/recommendations/task/:taskId
Authorization: Bearer token

Response:
{
  "taskId": "task_456",
  "recommendations": {
    "knowledge": [
      {
        "type": "document",
        "id": "doc_1",
        "title": "...",
        "reason": "Similar to completed tasks"
      }
    ],
    "team": [
      {
        "type": "hollon",
        "id": "hollon_123",
        "name": "Alice",
        "reason": "Completed 3 similar tasks"
      }
    ],
    "bestPractices": [
      {
        "type": "document",
        "id": "doc_2",
        "title": "...",
        "reason": "Team best practice for this type"
      }
    ]
  }
}
```

### Performance Analytics API

```http
GET /api/analytics/team/:teamId/performance
Authorization: Bearer token
Query: ?period=week&metrics=completedTasks,escalationRate,quality

Response:
{
  "teamId": "team_123",
  "period": "week",
  "metrics": {
    "completedTasks": 24,
    "avgCompletionTime": 3.2,
    "escalationRate": 0.15,
    "blockedTasks": 2,
    "incidentCount": 1,
    "healthScore": 82
  },
  "trends": {
    "escalationTrend": "improving",
    "velocityTrend": "stable",
    "qualityTrend": "improving"
  },
  "topPerformers": [
    {
      "hollonId": "hollon_123",
      "name": "Alice",
      "score": 95,
      "completedTasks": 8
    }
  ]
}
```

### Channel API

```http
POST /api/channels/:channelId/messages
Content-Type: application/json

{
  "content": "Performance alert: high escalation rate",
  "metadata": {
    "type": "alert",
    "severity": "high"
  }
}

Response:
{
  "id": "msg_789",
  "channelId": "channel_123",
  "sender": null,  // System message
  "content": "...",
  "createdAt": "2025-12-23T10:00:00Z"
}
```

---

## Caching Strategy

### Cache Layers

#### 1. Vector Embedding Cache

**What**: Pre-computed embeddings for all documents

**Where**: PostgreSQL `documents.embedding` column

**TTL**: Permanent (invalidated on document update)

**Hit Rate Target**: 100% (all embeddings pre-computed)

```typescript
// On document creation
const embedding = await vectorService.generateEmbedding(text);
doc.embedding = embedding;
await documentRepository.save(doc);

// On vector search
const results = await queryBuilder
  .orderBy('doc.embedding <=> :embedding')
  .getMany();  // No API call needed
```

#### 2. Search Results Cache

**What**: Cached vector search results by query

**Where**: Redis with 1-hour TTL

**Key Format**: `search:${hash(query)}:${scopeId}`

**Hit Rate Target**: 60-70% (many unique queries)

```typescript
const cacheKey = `search:${hashFunction(query)}:${scopeId}`;
let results = await redisClient.get(cacheKey);

if (!results) {
  results = await vectorSearchService.vectorSimilaritySearch(query);
  await redisClient.setex(cacheKey, 3600, JSON.stringify(results));
}
```

#### 3. Graph Traversal Cache

**What**: Cached relationship lookups for graph navigation

**Where**: Redis with 6-hour TTL

**Key Format**: `graph:${documentId}:depth:${depth}`

**Hit Rate Target**: 40-50% (common document references)

```typescript
const cacheKey = `graph:${documentId}:depth:${depth}`;
let related = await redisClient.get(cacheKey);

if (!related) {
  related = await graphService.findRelatedDocuments(documentId, depth);
  await redisClient.setex(cacheKey, 21600, JSON.stringify(related));
}
```

#### 4. Metrics Cache

**What**: Aggregated team metrics

**Where**: Redis with 1-hour TTL (or updated real-time on task completion)

**Key Format**: `metrics:team:${teamId}:${period}`

**Hit Rate Target**: 95%+ (few daily changes)

```typescript
@OnEvent('task.completed')
async invalidateMetricsCache(event: TaskCompletedEvent) {
  const { task } = event;
  await redisClient.del(`metrics:team:${task.team.id}:*`);
  // Recalculate immediately for analytics
}
```

#### 5. Best Practice Cache

**What**: Team best practice documents

**Where**: Application memory (in-memory cache) with daily refresh

**TTL**: 24 hours

**Hit Rate Target**: 90%+

```typescript
@Cron('0 0 * * *')  // Daily at midnight
async refreshBestPracticesCache() {
  const teams = await teamService.findAll();
  for (const team of teams) {
    const bp = await documentService.findBestPractices(team.id);
    this.bestPracticeCache.set(team.id, bp);
  }
}
```

### Cache Invalidation Strategy

| Cache | Event | Action |
|-------|-------|--------|
| **Embeddings** | Document updated | Delete + regenerate |
| **Search Results** | New document created | Delete query cache |
| **Graph Traversal** | Relationship added | Delete related caches |
| **Metrics** | Task completed | Invalidate team metrics |
| **Best Practices** | High performance task | Invalidate team BP |

### Cache Configuration

```typescript
// apps/server/src/config/cache.config.ts

export const CACHE_CONFIG = {
  embeddings: {
    type: 'database',  // pgvector
    ttl: 'permanent',
    invalidateOn: ['document.updated'],
  },
  searchResults: {
    type: 'redis',
    ttl: 3600,  // 1 hour
    maxSize: 10000,  // entries
    invalidateOn: ['document.created', 'document.deleted'],
  },
  graphTraversal: {
    type: 'redis',
    ttl: 21600,  // 6 hours
    maxSize: 5000,
    invalidateOn: ['document_relationship.created', 'document_relationship.deleted'],
  },
  metrics: {
    type: 'redis',
    ttl: 3600,  // 1 hour
    maxSize: 1000,
    invalidateOn: ['task.completed'],
  },
  bestPractices: {
    type: 'memory',
    ttl: 86400,  // 24 hours
    maxSize: 100,
    invalidateOn: ['performance.analyzed'],
  },
};
```

---

## Dependency Map

### Service Dependencies

```
┌─────────────────────────────────────────────────────────┐
│              API Layer (Controllers)                    │
├─────────────────────────────────────────────────────────┤
│ SearchController        RecommendationController        │
│ ChannelController       AnalyticsController             │
└──────────────┬──────────────────────┬──────────────────┘
               │                      │
         ┌─────▼──────────┬───────────▼─────────┐
         │                │                     │
    ┌────▼────────┐  ┌────▼────────┐  ┌────────▼────┐
    │ Knowledge   │  │ Collaboration│  │ Analysis    │
    │ Services    │  │ Services     │  │ Services    │
    ├─────────────┤  ├──────────────┤  ├─────────────┤
    │ - Extract   │  │ - Channel    │  │ - Performance
    │ - Vector    │  │ - Continuous │  │ - Optimizer
    │ - Graph     │  │   Improvement│  │ - BestPract
    └────┬────────┘  └────┬─────────┘  └────┬────────┘
         │                │                  │
         └────────────────┼──────────────────┘
                          │
                    ┌─────▼──────────────┐
                    │ Document Service   │
                    │ TaskService        │
                    │ HollonService      │
                    │ TeamService        │
                    └─────┬──────────────┘
                          │
                    ┌─────▼──────────────┐
                    │ PostgreSQL + Cache │
                    └────────────────────┘
```

### Data Flow Dependencies

```
Task Completion
    ↓
[Event: task.completed]
    ├─→ KnowledgeExtractionService
    │   ├─→ DocumentService.create()
    │   ├─→ VectorSearchService.generateEmbedding()
    │   └─→ KnowledgeGraphService.extractRelationships()
    │
    ├─→ PerformanceAnalyzerService
    │   ├─→ Update HollonPerformanceSummary
    │   └─→ Cache metrics
    │
    └─→ ContinuousImprovementService
        ├─→ Check thresholds
        ├─→ Create improvement tasks
        └─→ Send channel alerts
```

---

## Integration Points

### PromptComposerService Integration

**Current** (ILIKE search):
```typescript
// Old way - keyword-only
const docs = await documentRepository
  .createQueryBuilder()
  .where('content ILIKE :query')
  .setParameter('query', `%${keywords}%`)
  .getMany();
```

**New** (Hybrid RAG):
```typescript
// New way - vector + graph
const vectorDocs = await vectorSearchService.vectorSimilaritySearch(query);
const graphDocs = await graphService.findRelatedDocuments(parentId);
const merged = this.mergeWithRRF(vectorDocs, graphDocs);
```

### TaskService Integration

**Event hooks**:
```typescript
@OnEvent('task.completed')
async onTaskCompleted(event: TaskCompletedEvent) {
  // Knowledge extraction
  // Performance analysis
  // Best practice extraction
  // Metric updates
  // Cache invalidation
}
```

### BrainProviderService Integration

**Context injection**:
```typescript
// Hybrid RAG provides rich context to LLM
const memories = await fetchRelevantMemories(task);
const prompt = composePrompt(task, memories);
const response = await brainProvider.execute(prompt);
```

---

## Data Flows

### Knowledge Extraction Flow

```
User Completes Task
    ↓
    ├─→ Task.save() in DB
    ├─→ Publish 'task.completed' event
    │
    └─→ KnowledgeExtractionService.onTaskCompleted()
        ├─→ extractKeywords(task)
        ├─→ generateSummary(task) [May use LLM]
        ├─→ calculateImportance(task)
        │
        └─→ DocumentService.create(document)
            ├─→ Save in DB
            ├─→ Queue embedding generation
            │
            └─→ VectorSearchService.generateEmbedding()
                ├─→ Call OpenAI API
                ├─→ Update document.embedding
                │
                └─→ KnowledgeGraphService.extractRelationships()
                    ├─→ Regex search for [DOC-*] references
                    ├─→ LLM analysis of semantic relationships [May use LLM]
                    │
                    └─→ Store DocumentRelationships
                        ├─→ Save in DB
                        └─→ Invalidate graph cache
```

### Search & Retrieval Flow

```
User/System requests memory for task
    ↓
PromptComposerService.fetchRelevantMemories(task)
    ├─→ Extract keywords from task
    │
    ├─→ VectorSearchService.vectorSimilaritySearch()
    │   ├─→ Check search results cache
    │   ├─→ If miss: call OpenAI for query embedding
    │   ├─→ PostgreSQL IVFFLAT index search
    │   ├─→ Cache results for 1 hour
    │   └─→ Return top-N vector results
    │
    ├─→ KnowledgeGraphService.findRelatedDocuments()
    │   ├─→ Check graph cache
    │   ├─→ If miss: BFS traversal of relationships
    │   ├─→ Cache results for 6 hours
    │   └─→ Return top-N graph results
    │
    ├─→ RRF Merging
    │   ├─→ Combine rankings from both sources
    │   ├─→ Sort by combined score
    │   └─→ Return merged top-N
    │
    └─→ Filter & inject into prompt
        ├─→ Filter by importance threshold
        ├─→ Respect context token budget
        └─→ Inject into Layer 5 of prompt
```

### Continuous Improvement Flow

```
Daily at 02:00 UTC (or on task completion)
    ↓
ContinuousImprovementService.analyze*()
    ├─→ Collect metrics from DB
    │   ├─→ Completed tasks count
    │   ├─→ Escalation rate
    │   ├─→ Blocked tasks
    │   └─→ Incident count
    │
    ├─→ Check against thresholds
    │   ├─→ Escalation > 30% → Alert
    │   ├─→ Blocked > 5 → Alert
    │   └─→ Incidents > 3 → Alert
    │
    ├─→ For high severity: LLM analysis [May use LLM]
    │   ├─→ Identify patterns
    │   └─→ Generate recommendations
    │
    ├─→ Create improvement tasks
    │   ├─→ Type: 'research'
    │   ├─→ Priority: 'P0'
    │   └─→ Auto-assign to team
    │
    └─→ Send channel alert
        ├─→ Summary + metrics
        ├─→ Recommendations
        └─→ Links to improvement tasks
```

---

## Performance Targets

| Metric | Target | Measurement |
|--------|--------|-------------|
| **Vector Search** | <100ms | Query latency (p95) |
| **Search Accuracy** | ≥85% | Manual relevance eval |
| **Graph Traversal** | <200ms | Query latency (p95) |
| **Graph Accuracy** | ≥80% | Relationship precision |
| **Embedding Generation** | 2-5s/100 docs | Batch processing |
| **Memory Injection** | <500ms | Full hybrid RAG pipeline |
| **Token Savings** | 15% | LLM prompt optimization |
| **Metric Collection** | <1s | Per-team analysis |
| **Channel Message Delivery** | <1s | End-to-end delivery |
| **Cache Hit Rate** | >70% | Across all cache types |

---

## Testing Strategy

### Unit Tests

**Knowledge Services**:
```typescript
// knowledge-extraction.service.spec.ts
describe('KnowledgeExtractionService', () => {
  it('should extract keywords from task', () => {});
  it('should calculate importance score', () => {});
  it('should generate summary', () => {});
});

// vector-search.service.spec.ts
describe('VectorSearchService', () => {
  it('should generate embeddings', () => {});
  it('should find similar documents', () => {});
  it('should filter by scope', () => {});
  it('should apply similarity threshold', () => {});
});

// knowledge-graph.service.spec.ts
describe('KnowledgeGraphService', () => {
  it('should extract relationships', () => {});
  it('should traverse graph with depth limit', () => {});
  it('should find document clusters', () => {});
});
```

### Integration Tests

```typescript
// phase4.1-knowledge-system.integration-spec.ts
describe('Phase 4.1: Knowledge System', () => {
  it('should extract and index documents end-to-end', () => {});
  it('should retrieve documents using hybrid search', () => {});
  it('should maintain graph relationships', () => {});
  it('should cache results correctly', () => {});
});

// phase4.2-collaboration.integration-spec.ts
describe('Phase 4.2: Collaboration', () => {
  it('should send channel messages', () => {});
  it('should run daily performance analysis', () => {});
  it('should create improvement tasks', () => {});
});

// phase4.3-self-improvement.integration-spec.ts
describe('Phase 4.3: Self-Improvement', () => {
  it('should analyze task performance', () => {});
  it('should optimize prompts', () => {});
  it('should extract best practices', () => {});
});
```

### E2E Tests

```typescript
// phase4-knowledge-search-e2e.spec.ts
describe('Knowledge Search and Recommendation E2E', () => {
  it('should complete full knowledge lifecycle: create → search → recommend', () => {
    // 1. Create task
    // 2. Complete task (triggers extraction)
    // 3. Verify document created with embedding
    // 4. Search for related documents
    // 5. Verify recommendations generated
    // 6. Verify injection into prompt
  });

  it('should handle graph traversal with multiple relationship types', () => {});
  it('should optimize cache for repeated searches', () => {});
  it('should achieve 85%+ search accuracy', () => {});
});
```

### Performance Tests

```typescript
// phase4-performance-tests.spec.ts
describe('Performance Targets', () => {
  it('vector search should complete in <100ms', () => {
    // Generate 1000 documents
    // Perform 100 random searches
    // Measure p95 latency
    expect(p95Latency).toBeLessThan(100);
  });

  it('hybrid RAG should complete in <500ms', () => {});
  it('embedding generation should process 100 docs in <5s', () => {});
  it('cache hit rate should exceed 70%', () => {});
});
```

---

## Implementation Checklist

### Phase 4.1 (Week 1-2)

- [ ] KnowledgeExtractionService implementation
  - [ ] extractFromCompletedTask()
  - [ ] extractFromDecisionLog()
  - [ ] extractFromPRReview()
  - [ ] Unit tests

- [ ] VectorSearchService implementation
  - [ ] generateEmbedding()
  - [ ] vectorSimilaritySearch()
  - [ ] Batch embedding generation
  - [ ] IVFFLAT index creation
  - [ ] Unit tests

- [ ] KnowledgeGraphService implementation
  - [ ] DocumentRelationship entity
  - [ ] extractRelationships()
  - [ ] findRelatedDocuments()
  - [ ] Graph metrics
  - [ ] Unit tests

- [ ] PromptComposerService integration
  - [ ] Hybrid RAG implementation
  - [ ] RRF merging algorithm
  - [ ] Memory injection pipeline
  - [ ] Integration tests

### Phase 4.2 (Week 3-4)

- [ ] Channel entities and service
  - [ ] Channel entity
  - [ ] ChannelMessage entity
  - [ ] ChannelService
  - [ ] Standard channels creation
  - [ ] Unit tests

- [ ] ContinuousImprovementService
  - [ ] Daily analysis cron job
  - [ ] Metric collection
  - [ ] Threshold checking
  - [ ] Improvement task creation
  - [ ] Channel alerts
  - [ ] Real-time event handling
  - [ ] Integration tests

### Phase 4.3 (Week 5-6)

- [ ] PerformanceAnalyzerService
  - [ ] Task completion analysis
  - [ ] Quality score calculation
  - [ ] Productivity metrics
  - [ ] Top performer identification
  - [ ] Unit tests

- [ ] PromptOptimizerService
  - [ ] A/B testing analysis
  - [ ] Statistical significance (t-test)
  - [ ] Optimization suggestions
  - [ ] Unit tests

- [ ] BestPracticeService
  - [ ] Pattern extraction
  - [ ] Document generation
  - [ ] Best practice injection
  - [ ] Unit tests

---

## Conclusion

The Knowledge Search and Recommendation System is a comprehensive architecture enabling:

1. **Automatic Knowledge Capture** - Task completions, decisions, and reviews are automatically indexed
2. **Advanced Search** - Hybrid vector + graph search with RRF ranking
3. **Smart Recommendations** - Context-aware suggestions based on history and team patterns
4. **Real-time Collaboration** - Channel-based communication with automated alerts
5. **Continuous Learning** - Performance analysis, prompt optimization, and best practice extraction
6. **Scalable Performance** - Caching strategies, efficient indexing, and optimized queries

All 7 work items are fully specified with:
- Service implementations
- Data structures
- API specifications
- Performance targets
- Testing requirements
- Integration points

This document serves as the complete technical specification for Phase 4 implementation.

