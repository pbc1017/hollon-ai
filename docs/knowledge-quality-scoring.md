# Knowledge Quality Scoring System

## Overview

The Knowledge Quality Scoring System provides automated quality assessment for documents in the Hollon-AI platform. It calculates a weighted score (0-100) based on multiple quality factors to help users find the most valuable and relevant knowledge.

## Quality Factors

The system evaluates documents based on four key factors:

### 1. Completeness (30% weight)

Measures how well-documented the knowledge entry is:

- **Content Length** (50% of completeness): Evaluates the depth of content
  - Minimum threshold: 100 characters
  - Optimal length: 1,000 characters
  - Scores are calculated proportionally between these thresholds

- **Title Presence** (10% of completeness): Documents must have a meaningful title

- **Tags** (20% of completeness): Measures categorization quality
  - Minimum: 1 tag
  - Optimal: 5 tags

- **Metadata** (20% of completeness): Presence of structured metadata

### 2. Usage Frequency (25% weight)

Tracks how often the document is accessed:

- Based on view count
- Uses logarithmic scaling to handle large view counts fairly
- High usage threshold: 100 views = maximum score
- Score formula: `log10(viewCount + 1) / log10(101) * 100`

### 3. User Ratings (25% weight)

Incorporates direct user feedback:

- Rating scale: 1-5 stars
- Calculates average rating from all user submissions
- Converts to 0-100 scale: `((avgRating - 1) / 4) * 100`
- Documents with no ratings receive a neutral score of 50

### 4. Freshness (20% weight)

Ensures recent and maintained knowledge ranks higher:

- Full score (100) if updated within 90 days
- Linear decay between 90-365 days
- Minimum score (0) for documents older than 365 days
- Uses `lastAccessedAt` or `updatedAt` as freshness indicator

## Score Calculation Formula

```
qualityScore = (completeness × 0.30) + 
               (usage × 0.25) + 
               (ratings × 0.25) + 
               (freshness × 0.20)
```

Result is a decimal number between 0-100, rounded to 2 decimal places.

## Database Schema

The following columns were added to the `documents` table:

| Column | Type | Description |
|--------|------|-------------|
| `quality_score` | `decimal(5,2)` | Overall quality score (0-100) |
| `view_count` | `integer` | Number of times document accessed |
| `rating_sum` | `integer` | Sum of all user ratings (1-5 scale) |
| `rating_count` | `integer` | Number of user ratings |
| `last_accessed_at` | `timestamp` | Last access timestamp |

### Indexes

For efficient searching and ranking:

- `IDX_documents_quality_score` - Single column descending index
- `IDX_documents_type_quality_score` - Composite index for type + score
- `IDX_documents_org_quality_score` - Composite index for organization + score

## API Usage

### Automatic Score Updates

Scores are automatically recalculated when:

1. **Document is created** - Initial score calculated based on content
2. **Document is updated** - Score recalculated to reflect changes
3. **Document is viewed** - View count incremented, score updated
4. **Document is rated** - Rating incorporated, score updated

### Service Methods

#### DocumentService

```typescript
// Retrieve document with view tracking
const doc = await documentService.findOne(id, true); // recordView = true

// Rate a document (1-5 scale)
await documentService.rateDocument(documentId, 4);

// Get detailed score breakdown
const breakdown = await documentService.getQualityScoreBreakdown(documentId);
```

#### DocumentQualityService

```typescript
// Manual score update for single document
await qualityService.updateDocumentScore(documentId);

// Record a view (increments view_count, updates last_accessed_at)
await qualityService.recordDocumentView(documentId);

// Add a rating
await qualityService.rateDocument(documentId, rating);

// Batch update scores
await qualityService.batchUpdateScores([id1, id2, id3]);

// Update all documents in an organization
await qualityService.updateOrganizationScores(organizationId);

// Get score breakdown
const breakdown = await qualityService.getScoreBreakdown(documentId);
```

### Score Breakdown Response

```typescript
interface QualityScoreBreakdown {
  totalScore: number;          // 0-100
  completenessScore: number;   // 0-100
  usageScore: number;          // 0-100
  ratingScore: number;         // 0-100
  freshnessScore: number;      // 0-100
}
```

## Search Integration

All document search and retrieval methods now rank results by quality score:

1. **Primary sort**: `quality_score DESC` (highest quality first)
2. **Secondary sort**: `created_at DESC` (newest first among same quality)

Affected methods:
- `findOrganizationKnowledge()`
- `findProjectDocuments()`
- `searchByTags()`
- `findByHollon()`
- `findByTask()`

## Migration

Run the migration to add quality scoring fields:

```bash
pnpm db:migrate
```

The migration `1735000000000-AddDocumentQualityScoring.ts`:
- Adds all quality-related columns
- Creates performance indexes
- Initializes existing documents with a neutral score of 50.0

## Best Practices

### For Content Creators

1. **Write comprehensive content** (aim for 1,000+ characters)
2. **Add relevant tags** (3-5 tags recommended)
3. **Include metadata** for better context
4. **Update documents regularly** to maintain freshness
5. **Encourage user ratings** to build credibility

### For Administrators

1. **Monitor quality scores** across the organization
2. **Periodically update scores** for all documents:
   ```typescript
   await qualityService.updateOrganizationScores(orgId);
   ```
3. **Review low-scoring documents** for improvement opportunities
4. **Track usage patterns** to identify valuable knowledge

### Performance Considerations

1. Quality scores are **cached in the database** - no real-time calculation overhead
2. Scores are **updated asynchronously** when documents change
3. Use **batch updates** for large-scale score recalculation
4. Indexes ensure **efficient ranking** in search queries

## Testing

Comprehensive test suite in `document-quality.service.spec.ts` covers:

- Score calculation for various document states
- Automatic updates on document changes
- View tracking and rating functionality
- Batch operations
- Error handling

Run tests:

```bash
pnpm --filter @hollon-ai/server test document-quality
```

## Future Enhancements

Potential improvements to consider:

1. **Collaborative signals**: Track shares, references from other documents
2. **Expertise weighting**: Give more weight to ratings from subject matter experts
3. **Time-based decay curves**: More sophisticated freshness models
4. **Category-specific scoring**: Different weights for different document types
5. **Machine learning**: Train models to predict document quality
6. **User-specific relevance**: Personalized scoring based on user interests

## Related Documentation

- [Document Module](./modules/document.md)
- [Database Migrations](./database-migrations.md)
- [Search and Discovery](./search.md)
