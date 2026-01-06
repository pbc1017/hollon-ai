/**
 * Jest E2E Global Setup
 *
 * This file runs once before all E2E tests
 * It configures environment variables and global test settings
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DISABLE_SCHEDULER = 'true'; // Disable ScheduleModule in tests

// Note: LOG_LEVEL, API keys, and schema are automatically set by configuration.ts
// based on NODE_ENV=test

// Extend Jest timeout for E2E tests
jest.setTimeout(30000);

const rawWorkerId = process.env.JEST_WORKER_ID || '1';
const normalizedWorkerId = rawWorkerId.replace(/\D/g, '') || '1';

console.log('🧪 E2E Test Environment Initialized');
console.log(`   Worker ID: ${rawWorkerId} → ${normalizedWorkerId}`);
console.log(`   Schema: hollon_test_worker_${normalizedWorkerId}`);
console.log('   Migration: Auto-run enabled (migrationsRun: true)');
