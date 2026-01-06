import { DataSource, EntityMetadata } from 'typeorm';

/**
 * Schema Validation Utilities
 *
 * Compares TypeORM entity definitions against actual database schema
 * to ensure migrations correctly reflect entity metadata.
 */

/**
 * Column information from database
 */
interface DatabaseColumn {
  columnName: string;
  dataType: string;
  isNullable: boolean;
  columnDefault: string | null;
  characterMaximumLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
}

/**
 * Index information from database
 */
interface DatabaseIndex {
  indexName: string;
  columnNames: string[];
  isUnique: boolean;
}

/**
 * Foreign key information from database
 */
interface DatabaseForeignKey {
  constraintName: string;
  columnName: string;
  foreignTableName: string;
  foreignColumnName: string;
  onDelete: string;
  onUpdate: string;
}

/**
 * Schema validation result for a single entity
 */
export interface EntityValidationResult {
  entityName: string;
  tableName: string;
  valid: boolean;
  missingColumns: string[];
  extraColumns: string[];
  columnMismatches: Array<{
    column: string;
    expected: string;
    actual: string;
    issue: string;
  }>;
  missingIndexes: string[];
  extraIndexes: string[];
  foreignKeyIssues: Array<{
    constraint: string;
    issue: string;
  }>;
}

/**
 * Get all columns for a table from the database
 */
async function getDatabaseColumns(
  dataSource: DataSource,
  schema: string,
  tableName: string,
): Promise<DatabaseColumn[]> {
  const result = await dataSource.query(
    `
    SELECT
      column_name as "columnName",
      data_type as "dataType",
      is_nullable = 'YES' as "isNullable",
      column_default as "columnDefault",
      character_maximum_length as "characterMaximumLength",
      numeric_precision as "numericPrecision",
      numeric_scale as "numericScale"
    FROM information_schema.columns
    WHERE table_schema = $1 AND table_name = $2
    ORDER BY ordinal_position
  `,
    [schema, tableName],
  );
  return result;
}

/**
 * Get all indexes for a table from the database
 */
async function getDatabaseIndexes(
  dataSource: DataSource,
  schema: string,
  tableName: string,
): Promise<DatabaseIndex[]> {
  const result = await dataSource.query(
    `
    SELECT
      i.relname as "indexName",
      ARRAY_AGG(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as "columnNames",
      ix.indisunique as "isUnique"
    FROM pg_class t
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN pg_index ix ON ix.indrelid = t.oid
    JOIN pg_class i ON i.oid = ix.indexrelid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
    WHERE n.nspname = $1
      AND t.relname = $2
      AND t.relkind = 'r'
    GROUP BY i.relname, ix.indisunique
    ORDER BY i.relname
  `,
    [schema, tableName],
  );
  return result;
}

/**
 * Get all foreign keys for a table from the database
 */
async function getDatabaseForeignKeys(
  dataSource: DataSource,
  schema: string,
  tableName: string,
): Promise<DatabaseForeignKey[]> {
  const result = await dataSource.query(
    `
    SELECT
      tc.constraint_name as "constraintName",
      kcu.column_name as "columnName",
      ccu.table_name as "foreignTableName",
      ccu.column_name as "foreignColumnName",
      rc.delete_rule as "onDelete",
      rc.update_rule as "onUpdate"
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
    JOIN information_schema.referential_constraints rc
      ON tc.constraint_name = rc.constraint_name
      AND tc.table_schema = rc.constraint_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
      AND tc.table_schema = $1
      AND tc.table_name = $2
    ORDER BY tc.constraint_name
  `,
    [schema, tableName],
  );
  return result;
}

/**
 * Normalize TypeORM type to PostgreSQL type for comparison
 */
function normalizeTypeOrmType(type: string): string {
  const typeMap: Record<string, string> = {
    varchar: 'character varying',
    int: 'integer',
    int2: 'smallint',
    int4: 'integer',
    int8: 'bigint',
    float4: 'real',
    float8: 'double precision',
    bool: 'boolean',
    timestamp: 'timestamp without time zone',
    'timestamp with time zone': 'timestamp with time zone',
    timestamptz: 'timestamp with time zone',
    json: 'json',
    jsonb: 'jsonb',
    uuid: 'uuid',
    text: 'text',
  };

  const lowerType = type.toLowerCase();
  return typeMap[lowerType] || lowerType;
}

/**
 * Validate entity schema against database
 */
