/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import dataSource from '../config/typeorm.config';

async function main() {
  await dataSource.initialize();

  console.log('=== Database State Check ===\n');

  const schema =
    'schema' in dataSource.options
      ? (dataSource.options.schema as string) || 'public'
      : 'public';

  // Check existing tables
  const tables = await dataSource.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = '${schema}'
    ORDER BY table_name
  `);

  console.log(`Schema: ${schema}`);
  console.log(`\nExisting tables (${tables.length}):`);
  tables.forEach((t: any) => console.log(`  - ${t.table_name}`));

  // Check migration records
  try {
    const migrations = await dataSource.query(`
      SELECT * FROM "${schema}"."migrations"
      ORDER BY id
    `);
    console.log(`\nMigration records (${migrations.length}):`);
    migrations.forEach((m: any) =>
      console.log(`  - ${m.name} (${m.timestamp})`),
    );
  } catch {
    console.log('\nMigrations table: NOT FOUND');
  }

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
