/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import dataSource from '../config/typeorm.config';

async function main() {
  await dataSource.initialize();

  const schema =
    'schema' in dataSource.options
      ? (dataSource.options.schema as string) || 'public'
      : 'public';

  console.log('=== Tasks Table Structure ===\n');

  const columns = await dataSource.query(`
    SELECT
      column_name,
      data_type,
      is_nullable,
      column_default
    FROM information_schema.columns
    WHERE table_schema = '${schema}'
      AND table_name = 'tasks'
    ORDER BY ordinal_position
  `);

  console.log('Columns:');
  columns.forEach((c: any) => {
    console.log(
      `  - ${c.column_name}: ${c.data_type} (nullable: ${c.is_nullable})`,
    );
  });

  // Check constraints
  const constraints = await dataSource.query(`
    SELECT
      constraint_name,
      constraint_type
    FROM information_schema.table_constraints
    WHERE table_schema = '${schema}'
      AND table_name = 'tasks'
  `);

  console.log('\nConstraints:');
  constraints.forEach((c: any) => {
    console.log(`  - ${c.constraint_name}: ${c.constraint_type}`);
  });

  // Check if goals table exists
  const goalsTables = await dataSource.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = '${schema}'
      AND table_name IN ('goals', 'goal_progress_records')
  `);

  console.log(`\n=== Goal Tables ===`);
  console.log(
    `goals: ${goalsTables.some((t: any) => t.table_name === 'goals') ? 'EXISTS' : 'NOT FOUND'}`,
  );
  console.log(
    `goal_progress_records: ${goalsTables.some((t: any) => t.table_name === 'goal_progress_records') ? 'EXISTS' : 'NOT FOUND'}`,
  );

  // Check projects table for goal_id
  const projectColumns = await dataSource.query(`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_schema = '${schema}'
      AND table_name = 'projects'
      AND column_name = 'goal_id'
  `);

  console.log(`\n=== Projects Table ===`);
  console.log(
    `goal_id column: ${projectColumns.length > 0 ? 'EXISTS' : 'NOT FOUND'}`,
  );

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
