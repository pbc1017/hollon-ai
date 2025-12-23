# Embeddings Module

The Embeddings Module provides batch processing capabilities for generating vector embeddings using the OpenAI Embedding API.

## Overview

This module handles:
- **Batch Embedding Generation**: Process multiple documents efficiently with OpenAI API
- **Token Usage Monitoring**: Track input tokens consumed by the embedding process
- **Cost Tracking**: Record all embedding costs in the CostRecord entity
- **Automatic Retry Logic**: Failed items are automatically retried with exponential backoff
- **Efficient Batching**: Respects OpenAI API batch size limits (100 items per batch)

## Architecture

### EmbeddingsService

The core service that orchestrates the embedding workflow:

```typescript
async embeddingBatchJob(request: EmbeddingBatchRequest): Promise<EmbeddingBatchResult>
```

#### Key Features:

1. **Document Filtering**: Automatically skips documents that already have embeddings
2. **Batch Splitting**: Divides large document sets into OpenAI API-compliant batches (max 100)
3. **OpenAI Integration**: Makes authenticated requests to OpenAI's embedding API
4. **Error Handling**: Gracefully handles API errors with detailed logging
5. **Retry Strategy**: 
   - Implements exponential backoff (1s, 2s, 3s delays)
   - Configurable max retry attempts (default: 3)
   - Retries only failed documents, not entire batches
6. **Cost Recording**: Automatically logs all costs to CostRecord entity
7. **Vector Storage**: Saves embeddings as JSON arrays in Document entity

## API Endpoints

### POST `/embeddings/batch`

Trigger batch embedding job for multiple documents.

**Request Body:**
```json
{
  "documentIds": [
    "uuid1",
    "uuid2",
    "uuid3"
  ],
  "organizationId": "uuid",
  "retryFailedItems": true,
  "maxRetries": 3
}
```

**Parameters:**
- `documentIds` (string[]): Array of document IDs to embed
- `organizationId` (string): Organization ID for authorization
- `retryFailedItems` (boolean, optional): Enable automatic retry (default: true)
- `maxRetries` (number, optional): Max retry attempts for failed items (default: 3)

**Response:**
```json
{
  "processed": 100,
  "failed": 2,
  "totalTokens": 1500,
  "totalCostCents": 3,
  "executionTimeMs": 2500,
  "failedDocumentIds": ["uuid1", "uuid2"],
  "retryAttempts": 5
}
```

**Fields:**
- `processed`: Number of successfully embedded documents
- `failed`: Number of documents that failed after all retries
- `totalTokens`: Total input tokens consumed
- `totalCostCents`: Total cost in cents ($0.01 = 1 cent)
- `executionTimeMs`: Total execution time
- `failedDocumentIds`: Array of document IDs that failed
- `retryAttempts`: Total number of retry attempts performed

## Cost Model

The module uses OpenAI's `text-embedding-3-small` model with the following pricing:
- **Cost**: $0.02 per 1M tokens
- **Tokens**: Only input tokens count (output tokens = 0 for embeddings)

### Cost Calculation Example:
- 10,000 tokens → (10,000 / 1,000,000) × $0.02 × 100 = 20 cents
- 1,000,000 tokens → (1,000,000 / 1,000,000) × $0.02 × 100 = 200 cents ($2.00)

## Database Integration

### Document Entity
Embeddings are stored in the `embedding` column of the `documents` table:
- Type: `text` (JSON serialized)
- Format: `[0.123, 0.456, ...]` (1536-dimensional vector)
- Nullable: Yes (for documents without embeddings)

