/* eslint-disable no-console */
import dataSource from '../config/typeorm.config';

// Migration files that are already applied (based on existing tables)
const appliedMigrations = [
  { timestamp: 1733295000000, name: 'InitialSchema1733295000000' },
  { timestamp: 1733400000000, name: 'MessagingSystem1733400000000' },
  { timestamp: 1733500000000, name: 'MeetingSystem1733500000000' },
  { timestamp: 1733600000000, name: 'AddCycles1733600000000' },
  { timestamp: 1733700000000, name: 'AddCollaboration1733700000000' },
  { timestamp: 1733710000000, name: 'AddApprovalAndWeek121733710000000' },
  { timestamp: 1733720000000, name: 'AddConflictResolution1733720000000' },
  { timestamp: 1733800000000, name: 'AddMissingTaskColumns1733800000000' },
  { timestamp: 1733900000000, name: 'AddHollonDepth1733900000000' },
  {
    timestamp: 1733950000000,
    name: 'AddMessageConversationFields1733950000000',
  },
  {
    timestamp: 1734000000000,
    name: 'AddOrganizationContextPrompt1734000000000',
  },
  { timestamp: 1734100000000, name: 'AddStoryPointsColumn1734100000000' },
];

async function main() {
  await dataSource.initialize();

  const schema =
    'schema' in dataSource.options
      ? (dataSource.options.schema as string) || 'public'
      : 'public';

  console.log('=== Migration Sync Script ===\n');
  console.log('This will mark the following migrations as already applied:');
  appliedMigrations.forEach((m) => console.log(`  - ${m.name}`));

  console.log(
    '\n⚠️  This assumes these migrations were already applied via synchronize or manual SQL.',
  );
  console.log(
    '⚠️  The AddGoalEntities migration will still need to be run separately.\n',
  );

  // Check current migration state
  const existing = await dataSource.query(`
    SELECT * FROM "${schema}"."migrations" ORDER BY id
  `);

  if (existing.length > 0) {
    console.log(
      `Found ${existing.length} existing migration records. Aborting to avoid conflicts.`,
    );
    await dataSource.destroy();
    return;
  }

  console.log('Inserting migration records...\n');

  for (const migration of appliedMigrations) {
    await dataSource.query(
      `
      INSERT INTO "${schema}"."migrations" (timestamp, name)
      VALUES ($1, $2)
    `,
      [migration.timestamp, migration.name],
    );
    console.log(`✓ ${migration.name}`);
  }

  console.log('\n✅ Migration sync complete!');
  console.log(
    '\nNext step: Run "pnpm db:migrate" to apply the AddGoalEntities migration.',
  );

  await dataSource.destroy();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
