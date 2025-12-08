/* eslint-disable no-console */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join, resolve } from 'path';

// Load test environment variables
const projectRoot = resolve(__dirname, '../../../..');
dotenv.config({ path: join(projectRoot, '.env.test') });

const dataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'hollon',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hollon',
  schema: process.env.DB_SCHEMA || 'hollon_test',
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
  synchronize: false,
});

async function main() {
  const schema =
    'schema' in dataSource.options
      ? (dataSource.options.schema as string) || 'public'
      : 'public';

  console.log('=== Reset Test Database ===\n');
  console.log(`Database: ${dataSource.options.database}`);
  console.log(`Schema: ${schema}\n`);

  await dataSource.initialize();

  console.log('⚠️  Dropping schema cascade...');
  await dataSource.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  console.log('✅ Schema dropped\n');

  console.log('Creating schema...');
  await dataSource.query(`CREATE SCHEMA "${schema}"`);
  console.log('✅ Schema created\n');

  // Recreate extensions (must be in public or a system schema)
  await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
  await dataSource.query(`CREATE EXTENSION IF NOT EXISTS vector`);

  // Set search_path to include both test schema and public for extensions
  await dataSource.query(`SET search_path TO "${schema}", public`);
  console.log(`✅ search_path set to ${schema}, public\n`);

  console.log('Running migrations...\n');
  const migrations = await dataSource.runMigrations({ transaction: 'all' });

  console.log(`✅ Applied ${migrations.length} migrations:`);
  migrations.forEach((m) => console.log(`  - ${m.name}`));

  await dataSource.destroy();
  console.log('\n✅ Test database reset complete!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
