import { DataSource } from 'typeorm';

/**
 * Migration Testing Utilities
 *
 * Provides utilities for testing database migrations, including:
 * - Running specific migrations
 * - Rolling back migrations
 * - Verifying migration state
 */

/**
 * Get list of pending migrations
 */
export async function getPendingMigrations(
  dataSource: DataSource,
): Promise<string[]> {
  const pendingMigrations = await dataSource.showMigrations();
  const migrations = await dataSource.migrations;
  
  if (!pendingMigrations) {
    return [];
  }

  // Get all migration names
  return migrations.map(m => m.name);
}

/**
 * Get list of executed migrations
 */
export async function getExecutedMigrations(
  dataSource: DataSource,
): Promise<Array<{ name: string; timestamp: number }>> {
  try {
    const executedMigrations = await dataSource.query(`
      SELECT name, timestamp
      FROM migrations
      ORDER BY timestamp ASC
    `);
    return executedMigrations;
  } catch {
    // If migrations table doesn't exist, no migrations have been run
    return [];
  }
}

/**
 * Run all pending migrations
 * Returns the number of migrations executed
 */
export async function runMigrations(
  dataSource: DataSource,
): Promise<number> {
  try {
    const migrations = await dataSource.runMigrations({ transaction: 'all' });
    console.log(`✓ Ran ${migrations.length} migration(s)`);
    return migrations.length;
  } catch (error) {
    console.error('✗ Failed to run migrations:', error);
    throw error;
  }
}

/**
 * Revert the last migration
 * Useful for testing migration rollback
 */
export async function revertLastMigration(
  dataSource: DataSource,
): Promise<void> {
  try {
    await dataSource.undoLastMigration({ transaction: 'all' });
    console.log('✓ Reverted last migration');
  } catch (error) {
    console.error('✗ Failed to revert migration:', error);
    throw error;
  }
}

/**
 * Revert multiple migrations
 * @param count Number of migrations to revert
 */
export async function revertMigrations(
  dataSource: DataSource,
  count: number,
): Promise<void> {
  try {
    for (let i = 0; i < count; i++) {
      await dataSource.undoLastMigration({ transaction: 'all' });
    }
    console.log(`✓ Reverted ${count} migration(s)`);
  } catch (error) {
    console.error(`✗ Failed to revert ${count} migration(s):`, error);
    throw error;
  }
}

/**
 * Verify migration state
 * Checks if all migrations have been executed
 */
export async function verifyMigrationState(
  dataSource: DataSource,
): Promise<{ allExecuted: boolean; pending: number; executed: number }> {
  const hasPending = await dataSource.showMigrations();
  const executed = await getExecutedMigrations(dataSource);
  const total = dataSource.migrations.length;
  
  return {
    allExecuted: !hasPending,
    pending: hasPending ? total - executed.length : 0,
    executed: executed.length,
  };
}

/**
 * Test migration up/down cycle
 * Runs a migration and then reverts it to ensure both directions work
 */
export async function testMigrationCycle(
  dataSource: DataSource,
): Promise<boolean> {
  try {
    // Get initial state
    const initialExecuted = await getExecutedMigrations(dataSource);
    
    // Run one migration
    const migrations = await dataSource.runMigrations({ transaction: 'all' });
    if (migrations.length === 0) {
      console.log('⚠ No pending migrations to test');
      return true;
    }
    
    console.log(`✓ Migration up successful: ${migrations[0].name}`);
    
    // Verify it was executed
    const afterUpExecuted = await getExecutedMigrations(dataSource);
    if (afterUpExecuted.length !== initialExecuted.length + 1) {
      throw new Error('Migration was not recorded in migrations table');
    }
    
    // Revert the migration
    await dataSource.undoLastMigration({ transaction: 'all' });
    console.log(`✓ Migration down successful: ${migrations[0].name}`);
    
    // Verify it was reverted
    const afterDownExecuted = await getExecutedMigrations(dataSource);
    if (afterDownExecuted.length !== initialExecuted.length) {
      throw new Error('Migration revert was not recorded in migrations table');
    }
    
    return true;
  } catch (error) {
    console.error('✗ Migration cycle test failed:', error);
    throw error;
  }
}

/**
 * Reset migrations to a clean state
 * Reverts all migrations - useful for testing from scratch
 */
export async function resetMigrations(
  dataSource: DataSource,
): Promise<void> {
  try {
    const executed = await getExecutedMigrations(dataSource);
    
    // Revert all migrations
    for (let i = 0; i < executed.length; i++) {
      await dataSource.undoLastMigration({ transaction: 'all' });
    }
    
    console.log(`✓ Reset complete: reverted ${executed.length} migration(s)`);
  } catch (error) {
    console.error('✗ Failed to reset migrations:', error);
    throw error;
  }
}

/**
 * Verify schema structure matches expectations
 * Useful for verifying migrations created the correct tables
 */
export async function verifySchemaStructure(
  dataSource: DataSource,
  expectedTables: string[],
): Promise<{ valid: boolean; missing: string[]; extra: string[] }> {
  const schema = (dataSource.options as { schema?: string }).schema || 'public';
  
  try {
    // Get all tables in the schema
    const result = await dataSource.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = $1
      ORDER BY tablename
    `, [schema]);
    
    const actualTables = result
      .map((row: { tablename: string }) => row.tablename)
      .filter((name: string) => name !== 'migrations'); // Exclude TypeORM migrations table
    
    const expectedSet = new Set(expectedTables);
    const actualSet = new Set(actualTables);
    
    const missing = expectedTables.filter(table => !actualSet.has(table));
    const extra = actualTables.filter(table => !expectedSet.has(table));
    
    return {
      valid: missing.length === 0 && extra.length === 0,
      missing,
      extra,
    };
  } catch (error) {
    console.error('✗ Failed to verify schema structure:', error);
    throw error;
  }
}
