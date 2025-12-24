import { DataSource } from 'typeorm';

/**
 * Truncate all tables in the current schema.
 * This is safer than dropDatabase() as it preserves the schema structure.
 */
export async function truncateAllTables(dataSource: DataSource): Promise<void> {
  const queryRunner = dataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    // Get all table names in the current schema
    const tables = await queryRunner.query(`
      SELECT tablename FROM pg_tables
      WHERE schemaname = current_schema()
      AND tablename != 'migrations'
    `);

    if (tables.length > 0) {
      // Disable foreign key checks and truncate all tables
      const tableNames = tables
        .map((t: { tablename: string }) => `"${t.tablename}"`)
        .join(', ');
      await queryRunner.query(
        `TRUNCATE ${tableNames} RESTART IDENTITY CASCADE`,
      );
    }
  } finally {
    await queryRunner.release();
  }
}

/**
 * Clean up test data without dropping the schema.
 * Use this in afterAll() instead of dataSource.dropDatabase().
 */
export async function cleanupTestData(dataSource: DataSource): Promise<void> {
  await truncateAllTables(dataSource);
}
