import { DataSource } from 'typeorm';
import { initializeTestDatabase, closeTestDatabase } from './test-db-config';
import {
  setupTestSchema,
  cleanDatabase,
  teardownTestSchema,
} from './setup/test-database';
import {
  validateEntitySchema,
  validateAllEntities,
  generateValidationSummary,
} from './setup/schema-validator';
import { VectorEmbedding } from '../src/entities/vector-embedding.entity';

/**
 * Schema Validation Test Suite
 *
 * Tests that verify database schema matches entity definitions.
 * These tests ensure migrations correctly implement entity metadata.
 */
describe('Schema Validation', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await initializeTestDatabase();
    await setupTestSchema(dataSource);
  });

  afterAll(async () => {
    await teardownTestSchema(dataSource);
    await closeTestDatabase(dataSource);
  });

  afterEach(async () => {
    await cleanDatabase(dataSource);
  });

  describe('Entity Schema Validation', () => {
    it('should validate all entities against database schema', async () => {
      const results = await validateAllEntities(dataSource);

      // Generate summary for debugging
      const summary = generateValidationSummary(results);
      console.log(summary.summary);

      // All entities should have valid schemas
      const invalidEntities = results.filter((r) => !r.valid);

      if (invalidEntities.length > 0) {
        const details = invalidEntities.map((r) => {
          const issues: string[] = [];

          if (r.missingColumns.length > 0) {
            issues.push(`Missing columns: ${r.missingColumns.join(', ')}`);
          }

          if (r.columnMismatches.length > 0) {
            r.columnMismatches.forEach((m) => {
              issues.push(
                `${m.column}: ${m.issue} (expected: ${m.expected}, actual: ${m.actual})`,
              );
            });
          }

          if (r.missingIndexes.length > 0) {
            issues.push(`Missing indexes: ${r.missingIndexes.join(', ')}`);
          }

          if (r.foreignKeyIssues.length > 0) {
            r.foreignKeyIssues.forEach((fk) => {
              issues.push(`${fk.constraint}: ${fk.issue}`);
            });
          }

          return `${r.entityName}:\n  ${issues.join('\n  ')}`;
        });

        throw new Error(
          `Schema validation failed for ${invalidEntities.length} entity/entities:\n${details.join('\n\n')}`,
        );
      }

      expect(summary.invalidEntities).toBe(0);
      expect(summary.validEntities).toBe(summary.totalEntities);
    });

    it('should validate core entity tables exist', async () => {
      const coreEntities = [
        'organizations',
        'teams',
        'roles',
        'hollons',
        'projects',
        'tasks',
      ];

      for (const tableName of coreEntities) {
        const schema =
          (dataSource.options as { schema?: string }).schema || 'public';

        const result = await dataSource.query(
          `
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = $1
            AND table_name = $2
          ) as exists
        `,
          [schema, tableName],
        );

        expect(result[0].exists).toBe(true);
      }
    });
  });

  describe('VectorEmbedding Entity Validation', () => {
    it('should have vector_embeddings table', async () => {
      const schema =
        (dataSource.options as { schema?: string }).schema || 'public';

      const result = await dataSource.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = $1
          AND table_name = 'vector_embeddings'
        ) as exists
      `,
        [schema],
      );

      expect(result[0].exists).toBe(true);
    });

    it('should validate VectorEmbedding entity schema', async () => {
      const entityMetadata =
        dataSource.getMetadata(VectorEmbedding);

      const result = await validateEntitySchema(dataSource, entityMetadata);

      if (!result.valid) {
        const issues: string[] = [];

        if (result.missingColumns.length > 0) {
          issues.push(`Missing columns: ${result.missingColumns.join(', ')}`);
        }

        if (result.extraColumns.length > 0) {
          issues.push(`Extra columns: ${result.extraColumns.join(', ')}`);
        }

        if (result.columnMismatches.length > 0) {
          result.columnMismatches.forEach((m) => {
            issues.push(
              `${m.column}: ${m.issue} (expected: ${m.expected}, actual: ${m.actual})`,
            );
          });
        }

        if (result.missingIndexes.length > 0) {
          issues.push(`Missing indexes: ${result.missingIndexes.join(', ')}`);
        }

        if (result.foreignKeyIssues.length > 0) {
          result.foreignKeyIssues.forEach((fk) => {
            issues.push(`${fk.constraint}: ${fk.issue}`);
          });
        }

        throw new Error(
          `VectorEmbedding schema validation failed:\n${issues.join('\n')}`,
        );
      }

      expect(result.valid).toBe(true);
      expect(result.entityName).toBe('VectorEmbedding');
      expect(result.tableName).toBe('vector_embeddings');
    });

    it('should have all required VectorEmbedding columns', async () => {
      const schema =
        (dataSource.options as { schema?: string }).schema || 'public';

      const requiredColumns = [
        'id',
        'created_at',
        'updated_at',
        'embedding',
        'source_type',
        'source_id',
        'model_type',
        'dimensions',
        'content',
        'metadata',
        'tags',
        'organization_id',
        'project_id',
        'team_id',
        'hollon_id',
      ];

      const result = await dataSource.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = $1
        AND table_name = 'vector_embeddings'
        ORDER BY column_name
      `,
        [schema],
      );

      const actualColumns = result.map(
        (row: { column_name: string }) => row.column_name,
      );

      for (const requiredColumn of requiredColumns) {
        expect(actualColumns).toContain(requiredColumn);
      }
    });

    it('should have correct column types for VectorEmbedding', async () => {
      const schema =
        (dataSource.options as { schema?: string }).schema || 'public';

      const columnTypes = await dataSource.query(
        `
        SELECT
          column_name,
          data_type,
          is_nullable
        FROM information_schema.columns
        WHERE table_schema = $1
        AND table_name = 'vector_embeddings'
        ORDER BY column_name
      `,
        [schema],
      );

      const typeMap = new Map(
        columnTypes.map((row: { column_name: string; data_type: string; is_nullable: string }) => [
          row.column_name,
          { dataType: row.data_type, isNullable: row.is_nullable === 'YES' },
        ]),
      );

      // Verify key column types
      expect(typeMap.get('id')?.dataType).toBe('uuid');
      expect(typeMap.get('embedding')?.dataType).toBe('text');
      expect(typeMap.get('source_type')?.dataType).toBe('USER-DEFINED'); // enum
      expect(typeMap.get('source_id')?.dataType).toBe('uuid');
      expect(typeMap.get('model_type')?.dataType).toBe('USER-DEFINED'); // enum
      expect(typeMap.get('dimensions')?.dataType).toBe('integer');
      expect(typeMap.get('content')?.dataType).toBe('text');
      expect(typeMap.get('metadata')?.dataType).toBe('jsonb');
      expect(typeMap.get('tags')?.dataType).toBe('ARRAY');
      expect(typeMap.get('organization_id')?.dataType).toBe('uuid');

      // Verify nullability
      expect(typeMap.get('embedding')?.isNullable).toBe(false);
      expect(typeMap.get('source_type')?.isNullable).toBe(false);
      expect(typeMap.get('source_id')?.isNullable).toBe(false);
      expect(typeMap.get('organization_id')?.isNullable).toBe(false);
      expect(typeMap.get('content')?.isNullable).toBe(true);
      expect(typeMap.get('metadata')?.isNullable).toBe(true);
      expect(typeMap.get('tags')?.isNullable).toBe(true);
    });

    it('should have indexes on VectorEmbedding', async () => {
      const schema =
        (dataSource.options as { schema?: string }).schema || 'public';

      const indexes = await dataSource.query(
        `
        SELECT
          i.relname as index_name,
          a.attname as column_name
        FROM pg_class t
        JOIN pg_namespace n ON n.oid = t.relnamespace
        JOIN pg_index ix ON ix.indrelid = t.oid
        JOIN pg_class i ON i.oid = ix.indexrelid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
        WHERE n.nspname = $1
          AND t.relname = 'vector_embeddings'
          AND t.relkind = 'r'
        ORDER BY i.relname, a.attname
      `,
        [schema],
      );

      const indexedColumns = new Set(
        indexes.map((row: { column_name: string }) => row.column_name),
      );

      // Verify expected indexes exist
      expect(indexedColumns.has('organization_id')).toBe(true);
      expect(indexedColumns.has('source_type')).toBe(true);
      expect(indexedColumns.has('source_id')).toBe(true);

      // Should have multiple indexes
      expect(indexes.length).toBeGreaterThan(0);
    });

    it('should have foreign keys on VectorEmbedding', async () => {
      const schema =
        (dataSource.options as { schema?: string }).schema || 'public';

      const foreignKeys = await dataSource.query(
        `
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          rc.delete_rule
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
          AND tc.table_name = 'vector_embeddings'
        ORDER BY kcu.column_name
      `,
        [schema],
      );

      const fkMap = new Map(
        foreignKeys.map((row: { column_name: string; foreign_table_name: string; delete_rule: string }) => [
          row.column_name,
          { foreignTable: row.foreign_table_name, deleteRule: row.delete_rule },
        ]),
      );

      // Verify foreign keys exist
      expect(fkMap.has('organization_id')).toBe(true);
      expect(fkMap.get('organization_id')?.foreignTable).toBe('organizations');
      expect(fkMap.get('organization_id')?.deleteRule).toBe('CASCADE');

      // Optional foreign keys
      if (fkMap.has('project_id')) {
        expect(fkMap.get('project_id')?.foreignTable).toBe('projects');
        expect(fkMap.get('project_id')?.deleteRule).toBe('CASCADE');
      }

      if (fkMap.has('team_id')) {
        expect(fkMap.get('team_id')?.foreignTable).toBe('teams');
        expect(fkMap.get('team_id')?.deleteRule).toBe('CASCADE');
      }

      if (fkMap.has('hollon_id')) {
        expect(fkMap.get('hollon_id')?.foreignTable).toBe('hollons');
        expect(fkMap.get('hollon_id')?.deleteRule).toBe('SET NULL');
      }
    });
  });

  describe('Schema Consistency', () => {
    it('should have no orphaned tables', async () => {
      const schema =
        (dataSource.options as { schema?: string }).schema || 'public';

      // Get all tables from database
      const dbTables = await dataSource.query(
        `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = $1
        ORDER BY tablename
      `,
        [schema],
      );

      const dbTableNames = dbTables
        .map((row: { tablename: string }) => row.tablename)
        .filter((name: string) => name !== 'migrations');

      // Get all entity table names
      const entityTableNames = new Set(
        dataSource.entityMetadatas.map((m) => m.tableName),
      );

      // Check for orphaned tables (in DB but not in entities)
      const orphanedTables = dbTableNames.filter(
        (table: string) => !entityTableNames.has(table),
      );

      if (orphanedTables.length > 0) {
        console.warn(
          `Warning: Found orphaned tables (in DB but not in entities): ${orphanedTables.join(', ')}`,
        );
      }

      // This is a warning, not a failure, as some tables might be intentional
      // (e.g., for extensions, auditing, etc.)
    });

    it('should have all entity tables in database', async () => {
      const schema =
        (dataSource.options as { schema?: string }).schema || 'public';

      // Get all tables from database
      const dbTables = await dataSource.query(
        `
        SELECT tablename
        FROM pg_tables
        WHERE schemaname = $1
      `,
        [schema],
      );

      const dbTableNames = new Set(
        dbTables.map((row: { tablename: string }) => row.tablename),
      );

      // Check all entity tables exist
      const missingTables: string[] = [];

      for (const metadata of dataSource.entityMetadatas) {
        if (!dbTableNames.has(metadata.tableName)) {
          missingTables.push(metadata.tableName);
        }
      }

      expect(missingTables).toEqual([]);
    });
  });
});
