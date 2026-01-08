# KnowledgeExtractionModule - Architecture Documentation

## Overview

The `KnowledgeExtractionModule` provides knowledge extraction capabilities for the Hollon-AI system. It encapsulates services for extracting knowledge entities, relationships, and metadata from various sources including conversations, documents, and agent interactions.

## Module Structure

### File Organization

```
knowledge-extraction/
├── entities/
│   └── knowledge-item.entity.ts    # TypeORM entity for persisting extracted knowledge
├── knowledge-extraction.module.ts   # Module definition and configuration
├── knowledge-extraction.service.ts  # Core extraction service
└── README.md                        # This file
```

## Dependency Injection Strategy

### 1. Module Configuration

The module follows NestJS standard patterns with a clear separation of concerns:

```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([KnowledgeItem])
  ],
  providers: [
    KnowledgeExtractionService
  ],
  exports: [
    KnowledgeExtractionService
  ]
})
```

### 2. Imports

#### TypeORM Integration

```typescript
TypeOrmModule.forFeature([KnowledgeItem])
```

**Purpose:** Registers the `KnowledgeItem` entity with TypeORM for this module's scope.

**Benefits:**
- Enables repository pattern for database operations
- Provides automatic dependency injection of `Repository<KnowledgeItem>`
- Ensures proper entity lifecycle management
- Enables transactions and query builder access

**Usage:** Services within this module can inject the repository:
```typescript
constructor(
  @InjectRepository(KnowledgeItem)
  private readonly knowledgeItemRepository: Repository<KnowledgeItem>
) {}
```

### 3. Providers

#### KnowledgeExtractionService

**Scope:** Singleton (default NestJS provider scope)

**Lifecycle:** 
- Single instance created at application startup
- Shared across all consumers
- Destroyed at application shutdown

**Dependencies:**
- `Repository<KnowledgeItem>` - Injected via `@InjectRepository` decorator

**Responsibilities:**
- Extract knowledge entities from content
- Extract relationships between entities
- Extract and process metadata
- Validate and normalize extracted data
- Persist extracted knowledge to database

**Stateless Design:**
- No instance state (all data via parameters)
- Thread-safe and concurrent-request safe
- Can be safely shared across modules

### 4. Exports

#### Exported Services

```typescript
exports: [KnowledgeExtractionService]
```

**Purpose:** Makes the service available to other modules that import `KnowledgeExtractionModule`.

**Consumer Modules:**
- `PromptComposerModule` - Uses extracted knowledge for prompt composition
- `OrchestrationModule` - Leverages knowledge for orchestration decisions
- `MessageModule` - Stores conversation knowledge
- `DocumentModule` - Extracts knowledge from documents
- `KnowledgeGraphModule` - Constructs graph from extracted entities

## Module Boundaries

### Responsibilities (In Scope)

✅ **Knowledge Entity Extraction**
- Extract entities from text content
- Identify entity types and properties
- Extract entity metadata

✅ **Relationship Extraction**
- Identify relationships between entities
- Classify relationship types
- Extract relationship metadata

✅ **Data Processing**
- Normalize extracted data
- Validate extraction results
- Transform data for storage

✅ **Persistence Management**
- Store extracted knowledge items
- Query knowledge items
- Update and manage knowledge lifecycle

### Non-Responsibilities (Out of Scope)

❌ **AI Provider Integration** - Handled by `BrainProviderModule`
❌ **Vector Embeddings** - Future integration with `VectorSearchModule`
❌ **Graph Construction** - Managed by `KnowledgeGraphModule`
❌ **NLP Processing** - Future integration with external NLP services

## Integration Patterns

### 1. Consuming This Module

```typescript
@Module({
  imports: [
    KnowledgeExtractionModule,  // Import the module
    // ... other imports
  ],
  providers: [MyService],
})
export class MyModule {}
```

```typescript
@Injectable()
export class MyService {
  constructor(
    // Inject the exported service
    private readonly knowledgeExtractionService: KnowledgeExtractionService,
  ) {}

  async myMethod() {
    // Use the service
    // await this.knowledgeExtractionService.extractEntities(content);
  }
}
```

### 2. No Circular Dependencies

The module is designed to have **no circular dependencies**:
- Does not import other feature modules
- Only imports infrastructure modules (TypeOrmModule)
- Pure provider of extraction capabilities
- Clean, one-way dependency flow

### 3. Future Dependencies

When additional capabilities are needed:

**AI-Powered Extraction:**
```typescript
imports: [
  TypeOrmModule.forFeature([KnowledgeItem]),
  BrainProviderModule,  // For AI-based extraction
]
```

**Vector Search Integration:**
```typescript
imports: [
  TypeOrmModule.forFeature([KnowledgeItem]),
  VectorSearchModule,  // For semantic search
]
```

## Service Lifecycle

### Injection Scope

All services use the **default (SINGLETON) scope**:

```typescript
@Injectable()  // Implicitly { scope: Scope.DEFAULT }
export class KnowledgeExtractionService { }
```

