/* eslint-disable no-console */
/* eslint-disable @typescript-eslint/no-explicit-any */
import dataSource from '../config/typeorm.config';

/**
 * Verification script for pgvector extension
 *
 * This script verifies that the pgvector extension is properly installed
 * and configured in the PostgreSQL database. It checks:
 * 1. Extension installation status
 * 2. Vector data type availability
 * 3. Vector functions availability
 *
 * Usage:
 *   ts-node src/scripts/verify-pgvector.ts
 */
async function main() {
  await dataSource.initialize();

  console.log('=== pgvector Extension Verification ===\n');

  const schema =
    'schema' in dataSource.options
      ? (dataSource.options.schema as string) || 'public'
      : 'public';

  let allChecksPassed = true;

  // Check 1: Verify extension is installed
  console.log('1. Checking pgvector extension installation...');
  try {
    const extensions = await dataSource.query(`
      SELECT extname, extversion, extrelocatable
      FROM pg_extension
      WHERE extname = 'vector'
    `);

    if (extensions.length === 0) {
      console.log('   ❌ FAIL: pgvector extension is NOT installed');
      allChecksPassed = false;
    } else {
      const ext = extensions[0];
      console.log('   ✅ PASS: pgvector extension is installed');
      console.log(`   Version: ${ext.extversion}`);
      console.log(`   Relocatable: ${ext.extrelocatable}`);
    }
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 2: Verify vector data type is available
  console.log('\n2. Checking vector data type availability...');
  try {
    const types = await dataSource.query(`
      SELECT typname, typnamespace::regnamespace as schema
      FROM pg_type
      WHERE typname = 'vector'
    `);

    if (types.length === 0) {
      console.log('   ❌ FAIL: vector data type is NOT available');
      allChecksPassed = false;
    } else {
      console.log('   ✅ PASS: vector data type is available');
      console.log(`   Schema: ${types[0].schema}`);
    }
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 3: Verify vector functions are available
  console.log('\n3. Checking vector similarity functions...');
  try {
    const functions = await dataSource.query(`
      SELECT proname, pronargs
      FROM pg_proc
      WHERE proname IN ('vector_l2_ops', 'vector_ip_ops', 'vector_cosine_ops')
      ORDER BY proname
    `);

    if (functions.length === 0) {
      console.log('   ⚠️  WARNING: No vector operator classes found');
      console.log('   (This may be normal depending on pgvector version)');
    } else {
      console.log(`   ✅ PASS: Found ${functions.length} vector functions`);
      functions.forEach((fn: any) => {
        console.log(`   - ${fn.proname} (${fn.pronargs} args)`);
      });
    }
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 4: Test vector operations (optional)
  console.log('\n4. Testing vector operations...');
  try {
    // Test creating a temporary vector and performing operations
    await dataSource.query(`
      SELECT '[1,2,3]'::vector AS test_vector
    `);
    console.log('   ✅ PASS: Can create vector values');

    // Test vector distance calculation
    await dataSource.query(`
      SELECT '[1,2,3]'::vector <-> '[4,5,6]'::vector AS distance
    `);
    console.log('   ✅ PASS: Can calculate vector distances');
  } catch (error: any) {
    console.log(`   ❌ ERROR: ${error.message}`);
    allChecksPassed = false;
  }

  // Check 5: Verify vector columns in knowledge_items table (if it exists)
  console.log('\n5. Checking knowledge_items table for vector columns...');
  try {
    const columns = await dataSource.query(
      `
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_schema = $1
        AND table_name = 'knowledge_items'
        AND udt_name = 'vector'
    `,
      [schema],
    );

    if (columns.length === 0) {
      console.log(
        '   ℹ️  INFO: No vector columns found in knowledge_items table',
      );
      console.log(
        "   (This is expected if vector columns haven't been added yet)",
      );
    } else {
      console.log(`   ✅ PASS: Found ${columns.length} vector column(s)`);
      columns.forEach((col: any) => {
        console.log(`   - ${col.column_name} (${col.data_type})`);
      });
    }
  } catch (error: any) {
    // Table might not exist yet, which is fine
    console.log(`   ℹ️  INFO: ${error.message}`);
  }

  console.log('\n=== Verification Summary ===');
  if (allChecksPassed) {
    console.log('✅ All critical checks passed!');
    console.log('pgvector extension is properly installed and functional.');
  } else {
    console.log('❌ Some checks failed!');
    console.log('Please review the errors above and ensure:');
    console.log('  1. PostgreSQL has pgvector extension installed');
    console.log('  2. The EnablePgvector migration has been run');
    console.log('  3. Database connection has proper permissions');
  }

  await dataSource.destroy();
  process.exit(allChecksPassed ? 0 : 1);
}

main().catch((err) => {
  console.error('Fatal Error:', err.message);
  console.error(err.stack);
  process.exit(1);
});
