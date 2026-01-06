/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import dataSource from '../config/typeorm.config';

async function testRollback() {
  try {
    console.log('🔌 Initializing database connection...');
    await dataSource.initialize();
    console.log('✅ Database connection established');

    // Check which migrations are executed
    console.log('\n📋 Checking executed migrations...');
    const migrations = await dataSource.query(`
      SELECT * FROM migrations
      ORDER BY timestamp DESC
      LIMIT 5
    `);

    console.log('Recent migrations:');
    migrations.forEach((m: any) => {
      console.log(`   - ${m.name} (${new Date(m.timestamp).toISOString()})`);
    });

    // Verify pgvector is currently enabled
    console.log('\n🔍 Checking pgvector extension before rollback...');
    let result = await dataSource.query(
      `SELECT * FROM pg_extension WHERE extname = 'vector'`,
    );

    if (result.length > 0) {
      console.log('✅ pgvector extension is currently enabled');
    } else {
      console.log('❌ pgvector extension is NOT enabled (nothing to rollback)');
      await dataSource.destroy();
      process.exit(1);
    }

    // Revert the last migration
    console.log('\n⏮️  Reverting last migration...');
    await dataSource.undoLastMigration({ transaction: 'all' });
    console.log('✅ Migration rollback completed');

    // Verify pgvector is disabled
    console.log('\n🔍 Verifying pgvector extension after rollback...');
    result = await dataSource.query(
      `SELECT * FROM pg_extension WHERE extname = 'vector'`,
    );

    if (result.length === 0) {
      console.log('✅ pgvector extension has been removed successfully');
    } else {
      console.log('❌ pgvector extension is still enabled after rollback');
      process.exit(1);
    }

    // Test that vector type is no longer available
    console.log('\n🧪 Verifying vector type is unavailable...');
    try {
      await dataSource.query(`SELECT '[1,2,3]'::vector`);
      console.log(
        '❌ Vector type is still available (rollback may have failed)',
      );
      process.exit(1);
    } catch (error) {
      console.log('✅ Vector type is no longer available (as expected)');
    }

    console.log('\n✨ Migration rollback test completed successfully!');
    await dataSource.destroy();
    process.exit(0);
  } catch (error) {
    console.error('❌ Rollback test failed:', error);
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
    process.exit(1);
  }
}

testRollback();