**Implications:**
- One instance per application
- State must be managed carefully (prefer stateless)
- Optimal for performance (no instance creation overhead)
- Shared resources (like database connections) are reused

### Request Handling

Services are **stateless** and handle concurrent requests safely:
- No instance variables storing request-specific data
- All data passed via method parameters
- Database operations are atomic via repository
- Multiple requests can use the same service instance

## Database Integration

### Repository Pattern

The module uses TypeORM's repository pattern:

```typescript
@InjectRepository(KnowledgeItem)
private readonly knowledgeItemRepository: Repository<KnowledgeItem>
```

**Benefits:**
- Type-safe database operations
- Query builder support
- Transaction support
- Connection pool management
- Migration integration

### Entity: KnowledgeItem

**Schema:**
```typescript
{
  id: string (UUID)
  organizationId: string
  type: string
  content: string
  metadata: Record<string, unknown>
  extractedAt: Date
  createdAt: Date
  updatedAt: Date
}
```

**Indexes:**
- `organizationId` - for organization-scoped queries
- `type` - for filtering by knowledge type
- `extractedAt` - for temporal queries

## Future Expansion

### Planned Services

The module is designed to grow with additional services:

1. **EntityRecognitionService**
   - NLP-based entity recognition
   - Named entity recognition (NER)
   - Custom entity types

2. **RelationshipExtractionService**
   - Relationship pattern matching
   - Semantic relationship analysis
   - Relationship confidence scoring

3. **MetadataEnrichmentService**
   - Metadata extraction from content
   - External data enrichment
   - Metadata validation

4. **VectorEmbeddingService**
   - Generate embeddings for extracted knowledge
   - Integration with vector databases
   - Semantic similarity computation

5. **KnowledgeValidationService**
   - Validate extraction quality
   - Score extraction confidence
   - Detect and handle conflicts

### Adding New Services

**Step 1:** Create the service
```typescript
@Injectable()
export class NewService {
  constructor(
    @InjectRepository(KnowledgeItem)
    private readonly repository: Repository<KnowledgeItem>
  ) {}
}
```

**Step 2:** Add to providers
```typescript
@Module({
  providers: [
    KnowledgeExtractionService,
    NewService,  // Add here
  ]
})
```

**Step 3:** Optionally export
```typescript
@Module({
  exports: [
    KnowledgeExtractionService,
    NewService,  // Export if needed by other modules
  ]
})
```

## Testing Strategy

### Unit Tests

**Service Tests:**
- Mock repository dependencies
- Test extraction logic in isolation
- Verify validation rules
- Test error handling

```typescript
describe('KnowledgeExtractionService', () => {
  let service: KnowledgeExtractionService;
  let repository: MockRepository<KnowledgeItem>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        KnowledgeExtractionService,
        {
          provide: getRepositoryToken(KnowledgeItem),
          useValue: createMockRepository(),
        },
      ],
    }).compile();

    service = module.get(KnowledgeExtractionService);
    repository = module.get(getRepositoryToken(KnowledgeItem));
  });
});
```

### Integration Tests

**Module Tests:**
- Test with real database (test database)
- Verify TypeORM integration
- Test entity persistence
- Verify transactions

```typescript
describe('KnowledgeExtractionModule', () => {
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot(testDatabaseConfig),
        KnowledgeExtractionModule,
      ],
    }).compile();
  });
});
```

## Performance Considerations

### Async Operations

All extraction operations are asynchronous:
- Non-blocking I/O for database operations
- Concurrent request handling
- Efficient resource utilization

### Batch Processing

Support for batch operations (future):
- Extract knowledge from multiple documents
- Bulk insert extracted entities
- Transactional batch processing

### Caching (Future)

Planned caching strategies:
- Cache frequently accessed knowledge items
- Cache extraction results for identical content
- Configurable cache TTL

## Configuration

### Environment Variables

Currently, no module-specific configuration required.

### Future Configuration

Planned configuration options:
- Extraction model selection
- Confidence thresholds
- Batch size limits
- Cache settings
- External service URLs

## Security Considerations

### Data Isolation

- Organization-scoped queries via `organizationId`
- Row-level security via TypeORM query filters
- No cross-organization data leakage

### Input Validation

- Validate content before extraction
- Sanitize metadata before storage
- Type-safe operations via TypeScript

### API Security

- Service methods not exposed directly (no controller)
- Only accessible via dependency injection
- Module-level access control

## Monitoring and Observability

### Future Enhancements

- Extraction success/failure metrics
- Performance metrics (extraction time)
- Quality metrics (confidence scores)
- Usage metrics (extraction volume)

## References

- [NestJS Modules Documentation](https://docs.nestjs.com/modules)
- [NestJS Custom Providers](https://docs.nestjs.com/fundamentals/custom-providers)
- [TypeORM Repository API](https://typeorm.io/repository-api)
- [Dependency Injection Best Practices](https://docs.nestjs.com/fundamentals/custom-providers#di-fundamentals)
