#!/usr/bin/env ts-node

/**
 * Database Configuration Verification Script
 *
 * Verifies TypeORM configuration and database connectivity
 * Run with: pnpm --filter @hollon-ai/server ts-node src/scripts/verify-database-config.ts
 */

import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { join, resolve } from 'path';

// Load environment variables
const projectRoot = resolve(__dirname, '../../../..');
dotenv.config({ path: join(projectRoot, '.env.local') });
dotenv.config({ path: join(projectRoot, '.env') });

const schema = process.env.DB_SCHEMA || 'hollon';

interface VerificationResult {
  success: boolean;
  message: string;
  details?: any;
}

/**
 * Verify environment variables are set
 */
function verifyEnvironmentVariables(): VerificationResult {
  const required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];
  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    return {
      success: false,
      message: 'Missing required environment variables',
      details: { missing },
    };
  }

  return {
    success: true,
    message: 'All required environment variables are set',
    details: {
      DB_HOST: process.env.DB_HOST,
      DB_PORT: process.env.DB_PORT,
      DB_NAME: process.env.DB_NAME,
      DB_USER: process.env.DB_USER,
      DB_SCHEMA: schema,
      NODE_ENV: process.env.NODE_ENV || 'development',
    },
  };
}

/**
 * Verify database connection
 */
