import { DataSource } from 'typeorm';
import { getExecutedMigrations } from './migration-testing';

/**
 * Rollback Verification Utilities
 *
 * Tests migration rollback functionality to ensure migrations can be
 * safely reverted without data loss or schema corruption.
 */

/**
 * Result of a rollback verification test
 */
export interface RollbackVerificationResult {
  success: boolean;
  migrationName: string;
  upSuccess: boolean;
  downSuccess: boolean;
  schemaRestored: boolean;
  dataPreserved: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Snapshot of database state for comparison
 */
interface DatabaseSnapshot {
  tables: string[];
  tableColumns: Map<string, string[]>;
  executedMigrations: Array<{ name: string; timestamp: number }>;
}

/**
 * Capture current database state
 */
async function captureSnapshot(
  dataSource: DataSource,
): Promise<DatabaseSnapshot> {
  const schema = (dataSource.options as { schema?: string }).schema || 'public';

  // Get all tables
  const tablesResult = await dataSource.query(
    `
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = $1
    ORDER BY tablename
  `,
    [schema],
  );

  const tables = tablesResult
    .map((row: { tablename: string }) => row.tablename)
    .filter((name: string) => name !== 'migrations');

  // Get columns for each table
  const tableColumns = new Map<string, string[]>();

  for (const table of tables) {
    const columnsResult = await dataSource.query(
      `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `,
      [schema, table],
    );

    const columns = columnsResult.map(
      (row: { column_name: string }) => row.column_name,
    );
    tableColumns.set(table, columns);
  }

  // Get executed migrations
  const executedMigrations = await getExecutedMigrations(dataSource);

  return {
    tables,
    tableColumns,
    executedMigrations,
  };
}

/**
 * Compare two database snapshots
 */
function compareSnapshots(
  before: DatabaseSnapshot,
  after: DatabaseSnapshot,
): {
  identical: boolean;
  differences: string[];
} {
  const differences: string[] = [];

  // Compare tables
  const beforeTables = new Set(before.tables);
  const afterTables = new Set(after.tables);

  const missingTables = before.tables.filter((t) => !afterTables.has(t));
  const extraTables = after.tables.filter((t) => !beforeTables.has(t));

  if (missingTables.length > 0) {
    differences.push(`Missing tables: ${missingTables.join(', ')}`);
  }

  if (extraTables.length > 0) {
    differences.push(`Extra tables: ${extraTables.join(', ')}`);
  }

  // Compare columns for common tables
  const commonTables = before.tables.filter((t) => afterTables.has(t));

  for (const table of commonTables) {
    const beforeCols = before.tableColumns.get(table) || [];
    const afterCols = after.tableColumns.get(table) || [];

    const beforeColSet = new Set(beforeCols);
    const afterColSet = new Set(afterCols);

    const missingCols = beforeCols.filter((c) => !afterColSet.has(c));
    const extraCols = afterCols.filter((c) => !beforeColSet.has(c));

    if (missingCols.length > 0) {
      differences.push(
        `Table ${table} - Missing columns: ${missingCols.join(', ')}`,
      );
    }

    if (extraCols.length > 0) {
      differences.push(
        `Table ${table} - Extra columns: ${extraCols.join(', ')}`,
      );
    }
  }

  // Compare migration counts
  if (before.executedMigrations.length !== after.executedMigrations.length) {
    differences.push(
      `Migration count changed: ${before.executedMigrations.length} -> ${after.executedMigrations.length}`,
    );
  }

  return {
    identical: differences.length === 0,
    differences,
  };
}

/**
 * Verify that a migration can be rolled back successfully
 *
 * @param dataSource - Active database connection
 * @param testData - Optional test data to insert and verify preservation
 * @returns Verification result with detailed status
 */
export async function verifyMigrationRollback(
  dataSource: DataSource,
  testData?: {
    tableName: string;
    insert: () => Promise<void>;
    verify: () => Promise<boolean>;
  },
): Promise<RollbackVerificationResult> {
  const result: RollbackVerificationResult = {
    success: false,
    migrationName: '',
    upSuccess: false,
    downSuccess: false,
    schemaRestored: false,
    dataPreserved: true,
    errors: [],
    warnings: [],
  };

  try {
    // Capture initial state
    const initialSnapshot = await captureSnapshot(dataSource);
    const initialMigrationCount = initialSnapshot.executedMigrations.length;

    // Check if there are pending migrations
    const hasPending = await dataSource.showMigrations();

    if (!hasPending) {
      result.warnings.push('No pending migrations to test');
      result.success = true;
      return result;
    }

    // Run one migration
    const migrations = await dataSource.runMigrations({
      transaction: 'all',
      fake: false,
    });

    if (migrations.length === 0) {
      result.errors.push('Expected to run a migration, but none were run');
      return result;
    }

    result.migrationName = migrations[0].name;
    result.upSuccess = true;

    // Capture state after migration up
    const afterUpSnapshot = await captureSnapshot(dataSource);

    // Verify migration was recorded
    if (
      afterUpSnapshot.executedMigrations.length !==
      initialMigrationCount + 1
    ) {
      result.errors.push(
        'Migration was not properly recorded in migrations table',
      );
      return result;
    }

    // Insert test data if provided
    if (testData) {
      try {
        await testData.insert();
      } catch (error) {
        result.errors.push(
          `Failed to insert test data: ${error instanceof Error ? error.message : String(error)}`,
        );
        return result;
      }
    }

    // Revert the migration
    try {
      await dataSource.undoLastMigration({ transaction: 'all' });
      result.downSuccess = true;
    } catch (error) {
      result.errors.push(
        `Migration rollback failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return result;
    }

    // Capture state after rollback
    const afterDownSnapshot = await captureSnapshot(dataSource);

    // Verify schema was restored
    const comparison = compareSnapshots(initialSnapshot, afterDownSnapshot);

    if (comparison.identical) {
      result.schemaRestored = true;
    } else {
      result.errors.push(
        'Schema was not fully restored after rollback:',
        ...comparison.differences,
      );
    }

    // Verify test data if provided
    if (testData) {
      try {
        const dataExists = await testData.verify();
        result.dataPreserved = dataExists;

        if (!dataExists) {
          result.warnings.push(
            'Test data was not preserved after rollback (expected behavior)',
          );
        }
      } catch (error) {
        result.warnings.push(
          `Could not verify test data preservation: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }

    // Overall success if schema was restored and no errors occurred
    result.success = result.schemaRestored && result.errors.length === 0;

    return result;
  } catch (error) {
    result.errors.push(
      `Unexpected error during rollback verification: ${error instanceof Error ? error.message : String(error)}`,
    );
    return result;
  }
}

/**
 * Verify rollback for all migrations
 *
 * Tests each migration individually by:
 * 1. Running the migration
 * 2. Reverting it
 * 3. Verifying schema is restored
 * 4. Re-running the migration to continue
 *
 * @param dataSource - Active database connection
 * @returns Array of verification results for each migration
 */
export async function verifyAllMigrationRollbacks(
  dataSource: DataSource,
): Promise<RollbackVerificationResult[]> {
  const results: RollbackVerificationResult[] = [];

  // Check if there are any pending migrations
  let hasPending = await dataSource.showMigrations();

  while (hasPending) {
    const result = await verifyMigrationRollback(dataSource);
    results.push(result);

    if (!result.success) {
      // Stop on first failure
      break;
    }

    // Re-run the migration to continue testing next one
    await dataSource.runMigrations({ transaction: 'all' });

    // Check if there are more pending migrations
    hasPending = await dataSource.showMigrations();
  }

  return results;
}

/**
 * Test complete rollback cycle
 *
 * Runs all migrations, then reverts them all, then runs them again
 * to ensure the full cycle works correctly.
 *
 * @param dataSource - Active database connection
 * @returns Success status and any errors encountered
 */
export async function verifyCompleteRollbackCycle(
  dataSource: DataSource,
): Promise<{
  success: boolean;
  errors: string[];
  summary: string;
}> {
  const errors: string[] = [];

  try {
    // Capture initial state
    const initialSnapshot = await captureSnapshot(dataSource);

    // Run all migrations
    const upMigrations = await dataSource.runMigrations({ transaction: 'all' });
    console.log(`✓ Ran ${upMigrations.length} migration(s)`);

    // Capture state after migrations
    const afterUpSnapshot = await captureSnapshot(dataSource);

    // Revert all migrations
    const executedMigrations = await getExecutedMigrations(dataSource);

    for (let i = 0; i < executedMigrations.length; i++) {
      await dataSource.undoLastMigration({ transaction: 'all' });
    }
    console.log(`✓ Reverted ${executedMigrations.length} migration(s)`);

    // Capture state after revert
    const afterDownSnapshot = await captureSnapshot(dataSource);

    // Verify schema was restored (should only have migrations table)
    const comparison = compareSnapshots(initialSnapshot, afterDownSnapshot);

    if (!comparison.identical) {
      errors.push(
        'Schema was not fully restored after complete rollback:',
        ...comparison.differences,
      );
    }

    // Re-run migrations
    const rerunMigrations = await dataSource.runMigrations({
      transaction: 'all',
    });
    console.log(`✓ Re-ran ${rerunMigrations.length} migration(s)`);

    // Capture final state
    const finalSnapshot = await captureSnapshot(dataSource);

    // Compare final state with after-up state
    const finalComparison = compareSnapshots(afterUpSnapshot, finalSnapshot);

    if (!finalComparison.identical) {
      errors.push(
        'Schema after re-running migrations differs from first run:',
        ...finalComparison.differences,
      );
    }

    const success = errors.length === 0;
    const summary = success
      ? 'Complete rollback cycle succeeded'
      : `Complete rollback cycle failed: ${errors.join('; ')}`;

    return { success, errors, summary };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : String(error);
    errors.push(`Unexpected error: ${errorMessage}`);

    return {
      success: false,
      errors,
      summary: `Complete rollback cycle failed: ${errorMessage}`,
    };
  }
}
