import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join, resolve } from 'path';

// Load environment variables
const projectRoot = resolve(__dirname, '../../../..');
dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config({ path: join(projectRoot, '.env') });

const schema = process.env.DB_SCHEMA || 'hollon';

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'hollon',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hollon',
  schema: schema,
  extra: {
    options: `-c search_path=${schema},public`,
  },
});

interface ExtensionInfo {
  extname: string;
  extversion: string;
  extnamespace: string;
}

interface TypeInfo {
  typname: string;
  typcategory: string;
}

interface IndexInfo {
  indexname: string;
  tablename: string;
  indexdef: string;
}

interface VectorTestResult {
  distance: number;
}

async function main(): Promise<void> {
  try {
    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  PostgreSQL pgvector Setup Verification ║');
    console.log('╚════════════════════════════════════════╝\n');

    await dataSource.initialize();
    console.log('✓ Connected to PostgreSQL\n');

    // Step 1: Check pgvector extension
    console.log('Step 1: Checking pgvector extension...');
    const extensions = await dataSource.query<ExtensionInfo[]>(
      `SELECT extname, extversion, extnamespace FROM pg_extension WHERE extname = 'vector'`,
    );

    if (extensions.length === 0) {
      console.log('  ✗ pgvector extension not installed\n');
      process.exit(1);
    }

    const extension = extensions[0];
    console.log(`  ✓ pgvector extension found (version ${extension.extversion})\n`);

    // Step 2: Check vector type availability
    console.log('Step 2: Checking vector type availability...');
    const types = await dataSource.query<TypeInfo[]>(
      `SELECT typname, typcategory FROM pg_type WHERE typname = 'vector'`,
    );

    if (types.length === 0) {
      console.log('  ✗ Vector type not available\n');
      process.exit(1);
    }

    console.log(`  ✓ Vector type is available (category: ${types[0].typcategory})\n`);

    // Step 3: Test vector operations
    console.log('Step 3: Testing vector operations...');
    const testVector1 = [1, 2, 3];
    const testVector2 = [4, 5, 6];

    try {
      const result = await dataSource.query<VectorTestResult[]>(
        `SELECT $1::vector <-> $2::vector AS distance`,
        [JSON.stringify(testVector1), JSON.stringify(testVector2)],
      );

      const distance = parseFloat(result[0].distance.toString());
      console.log(`  ✓ Vector operations working (L2 distance: ${distance.toFixed(2)})\n`);
    } catch (error) {
      console.log(`  ✗ Vector operations test failed: ${(error as Error).message}\n`);
      throw error;
    }

    // Step 4: Check documents table structure
    console.log('Step 4: Checking documents table structure...');
    const tableColumns = await dataSource.query<Array<{column_name: string; data_type: string; udt_name?: string}>>(
      `
        SELECT column_name, data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'documents' AND table_schema = $1
        ORDER BY ordinal_position
      `,
      [schema],
    );

    if (tableColumns.length === 0) {
      console.log('  ⚠ Documents table not found (may not be migrated yet)\n');
    } else {
      const embeddingColumn = tableColumns.find((col) => col.column_name === 'embedding');
      if (!embeddingColumn) {
        console.log('  ⚠ Embedding column not found in documents table\n');
      } else {
        const colType = embeddingColumn.udt_name || embeddingColumn.data_type;
        if (colType === 'vector') {
          console.log('  ✓ Embedding column has vector type\n');
        } else {
          console.log(`  ⚠ Embedding column has type "${colType}" (expected "vector")\n`);
        }
      }
    }

    // Step 5: Check vector indexes
    console.log('Step 5: Checking vector indexes...');
    const indexes = await dataSource.query<IndexInfo[]>(
      `
        SELECT indexname, tablename, indexdef
        FROM pg_indexes
        WHERE tablename = 'documents' AND table_schema = $1
        AND indexname LIKE '%embedding%'
        ORDER BY indexname
      `,
      [schema],
    );

    if (indexes.length === 0) {
      console.log('  ⚠ No vector indexes found (may not be migrated yet)\n');
    } else {
      console.log(`  ✓ Found ${indexes.length} vector index(es):\n`);
      indexes.forEach((idx) => {
        const indexType = idx.indexdef.includes('hnsw')
          ? 'HNSW'
          : idx.indexdef.includes('ivfflat')
            ? 'IVFFlat'
            : 'Unknown';
        console.log(`    - ${idx.indexname} (${indexType})`);
      });
      console.log();
    }

    // Step 6: Check index sizes (if indexes exist)
    if (indexes.length > 0) {
      console.log('Step 6: Checking index sizes...');
      const indexSizes = await dataSource.query<Array<{indexname: string; size: string}>>(
        `
          SELECT indexname, pg_size_pretty(pg_relation_size(indexrelid)) AS size
          FROM pg_indexes
          WHERE tablename = 'documents' AND table_schema = $1
          AND indexname LIKE '%embedding%'
        `,
        [schema],
      );

      indexSizes.forEach((idx) => {
        console.log(`  ${idx.indexname}: ${idx.size}`);
      });
      console.log();
    }

    // Summary
    console.log('╔════════════════════════════════════════╗');
    console.log('║        Setup Verification Complete      ║');
    console.log('║         pgvector is ready to use!       ║');
    console.log('╚════════════════════════════════════════╝\n');

    console.log('Next steps:');
    console.log('1. Run migrations: pnpm dev:db:migrate');
    console.log('2. Generate embeddings for documents');
    console.log('3. Use similarity search in your queries\n');
  } catch (error) {
    console.error('\n✗ Verification failed:', (error as Error).message);
    if ((error as Error).stack) {
      console.error((error as Error).stack);
    }
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

main();
