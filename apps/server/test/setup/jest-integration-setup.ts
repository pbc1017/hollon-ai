/**
 * Jest E2E Global Setup
 *
 * This file runs once before all E2E tests
 * It configures environment variables and global test settings
 */

// Load test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DISABLE_SCHEDULER = 'true'; // Disable ScheduleModule in tests to avoid Reflector dependency issues

// Extend Jest timeout for E2E tests
jest.setTimeout(30000);

console.log('🧪 E2E Test Environment Initialized');
console.log(`   Worker ID: ${process.env.JEST_WORKER_ID || '1'}`);
console.log(
  `   Test Schema: hollon_test_worker_${process.env.JEST_WORKER_ID || '1'}`,
);
