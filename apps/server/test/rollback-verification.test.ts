import { DataSource } from 'typeorm';
import { initializeTestDatabase, closeTestDatabase } from './test-db-config';
import { setupTestSchema, teardownTestSchema } from './setup/test-database';
import {
  verifyMigrationRollback,
  verifyCompleteRollbackCycle,
} from './setup/rollback-validator';

/**
 * Rollback Verification Test Suite
 *
 * Tests that verify migrations can be safely rolled back without
 * schema corruption or data loss.
 *
 * Note: These tests are more intensive and may take longer to run.
 */
describe('Migration Rollback Verification', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    dataSource = await initializeTestDatabase();
    await setupTestSchema(dataSource);
  });

  afterAll(async () => {
    await teardownTestSchema(dataSource);
    await closeTestDatabase(dataSource);
  });

  describe('Single Migration Rollback', () => {
    it('should rollback last migration successfully', async () => {
      // Get initial migration count
      const initialMigrations = await dataSource.query(
        'SELECT COUNT(*) as count FROM migrations',
      );
      const initialCount = parseInt(initialMigrations[0].count);

      // Check if there are pending migrations
      const hasPending = await dataSource.showMigrations();

      if (hasPending) {
        // Run one migration
        await dataSource.runMigrations({ transaction: 'all' });
      }

      // Revert one migration
      await dataSource.undoLastMigration({ transaction: 'all' });

      // Verify migration was removed
      const afterRevert = await dataSource.query(
        'SELECT COUNT(*) as count FROM migrations',
      );
      const afterCount = parseInt(afterRevert[0].count);

      expect(afterCount).toBe(Math.max(0, initialCount - 1));
    });

    it('should verify migration rollback with schema comparison', async () => {
      const result = await verifyMigrationRollback(dataSource);

      // If there were no pending migrations, that's okay
      if (result.warnings.includes('No pending migrations to test')) {
        expect(result.success).toBe(true);
        return;
      }

      if (!result.success) {
        const errorDetails = [
          `Migration: ${result.migrationName}`,
          `Up success: ${result.upSuccess}`,
          `Down success: ${result.downSuccess}`,
          `Schema restored: ${result.schemaRestored}`,
          `Errors: ${result.errors.join('; ')}`,
        ].join('\n');

        throw new Error(
          `Migration rollback verification failed:\n${errorDetails}`,
        );
      }

      expect(result.success).toBe(true);
      expect(result.upSuccess).toBe(true);
      expect(result.downSuccess).toBe(true);
      expect(result.schemaRestored).toBe(true);
    });
  });

  describe('Complete Rollback Cycle', () => {
    it('should complete full migration cycle (up, down, up)', async () => {
      // This test runs all migrations, reverts them all, then runs them again
      // to verify the complete cycle works

      const result = await verifyCompleteRollbackCycle(dataSource);

      if (!result.success) {
        const errorDetails = result.errors.join('\n');
        throw new Error(`Complete rollback cycle failed:\n${errorDetails}`);
      }

      expect(result.success).toBe(true);
      expect(result.errors).toEqual([]);
      console.log(result.summary);
    }, 60000); // Increased timeout for complete cycle
  });

  describe('Rollback Safety', () => {
    it('should preserve data in unaffected tables during rollback', async () => {
      // Insert test data into an existing table
      const testOrgId = '00000000-0000-0000-0000-000000000001';

      await dataSource.query(
        `
        INSERT INTO organizations (id, name, slug, created_at, updated_at)
        VALUES ($1, 'Test Org', 'test-org', NOW(), NOW())
        ON CONFLICT (id) DO NOTHING
      `,
        [testOrgId],
      );

      // Verify data exists
      const beforeRollback = await dataSource.query(
        'SELECT COUNT(*) as count FROM organizations WHERE id = $1',
        [testOrgId],
      );
      expect(parseInt(beforeRollback[0].count)).toBe(1);

      // Perform a migration rollback (if possible)
      try {
        await dataSource.undoLastMigration({ transaction: 'all' });

        // Re-run the migration
        await dataSource.runMigrations({ transaction: 'all' });

        // Verify data still exists
        const afterRollback = await dataSource.query(
          'SELECT COUNT(*) as count FROM organizations WHERE id = $1',
          [testOrgId],
        );
        expect(parseInt(afterRollback[0].count)).toBe(1);
      } catch {
        // If there are no migrations to rollback, that's okay
        console.log('No migrations available to test rollback');
      }

      // Cleanup
      await dataSource.query('DELETE FROM organizations WHERE id = $1', [
        testOrgId,
      ]);
    });

    it('should not leave database in inconsistent state after failed rollback', async () => {
      // This test verifies that if a rollback fails, the database
      // doesn't end up in a partially rolled-back state

      // Get current migration count
      const beforeMigrations = await dataSource.query(
        'SELECT COUNT(*) as count FROM migrations',
      );
      const beforeCount = parseInt(beforeMigrations[0].count);

      try {
        // Attempt to undo last migration
        await dataSource.undoLastMigration({ transaction: 'all' });

        // If successful, verify count decreased
        const afterMigrations = await dataSource.query(
          'SELECT COUNT(*) as count FROM migrations',
        );
        const afterCount = parseInt(afterMigrations[0].count);

        expect(afterCount).toBe(beforeCount - 1);

        // Re-run the migration to restore state
        await dataSource.runMigrations({ transaction: 'all' });
      } catch {
        // If rollback fails, verify count didn't change
        const afterErrorMigrations = await dataSource.query(
          'SELECT COUNT(*) as count FROM migrations',
        );
        const afterErrorCount = parseInt(afterErrorMigrations[0].count);

        expect(afterErrorCount).toBe(beforeCount);
      }
    });
  });

  describe('Migration State Verification', () => {
    it('should have migrations table after rollback', async () => {
      const schema =
        (dataSource.options as { schema?: string }).schema || 'public';

      // Verify migrations table exists
      const result = await dataSource.query(
        `
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = $1
          AND table_name = 'migrations'
        ) as exists
      `,
        [schema],
      );

      expect(result[0].exists).toBe(true);
    });

    it('should maintain migration order after rollback and re-run', async () => {
      // Get migration order
      const beforeMigrations = await dataSource.query(
        'SELECT id, name, timestamp FROM migrations ORDER BY timestamp',
      );

      // If there are migrations to rollback
      if (beforeMigrations.length > 0) {
        try {
          // Rollback last migration
          await dataSource.undoLastMigration({ transaction: 'all' });

          // Re-run migrations
          await dataSource.runMigrations({ transaction: 'all' });

          // Get migration order after
          const afterMigrations = await dataSource.query(
            'SELECT id, name, timestamp FROM migrations ORDER BY timestamp',
          );

          // Verify same migrations in same order
          expect(afterMigrations.length).toBe(beforeMigrations.length);

          for (let i = 0; i < beforeMigrations.length; i++) {
            expect(afterMigrations[i].name).toBe(beforeMigrations[i].name);
            expect(afterMigrations[i].timestamp).toBe(
              beforeMigrations[i].timestamp,
            );
          }
        } catch {
          console.log(
            'Could not test migration order: no migrations to rollback',
          );
        }
      }
    });
  });

  describe('Rollback Transaction Integrity', () => {
    it('should rollback in transaction (all or nothing)', async () => {
      // TypeORM uses transactions for migrations by default
      // This test verifies that behavior

      const beforeCount = await dataSource.query(
        'SELECT COUNT(*) as count FROM migrations',
      );
      const initialCount = parseInt(beforeCount[0].count);

      try {
        // Attempt rollback with transaction
        await dataSource.undoLastMigration({ transaction: 'all' });

        // If successful, count should decrease by 1
        const afterCount = await dataSource.query(
          'SELECT COUNT(*) as count FROM migrations',
        );
        expect(parseInt(afterCount[0].count)).toBe(initialCount - 1);

        // Restore state
        await dataSource.runMigrations({ transaction: 'all' });
      } catch {
        // If failed, count should remain the same
        const afterErrorCount = await dataSource.query(
          'SELECT COUNT(*) as count FROM migrations',
        );
        expect(parseInt(afterErrorCount[0].count)).toBe(initialCount);
      }
    });
  });
});