async function verifyConnection(dataSource: DataSource): VerificationResult {
  try {
    await dataSource.initialize();
    await dataSource.query('SELECT 1 as connected');
    
    return {
      success: true,
      message: 'Database connection successful',
      details: {
        type: dataSource.options.type,
        host: (dataSource.options as any).host,
        port: (dataSource.options as any).port,
        database: (dataSource.options as any).database,
        schema: (dataSource.options as any).schema,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Database connection failed',
      details: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/**
 * Verify schema exists
 */
async function verifySchema(dataSource: DataSource): Promise<VerificationResult> {
  try {
    const result = await dataSource.query(
      `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
      [schema],
    );

    if (result.length === 0) {
      return {
        success: false,
        message: `Schema '${schema}' does not exist`,
        details: { schema },
      };
    }

    return {
      success: true,
      message: `Schema '${schema}' exists`,
      details: { schema },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to verify schema',
      details: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/**
 * Verify database extensions
 */
async function verifyExtensions(dataSource: DataSource): Promise<VerificationResult> {
  try {
    const result = await dataSource.query(`
      SELECT extname
      FROM pg_extension
      WHERE extname IN ('uuid-ossp', 'vector', 'pg_trgm')
      ORDER BY extname
    `);

    const installed = result.map((row: { extname: string }) => row.extname);
    const required = ['uuid-ossp', 'vector', 'pg_trgm'];
    const missing = required.filter(ext => !installed.includes(ext));

    if (missing.length > 0) {
      return {
        success: false,
        message: 'Missing required PostgreSQL extensions',
        details: { installed, missing },
      };
    }

    return {
      success: true,
      message: 'All required PostgreSQL extensions are installed',
      details: { extensions: installed },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to verify extensions',
      details: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/**
 * Verify migrations status
 */
async function verifyMigrations(dataSource: DataSource): Promise<VerificationResult> {
  try {
    const hasPending = await dataSource.showMigrations();
    
    // Get executed migrations
    let executedCount = 0;
    try {
      const executed = await dataSource.query(
        `SELECT COUNT(*) as count FROM ${schema}.migrations`,
      );
      executedCount = parseInt(executed[0].count, 10);
    } catch {
      // Migrations table might not exist yet
      executedCount = 0;
    }

    const totalMigrations = dataSource.migrations.length;
    const pendingCount = hasPending ? totalMigrations - executedCount : 0;

    return {
      success: true,
      message: hasPending
        ? `${pendingCount} pending migration(s) found`
        : 'All migrations are up to date',
      details: {
        total: totalMigrations,
        executed: executedCount,
        pending: pendingCount,
        upToDate: !hasPending,
      },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to verify migrations',
      details: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/**
 * Get table count in schema
 */
async function getTableCount(dataSource: DataSource): Promise<VerificationResult> {
  try {
    const result = await dataSource.query(
      `SELECT COUNT(*) as count 
       FROM information_schema.tables 
       WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
      [schema],
    );

    const tableCount = parseInt(result[0].count, 10);

    return {
      success: true,
      message: `Found ${tableCount} table(s) in schema '${schema}'`,
      details: { tableCount, schema },
    };
  } catch (error) {
    return {
      success: false,
      message: 'Failed to get table count',
      details: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

/**
 * Print result with formatting
 */
function printResult(title: string, result: VerificationResult): void {
  const icon = result.success ? '✓' : '✗';
  const color = result.success ? '\x1b[32m' : '\x1b[31m';
  const reset = '\x1b[0m';
  
  console.log(`\n${color}${icon} ${title}${reset}`);
  console.log(`  ${result.message}`);
  
  if (result.details) {
    console.log('  Details:', JSON.stringify(result.details, null, 2));
  }
}

/**
 * Main verification function
 */
async function verifyDatabaseConfiguration(): Promise<void> {
  console.log('='.repeat(60));
  console.log('Database Configuration Verification');
  console.log('='.repeat(60));

  const results: Array<{ title: string; result: VerificationResult }> = [];

  // 1. Verify environment variables
  const envResult = verifyEnvironmentVariables();
  results.push({ title: 'Environment Variables', result: envResult });
  printResult('Environment Variables', envResult);

  if (!envResult.success) {
    console.log('\n✗ Cannot proceed without required environment variables');
    console.log('Please create a .env or .env.local file with the required variables.');
    console.log('See .env.example for reference.');
    process.exit(1);
  }

  // Create DataSource
  const dataSource = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    username: process.env.DB_USER || 'hollon',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'hollon',
    schema: schema,
    entities: [join(__dirname, '../**/*.entity{.ts,.js}')],
    migrations: [join(__dirname, '../database/migrations/*{.ts,.js}')],
    synchronize: false,
    extra: {
      options: `-c search_path=${schema},public`,
    },
  });

  try {
    // 2. Verify database connection
    const connectionResult = await verifyConnection(dataSource);
    results.push({ title: 'Database Connection', result: connectionResult });
    printResult('Database Connection', connectionResult);

    if (!connectionResult.success) {
      console.log('\n✗ Cannot proceed without database connection');
      console.log('Please ensure PostgreSQL is running and credentials are correct.');
      console.log('Run: pnpm docker:up');
      process.exit(1);
    }

    // 3. Verify schema exists
    const schemaResult = await verifySchema(dataSource);
    results.push({ title: 'Schema Verification', result: schemaResult });
    printResult('Schema Verification', schemaResult);

    // 4. Verify extensions
    const extensionsResult = await verifyExtensions(dataSource);
    results.push({ title: 'PostgreSQL Extensions', result: extensionsResult });
    printResult('PostgreSQL Extensions', extensionsResult);

    // 5. Verify migrations
    const migrationsResult = await verifyMigrations(dataSource);
    results.push({ title: 'Migrations Status', result: migrationsResult });
    printResult('Migrations Status', migrationsResult);

    // 6. Get table count
    const tablesResult = await getTableCount(dataSource);
    results.push({ title: 'Database Tables', result: tablesResult });
    printResult('Database Tables', tablesResult);

  } catch (error) {
    console.error('\n✗ Unexpected error during verification:', error);
    process.exit(1);
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  const successCount = results.filter(r => r.result.success).length;
  const totalCount = results.length;
  
  if (successCount === totalCount) {
    console.log(`\x1b[32m✓ All checks passed (${successCount}/${totalCount})\x1b[0m`);
    console.log('\nYour database configuration is ready for use!');
    process.exit(0);
  } else {
    console.log(`\x1b[31m✗ ${totalCount - successCount} check(s) failed\x1b[0m`);
    console.log(`\x1b[32m✓ ${successCount} check(s) passed\x1b[0m`);
    console.log('\nPlease address the failures above before proceeding.');
    process.exit(1);
  }
}

// Run verification
verifyDatabaseConfiguration().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
