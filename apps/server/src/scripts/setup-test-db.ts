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
  console.log('=== Test Database Setup ===\n');
  console.log(`Database: ${dataSource.options.database}`);
  console.log(
    `Schema: ${'schema' in dataSource.options ? dataSource.options.schema : 'public'}\n`,
  );

  await dataSource.initialize();

  console.log('Running migrations...\n');
  const migrations = await dataSource.runMigrations({ transaction: 'all' });

  console.log(`✅ Applied ${migrations.length} migrations:`);
  migrations.forEach((m) => console.log(`  - ${m.name}`));

  await dataSource.destroy();
  console.log('\n✅ Test database setup complete!');
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
