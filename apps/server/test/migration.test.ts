import { DataSource } from 'typeorm';
import {
  initializeTestDatabase,
  closeTestDatabase,
} from './test-db-config';
import {
  setupTestSchema,
  cleanDatabase,
  teardownTestSchema,
} from './setup/test-database';

/**
 * Migration Test Suite
 *
 * Tests database migrations to ensure:
 * - Migrations run successfully from a clean state
 * - Schema is created correctly with all tables
 * - Database connection works properly
 * - Schema isolation works for parallel test execution
 *
 * These tests validate the migration infrastructure needed for E2E tests.
 */
describe('Database Migrations', () => {
  let dataSource: DataSource;

  beforeAll(async () => {
    // Initialize database connection
    dataSource = await initializeTestDatabase();

    // Setup test schema and run migrations
    await setupTestSchema(dataSource);
  });

  afterAll(async () => {
    // Clean up test schema
    await teardownTestSchema(dataSource);

    // Close database connection
    await closeTestDatabase(dataSource);
  });

  afterEach(async () => {
    // Clean database between tests
    await cleanDatabase(dataSource);
  });

  describe('Database Connection', () => {
    it('should connect to test database', async () => {
      expect(dataSource.isInitialized).toBe(true);
    });

    it('should use correct schema for worker', async () => {
      const workerId = process.env.JEST_WORKER_ID || '1';
      const normalizedWorkerId = workerId.replace(/\D/g, '') || '1';
      const expectedSchema = `hollon_test_worker_${normalizedWorkerId}`;

      const schema = (dataSource.options as { schema?: string }).schema;
      expect(schema).toBe(expectedSchema);
    });

    it('should execute queries successfully', async () => {
      const result = await dataSource.query('SELECT 1 as value');
      expect(result).toEqual([{ value: 1 }]);
    });
  });

  describe('Schema Setup', () => {
    it('should have migrations table', async () => {
      const schema =
        (dataSource.options as { schema?: string }).schema || 'public';

      const result = await dataSource.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = '${schema}'
          AND table_name = 'migrations'
        ) as exists
      `);

      expect(result[0].exists).toBe(true);
    });

    it('should have applied migrations', async () => {
      const migrations = await dataSource.query(
        'SELECT * FROM migrations ORDER BY id',
      );

      expect(migrations.length).toBeGreaterThan(0);
      expect(migrations[0]).toHaveProperty('id');
      expect(migrations[0]).toHaveProperty('timestamp');
      expect(migrations[0]).toHaveProperty('name');
    });

    it('should have core entity tables', async () => {
      const schema =
        (dataSource.options as { schema?: string }).schema || 'public';

      // Core tables that should exist after migrations
      const expectedTables = [
        'organizations',
        'teams',
        'roles',
        'hollons',
        'projects',
        'tasks',
      ];

      for (const tableName of expectedTables) {
        const result = await dataSource.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_schema = '${schema}'
            AND table_name = '${tableName}'
          ) as exists
        `);

        expect(result[0].exists).toBe(true);
      }
    });
  });

  describe('Migration Operations', () => {
    it('should report no pending migrations', async () => {
      const pendingMigrations = await dataSource.showMigrations();
      expect(pendingMigrations).toBe(false);
    });

    it('should have correct search_path set', async () => {
      const schema =
        (dataSource.options as { schema?: string }).schema || 'public';

      const result = await dataSource.query('SHOW search_path');
      const searchPath = result[0].search_path;

      expect(searchPath).toContain(schema);
    });
  });

  describe('Database Cleanup', () => {
    it('should clean database without errors', async () => {
      // Insert test data
      await dataSource.query(`
        INSERT INTO organizations (id, name, slug, created_at, updated_at)
        VALUES (gen_random_uuid(), 'Test Org', 'test-org', NOW(), NOW())
      `);

      // Verify data exists
      const beforeClean = await dataSource.query(
        'SELECT COUNT(*) as count FROM organizations',
      );
      expect(parseInt(beforeClean[0].count)).toBeGreaterThan(0);

      // Clean database
      await cleanDatabase(dataSource);

      // Verify data is removed
      const afterClean = await dataSource.query(
        'SELECT COUNT(*) as count FROM organizations',
      );
      expect(parseInt(afterClean[0].count)).toBe(0);
    });

    it('should preserve schema structure after cleanup', async () => {
      // Clean database
      await cleanDatabase(dataSource);

      // Verify tables still exist
      const schema =
        (dataSource.options as { schema?: string }).schema || 'public';

      const result = await dataSource.query(`
        SELECT COUNT(*) as count
        FROM information_schema.tables
        WHERE table_schema = '${schema}'
        AND table_name = 'organizations'
      `);

      expect(parseInt(result[0].count)).toBe(1);
    });
  });
});
