import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';

/**
 * Get TypeORM configuration for test environment
 * Supports Jest worker parallelization with schema isolation
 */
export function getTestDatabaseConfig(configService: ConfigService) {
  const workerId = process.env.JEST_WORKER_ID || '1';
  const schemaName = `hollon_test_worker_${workerId}`;

  return {
    type: 'postgres' as const,
    host: configService.get('DB_HOST', 'localhost'),
    port: configService.get('DB_PORT', 5434),
    username: configService.get('DB_USER', 'hollon'),
    password: configService.get('DB_PASSWORD', 'hollon_dev_password'),
    database: configService.get('DB_NAME', 'hollon'),
    schema: schemaName,
    entities: [__dirname + '/../../src/**/*.entity{.ts,.js}'],
    synchronize: true, // Auto-create schema from entities in test mode
    logging: false,
  };
}

/**
 * Create and initialize test schema
 * Runs migrations to set up database structure
 */
export async function setupTestSchema(dataSource: DataSource): Promise<void> {
  const schema = dataSource.options.schema as string;

  try {
    // Create schema if it doesn't exist
    await dataSource.query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
    console.log(`✓ Test schema created: ${schema}`);

    // Run migrations on the test schema
    await dataSource.runMigrations({ transaction: 'all' });
    console.log(`✓ Migrations completed for: ${schema}`);
  } catch (error) {
    console.error(`✗ Failed to setup test schema ${schema}:`, error);
    throw error;
  }
}

/**
 * Clean all data from test database
 * Uses TRUNCATE with FK constraint bypass for speed
 */
export async function cleanDatabase(dataSource: DataSource): Promise<void> {
  const schema = dataSource.options.schema as string;

  try {
    // Temporarily disable FK constraints
    await dataSource.query('SET session_replication_role = replica;');

    // Get all tables in the test schema
    const tables = await dataSource.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = '${schema}'
    `);

    // Truncate all tables
    for (const { tablename } of tables) {
      await dataSource.query(`TRUNCATE TABLE ${schema}.${tablename} CASCADE`);
    }

    // Re-enable FK constraints
    await dataSource.query('SET session_replication_role = DEFAULT;');
  } catch (error) {
    console.error(`✗ Failed to clean database ${schema}:`, error);
    throw error;
  }
}

/**
 * Drop test schema completely
 * Used for cleanup after all tests complete
 */
export async function teardownTestSchema(
  dataSource: DataSource,
): Promise<void> {
  const schema = dataSource.options.schema as string;

  try {
    await dataSource.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    console.log(`✓ Test schema dropped: ${schema}`);
  } catch (error) {
    console.error(`✗ Failed to drop test schema ${schema}:`, error);
    throw error;
  }
}

/**
 * Verify test database connection
 */
export async function verifyConnection(dataSource: DataSource): Promise<void> {
  try {
    await dataSource.query('SELECT 1');
    console.log('✓ Test database connection verified');
  } catch (error) {
    console.error('✗ Test database connection failed:', error);
    throw error;
  }
}