export async function validateEntitySchema(
  dataSource: DataSource,
  entityMetadata: EntityMetadata,
): Promise<EntityValidationResult> {
  const schema = (dataSource.options as { schema?: string }).schema || 'public';
  const tableName = entityMetadata.tableName;

  const result: EntityValidationResult = {
    entityName: entityMetadata.name,
    tableName,
    valid: true,
    missingColumns: [],
    extraColumns: [],
    columnMismatches: [],
    missingIndexes: [],
    extraIndexes: [],
    foreignKeyIssues: [],
  };

  // Get database columns
  const dbColumns = await getDatabaseColumns(dataSource, schema, tableName);
  const dbColumnMap = new Map(dbColumns.map((col) => [col.columnName, col]));

  // Check entity columns
  const entityColumns = entityMetadata.columns;
  const entityColumnNames = new Set(
    entityColumns.map((col) => col.databaseName),
  );

  // Check for missing columns (in entity but not in database)
  for (const column of entityColumns) {
    const dbColumn = dbColumnMap.get(column.databaseName);

    if (!dbColumn) {
      result.missingColumns.push(column.databaseName);
      result.valid = false;
      continue;
    }

    // Validate column type
    const expectedType = normalizeTypeOrmType(
      column.type as string,
    ).toLowerCase();
    const actualType = dbColumn.dataType.toLowerCase();

    // Handle special cases
    if (column.type === 'enum') {
      // Enum types in PostgreSQL are stored as USER-DEFINED
      if (actualType !== 'user-defined') {
        result.columnMismatches.push({
          column: column.databaseName,
          expected: `enum (${column.enum?.join(', ')})`,
          actual: actualType,
          issue: 'Type mismatch',
        });
        result.valid = false;
      }
    } else if (column.isArray) {
      // Array types have 'ARRAY' suffix in PostgreSQL
      if (!actualType.startsWith('array')) {
        result.columnMismatches.push({
          column: column.databaseName,
          expected: `${expectedType}[]`,
          actual: actualType,
          issue: 'Array type mismatch',
        });
        result.valid = false;
      }
    } else if (
      !actualType.includes(expectedType) &&
      !expectedType.includes(actualType)
    ) {
      // Allow partial matches for complex types
      result.columnMismatches.push({
        column: column.databaseName,
        expected: expectedType,
        actual: actualType,
        issue: 'Type mismatch',
      });
      result.valid = false;
    }

    // Validate nullable
    const expectedNullable = column.isNullable;
    const actualNullable = dbColumn.isNullable;

    if (expectedNullable !== actualNullable) {
      result.columnMismatches.push({
        column: column.databaseName,
        expected: expectedNullable ? 'nullable' : 'not null',
        actual: actualNullable ? 'nullable' : 'not null',
        issue: 'Nullability mismatch',
      });
      result.valid = false;
    }
  }

  // Check for extra columns (in database but not in entity)
  for (const dbColumn of dbColumns) {
    if (!entityColumnNames.has(dbColumn.columnName)) {
      result.extraColumns.push(dbColumn.columnName);
      // Extra columns are not necessarily invalid (could be from other sources)
      // but should be noted
    }
  }

  // Validate indexes
  const dbIndexes = await getDatabaseIndexes(dataSource, schema, tableName);

  // Get entity indexes (excluding primary key index)
  const entityIndexes = entityMetadata.indices.filter(
    (idx) => !idx.columns.every((col) => col.isPrimary),
  );

  // Check for missing indexes
  // Note: This is a simplified check. Index names in database may differ from entity metadata
  for (const index of entityIndexes) {
    const indexColumns = index.columns.map((col) => col.databaseName).sort();
    const matchingDbIndex = dbIndexes.find((dbIdx) => {
      const dbIdxColumns = dbIdx.columnNames.sort();
      return (
        dbIdxColumns.length === indexColumns.length &&
        dbIdxColumns.every((col, i) => col === indexColumns[i])
      );
    });

    if (!matchingDbIndex) {
      result.missingIndexes.push(
        `Index on columns: ${indexColumns.join(', ')}`,
      );
      result.valid = false;
    }
  }

  // Validate foreign keys
  const dbForeignKeys = await getDatabaseForeignKeys(
    dataSource,
    schema,
    tableName,
  );

  for (const fk of entityMetadata.foreignKeys) {
    const columnName = fk.columnNames[0]; // Simplified: assumes single-column FK
    const referencedTable = fk.referencedEntityMetadata.tableName;

    const matchingDbFk = dbForeignKeys.find(
      (dbFk) =>
        dbFk.columnName === columnName &&
        dbFk.foreignTableName === referencedTable,
    );

    if (!matchingDbFk) {
      result.foreignKeyIssues.push({
        constraint: `FK ${columnName} -> ${referencedTable}`,
        issue: 'Foreign key constraint missing in database',
      });
      result.valid = false;
    }
  }

  return result;
}

/**
 * Validate all entities in the data source
 */
export async function validateAllEntities(
  dataSource: DataSource,
): Promise<EntityValidationResult[]> {
  const results: EntityValidationResult[] = [];

  for (const entityMetadata of dataSource.entityMetadatas) {
    const result = await validateEntitySchema(dataSource, entityMetadata);
    results.push(result);
  }

  return results;
}

/**
 * Generate validation summary
 */
export function generateValidationSummary(results: EntityValidationResult[]): {
  totalEntities: number;
  validEntities: number;
  invalidEntities: number;
  summary: string;
} {
  const totalEntities = results.length;
  const validEntities = results.filter((r) => r.valid).length;
  const invalidEntities = totalEntities - validEntities;

  let summary = `Schema Validation Summary:\n`;
  summary += `Total entities: ${totalEntities}\n`;
  summary += `Valid: ${validEntities}\n`;
  summary += `Invalid: ${invalidEntities}\n\n`;

  const invalidResults = results.filter((r) => !r.valid);
  if (invalidResults.length > 0) {
    summary += `Invalid entities:\n`;
    for (const result of invalidResults) {
      summary += `\n${result.entityName} (${result.tableName}):\n`;

      if (result.missingColumns.length > 0) {
        summary += `  Missing columns: ${result.missingColumns.join(', ')}\n`;
      }

      if (result.extraColumns.length > 0) {
        summary += `  Extra columns: ${result.extraColumns.join(', ')}\n`;
      }

      if (result.columnMismatches.length > 0) {
        summary += `  Column mismatches:\n`;
        for (const mismatch of result.columnMismatches) {
          summary += `    ${mismatch.column}: ${mismatch.issue} (expected: ${mismatch.expected}, actual: ${mismatch.actual})\n`;
        }
      }

      if (result.missingIndexes.length > 0) {
        summary += `  Missing indexes: ${result.missingIndexes.join(', ')}\n`;
      }

      if (result.foreignKeyIssues.length > 0) {
        summary += `  Foreign key issues:\n`;
        for (const issue of result.foreignKeyIssues) {
          summary += `    ${issue.constraint}: ${issue.issue}\n`;
        }
      }
    }
  }

  return {
    totalEntities,
    validEntities,
    invalidEntities,
    summary,
  };
}
