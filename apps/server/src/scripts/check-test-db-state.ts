/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join, resolve } from 'path';

// Load environment variables and set test mode
const projectRoot = resolve(__dirname, '../../../..');
process.env.NODE_ENV = 'test';
dotenv.config({ path: join(projectRoot, '.env') });

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'hollon',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hollon_test',
  schema: process.env.DB_SCHEMA || 'hollon',
});

async function main() {
  await dataSource.initialize();

  const schema =
    'schema' in dataSource.options
      ? (dataSource.options.schema as string) || 'public'
      : 'public';

  console.log('=== Test Database State Check ===\n');
  console.log(`Database: ${dataSource.options.database}`);
  console.log(`Schema: ${schema}\n`);

  // Check existing tables
  const tables = await dataSource.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = '${schema}'
    ORDER BY table_name
  `);

  console.log(`Existing tables (${tables.length}):`);
  tables.forEach((t: any) => console.log(`  - ${t.table_name}`));

  // Check migration records
  try {
    const migrations = await dataSource.query(`
      SELECT * FROM "${schema}"."migrations"
      ORDER BY id
    `);
    console.log(`\nMigration records (${migrations.length}):`);
    migrations.forEach((m: any) =>
      console.log(`  - ${m.name} (${m.timestamp})`),
    );
  } catch {
    console.log('\nMigrations table: NOT FOUND');
  }

  // Check for specific columns
  const orgColumns = await dataSource.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = '${schema}'
      AND table_name = 'organizations'
    ORDER BY ordinal_position
  `);

  console.log(`\nOrganization table columns:`);
  orgColumns.forEach((c: any) => console.log(`  - ${c.column_name}`));

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
