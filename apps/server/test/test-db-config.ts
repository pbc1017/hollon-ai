import { DataSource, DataSourceOptions } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { getTestDatabaseConfig } from './setup/test-database';

/**
 * Test database configuration factory
 * Creates a TypeORM DataSource for migration testing
 *
 * This configuration:
 * - Uses schema isolation per Jest worker (hollon_test_worker_N)
 * - Supports parallel test execution
 * - Loads entities and migrations from the src directory
 * - Disables synchronize to test migrations explicitly
 */
export function createTestDataSource(
  configService?: ConfigService,
): DataSource {
  // Create a default ConfigService if not provided
  const config = configService || new ConfigService();

  const options = getTestDatabaseConfig(config) as DataSourceOptions;

  return new DataSource(options);
}

/**
 * Initialize test database connection
 * Creates DataSource, initializes connection, and verifies it's working
 *
 * @returns Initialized and connected DataSource
 */
export async function initializeTestDatabase(): Promise<DataSource> {
  const configService = new ConfigService();
  const dataSource = createTestDataSource(configService);

  try {
    await dataSource.initialize();
    console.log('✓ Test database connection initialized');

    // Verify connection is working
    await dataSource.query('SELECT 1');
    console.log('✓ Test database connection verified');

    return dataSource;
  } catch (error) {
    console.error('✗ Failed to initialize test database:', error);
    throw error;
  }
}

/**
 * Close test database connection
 * Safely destroys the DataSource connection
 *
 * @param dataSource - The DataSource to close
 */
export async function closeTestDatabase(
  dataSource: DataSource,
): Promise<void> {
  try {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
      console.log('✓ Test database connection closed');
    }
  } catch (error) {
    console.error('✗ Failed to close test database:', error);
    throw error;
  }
}