### CostRecord Entity
All embedding costs are logged:
- `type`: `CostRecordType.OTHER` (embeddings are not BRAIN_EXECUTION)
- `providerId`: `'openai_api'`
- `modelUsed`: `'text-embedding-3-small'`
- `inputTokens`: Total tokens used
- `outputTokens`: 0 (embeddings don't have output tokens)
- `costCents`: Calculated based on token consumption
- `metadata`: Includes batch details (processedCount, failedCount)

## Retry Logic

The module implements intelligent retry logic:

1. **First Attempt**: All documents in the batch are processed
2. **Failed Documents**: Only documents that failed are retried
3. **Exponential Backoff**: 
   - Attempt 1: immediate
   - Attempt 2: 1 second delay
   - Attempt 3: 2 second delay
   - Attempt 4: 3 second delay
4. **Configurable**: `maxRetries` parameter controls max attempts

### Failure Scenarios:
- **API Rate Limiting (429)**: Retried
- **Temporary Network Issues (5xx)**: Retried
- **Invalid Input (4xx, non-429)**: Not retried (logged as permanent failure)

## Batch Processing Strategy

The service implements efficient batching:

```
Large Document Set (300 docs)
    ↓
Batch 1: 100 docs → OpenAI API → Results
Batch 2: 100 docs → OpenAI API → Results
Batch 3: 100 docs → OpenAI API → Results
    ↓
All Results Combined → Cost Recorded
```

Benefits:
- Respects OpenAI API limits
- Parallel processing possible (independent batches)
- Efficient token usage tracking

## Usage Examples

### Embed All Documents in Organization

```typescript
// In any service
constructor(private embeddingsService: EmbeddingsService) {}

async embedAllDocuments(organizationId: string) {
  const documents = await this.documentRepository.find({
    where: { organizationId }
  });

  const result = await this.embeddingsService.embeddingBatchJob({
    documentIds: documents.map(d => d.id),
    organizationId,
    maxRetries: 3,
  });

  console.log(`Embedded ${result.processed} documents, ${result.failed} failed`);
  console.log(`Total cost: $${(result.totalCostCents / 100).toFixed(2)}`);
}
```

### Embed Single Document

```typescript
const embedding = await this.embeddingsService.embedDocument(docId, orgId);
// Returns JSON string of embedding vector
```

### Monitor Costs

```typescript
// After embedding job
const costInDollars = result.totalCostCents / 100;
const averageCostPerDoc = result.totalCostCents / result.processed;
console.log(`Total: $${costInDollars}, Per doc: $${averageCostPerDoc / 100}`);
```

## Performance Considerations

1. **Token Limits**: OpenAI API has rate limits. Batch size of 100 is safe.
2. **Execution Time**: ~20-25ms per 100 documents on average
3. **Memory**: Service loads documents into memory during processing
4. **Database**: Updates are batched for efficiency

## Error Handling

The service provides detailed error messages:

```
- "OpenAI API error: 401 - {\"error\": {\"message\": \"Invalid API key\"}}"
- "OpenAI API error: 429 - {\"error\": {\"message\": \"Rate limit exceeded\"}}"
- "Failed to save embedding for document xyz: [error details]"
```

Failed documents are tracked and returned in `failedDocumentIds`.

## Testing

Unit tests are provided in `embeddings.service.spec.ts`:

```bash
npm run test -- embeddings.service.spec.ts
```

Key test scenarios:
- Batch embedding with successful API response
- Error handling for missing API key
- Cost calculation accuracy
- Retry logic validation
- Large batch splitting
- Already-embedded document handling
- OpenAI API error responses

## Future Enhancements

1. **Semantic Search**: Use embeddings for vector similarity search
2. **Caching**: Cache embeddings to avoid reprocessing
3. **Async Jobs**: Background job processing for large batches
4. **Vector Database**: Integration with pgvector for similarity search
5. **Model Selection**: Support for different embedding models
6. **Parallel Batch Processing**: Process multiple batches concurrently

## Configuration

Add to `.env`:

```env
OPENAI_API_KEY=sk-...
```

The service automatically:
- Validates API key exists
- Uses `text-embedding-3-small` model
- Applies correct pricing calculations
- Handles batch size limits
