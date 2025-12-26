#!/usr/bin/env ts-node

/**
 * Simple script to verify that the worktree path follows the correct pattern
 * Expected pattern: .git-worktrees/hollon-{hollonId}/task-{taskId}/
 */

import * as path from 'path';
import * as fs from 'fs';

// Get the current directory (should be the worktree)
const currentDir = process.cwd();
console.log('Current directory:', currentDir);

// Expected pattern: .git-worktrees/hollon-{hollonId}/task-{taskId}/
const worktreePathPattern =
  /\.git-worktrees\/hollon-[a-f0-9]{8}\/task-[a-f0-9]{8}/;

// Test if the current path matches the expected pattern
const matches = worktreePathPattern.test(currentDir);

console.log('\n=== Worktree Path Format Verification ===');
console.log(
  'Expected pattern: .git-worktrees/hollon-{hollonId}/task-{taskId}/',
);
console.log('Current path:', currentDir);
console.log('Pattern match:', matches ? '✅ PASS' : '❌ FAIL');

// Extract components
const pathParts = currentDir.split(path.sep);
const gitWorktreesIndex = pathParts.findIndex((p) => p === '.git-worktrees');

if (gitWorktreesIndex !== -1) {
  const hollonDir = pathParts[gitWorktreesIndex + 1];
  const taskDir = pathParts[gitWorktreesIndex + 2];

  console.log('\nExtracted components:');
  console.log('  Hollon directory:', hollonDir);
  console.log('  Task directory:', taskDir);

  // Verify format
  const hollonPattern = /^hollon-[a-f0-9]{8}$/;
  const taskPattern = /^task-[a-f0-9]{8}$/;

  const hollonMatches = hollonPattern.test(hollonDir);
  const taskMatches = taskPattern.test(taskDir);

  console.log('\nComponent validation:');
  console.log('  Hollon format:', hollonMatches ? '✅ PASS' : '❌ FAIL');
  console.log('  Task format:', taskMatches ? '✅ PASS' : '❌ FAIL');

  // Check if .git file exists
  const gitFile = path.join(currentDir, '.git');
  const gitFileExists = fs.existsSync(gitFile);

  console.log('\nGit worktree verification:');
  console.log('  .git file exists:', gitFileExists ? '✅ PASS' : '❌ FAIL');

  if (gitFileExists) {
    const gitContent = fs.readFileSync(gitFile, 'utf-8');
    console.log('  .git content:', gitContent.trim());
  }

  // Overall result
  const allPassed = matches && hollonMatches && taskMatches && gitFileExists;
  console.log('\n=== Overall Result ===');
  console.log(allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED');

  process.exit(allPassed ? 0 : 1);
} else {
  console.log('\n❌ ERROR: .git-worktrees not found in path');
  process.exit(1);
}
