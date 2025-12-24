import { DataSource } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import { join } from 'path';

// Load environment variables
dotenv.config({ path: join(__dirname, '../../../.env.local') });
dotenv.config({ path: join(__dirname, '../../../.env') });

async function resetTestSchema() {
  const configService = new ConfigService();

  const workerId = process.env.JEST_WORKER_ID || '1';
  const schemaName = `hollon_test_worker_${workerId}`;

  // Connect to database without specifying schema
  const dataSource = new DataSource({
    type: 'postgres',
    host: configService.get('DB_HOST', 'localhost'),
    port: parseInt(configService.get('DB_PORT', '5434')),
    username: configService.get('DB_USER', 'hollon'),
    password: configService.get('DB_PASSWORD'),
    database: configService.get('DB_NAME', 'hollon'),
    schema: 'public', // Use public schema for admin operations
  });

  try {
    await dataSource.initialize();
    console.log('✅ Connected to database');

    // Drop existing test schema if exists
    console.log(`\n🗑️  Dropping schema ${schemaName} if exists...`);
    await dataSource.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
    console.log(`✅ Schema ${schemaName} dropped`);

    // Create fresh test schema
    console.log(`\n🆕 Creating schema ${schemaName}...`);
    await dataSource.query(`CREATE SCHEMA "${schemaName}"`);
    console.log(`✅ Schema ${schemaName} created`);

    await dataSource.destroy();
    console.log('\n✅ Database connection closed');

    // Now run migrations on the new schema
    console.log(`\n📦 Running migrations on schema ${schemaName}...`);

    // Create a new connection specifically for the test schema
    const migrationDataSource = new DataSource({
      type: 'postgres',
      host: configService.get('DB_HOST', 'localhost'),
      port: parseInt(configService.get('DB_PORT', '5434')),
      username: configService.get('DB_USER', 'hollon'),
      password: configService.get('DB_PASSWORD'),
      database: configService.get('DB_NAME', 'hollon'),
      schema: schemaName,
      migrations: [join(__dirname, '../src/database/migrations/*.ts')],
      entities: [join(__dirname, '../src/**/*.entity.ts')],
    });

    await migrationDataSource.initialize();
    console.log('✅ Connected with migration datasource');

    await migrationDataSource.runMigrations();
    console.log(`✅ Migrations completed on schema ${schemaName}`);

    await migrationDataSource.destroy();

    console.log(`\n✅ Test schema ${schemaName} is ready for testing!`);
  } catch (error) {
    console.error('❌ Error resetting test schema:', error);
    throw error;
  }
}

resetTestSchema()
  .then(() => {
    console.log('\n🎉 Test schema reset completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Test schema reset failed:', error);
    process.exit(1);
  });
