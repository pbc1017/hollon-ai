/* eslint-disable no-console */

import dataSource from '../config/typeorm.config';

async function testMigration() {
  try {
    console.log('🔌 Initializing database connection...');
    await dataSource.initialize();
    console.log('✅ Database connection established');

    // Check current migrations
    console.log('\n📋 Checking current migrations...');
    const executedMigrations = await dataSource.showMigrations();
    console.log(
      executedMigrations
        ? '⚠️  Pending migrations exist'
        : '✅ All migrations executed',
    );

    // Run pending migrations
    console.log('\n🚀 Running pending migrations...');
    const migrations = await dataSource.runMigrations({ transaction: 'all' });

    if (migrations.length === 0) {
      console.log('✅ No pending migrations');
    } else {
      console.log(`✅ Executed ${migrations.length} migration(s):`);
      migrations.forEach((migration) => {
        console.log(`   - ${migration.name}`);
      });
    }

    // Verify pgvector extension
    console.log('\n🔍 Verifying pgvector extension...');
    const result = await dataSource.query(
      `SELECT * FROM pg_extension WHERE extname = 'vector'`,
    );

    if (result.length > 0) {
      console.log('✅ pgvector extension is enabled');
      console.log('   Extension details:', result[0]);
    } else {
      console.log('❌ pgvector extension is NOT enabled');
      process.exit(1);
    }

    // Test vector functionality
    console.log('\n🧪 Testing vector functionality...');
    try {
      await dataSource.query(`SELECT '[1,2,3]'::vector`);
      console.log('✅ Vector type is working correctly');
    } catch (error) {
      console.log('❌ Vector type test failed:', error.message);
      process.exit(1);
    }

    console.log('\n✨ Migration test completed successfully!');
    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration test failed:', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

testMigration();
