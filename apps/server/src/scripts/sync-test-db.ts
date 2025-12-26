/* eslint-disable no-console */
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
  database: process.env.DB_NAME || 'hollon',
  schema: process.env.DB_SCHEMA || 'hollon_test',
  entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
  synchronize: true, // This will drop and recreate tables based on entities
  dropSchema: true, // This will drop the schema first
});

async function main() {
  const schema =
    'schema' in dataSource.options
      ? (dataSource.options.schema as string) || 'public'
      : 'public';

  console.log('=== Sync Test Database with Entities ===\n');
  console.log(`Database: ${dataSource.options.database}`);
  console.log(`Schema: ${schema}\n`);
  console.log(
    '⚠️  This will DROP and RECREATE all tables based on entity definitions\n',
  );

  await dataSource.initialize();

  console.log('✅ Database synchronized with entities!');
  console.log('\nAll tables have been created from entity definitions.');

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
