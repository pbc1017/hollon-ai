#!/usr/bin/env node

/**
 * Worktree Path Format Verification Script
 *
 * This script verifies that the worktree path follows the expected pattern:
 * .git-worktrees/hollon-{hollonId}/task-{taskId}/
 *
 * Pattern Requirements:
 * 1. Must contain '.git-worktrees' directory
 * 2. Must contain 'hollon-' followed by a hollon ID (8 hex chars)
 * 3. Must contain 'task-' followed by a task ID (8 hex chars)
 * 4. Must have a .git file (worktree git reference)
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function verifyWorktreePath(worktreePath) {
  log('\n🔍 Verifying Worktree Path Format\n', 'blue');
  log(`Path: ${worktreePath}\n`, 'yellow');

  const results = [];
  let allPassed = true;

  // Test 1: Contains .git-worktrees
  const hasGitWorktrees = worktreePath.includes('.git-worktrees');
  results.push({
    test: 'Contains .git-worktrees directory',
    passed: hasGitWorktrees,
    expected: 'Path should contain .git-worktrees',
    actual: hasGitWorktrees ? 'Found .git-worktrees' : 'Missing .git-worktrees',
  });
  allPassed = allPassed && hasGitWorktrees;

  // Test 2: Contains hollon-{id} pattern
  const hollonMatch = worktreePath.match(/hollon-([a-f0-9]{8})/);
  const hasHollonId = hollonMatch !== null;
  results.push({
    test: 'Contains hollon-{id} pattern',
    passed: hasHollonId,
    expected: 'Path should contain hollon-{8 hex chars}',
    actual: hasHollonId ? `Found: hollon-${hollonMatch[1]}` : 'Missing hollon-{id}',
  });
  allPassed = allPassed && hasHollonId;

  // Test 3: Contains task-{id} pattern
  const taskMatch = worktreePath.match(/task-([a-f0-9]{8})/);
  const hasTaskId = taskMatch !== null;
  results.push({
    test: 'Contains task-{id} pattern',
    passed: hasTaskId,
    expected: 'Path should contain task-{8 hex chars}',
    actual: hasTaskId ? `Found: task-${taskMatch[1]}` : 'Missing task-{id}',
  });
  allPassed = allPassed && hasTaskId;

  // Test 4: Worktree directory exists
  const dirExists = fs.existsSync(worktreePath);
  results.push({
    test: 'Worktree directory exists',
    passed: dirExists,
    expected: 'Directory should exist',
    actual: dirExists ? 'Directory exists' : 'Directory not found',
  });
  allPassed = allPassed && dirExists;

  // Test 5: Has .git file (worktree reference)
  const gitFilePath = path.join(worktreePath, '.git');
  const hasGitFile = fs.existsSync(gitFilePath);
  results.push({
    test: 'Has .git file (worktree reference)',
    passed: hasGitFile,
    expected: '.git file should exist',
    actual: hasGitFile ? '.git file found' : '.git file missing',
  });
  allPassed = allPassed && hasGitFile;

  // Test 6: .git file contains gitdir reference
  if (hasGitFile) {
    const gitFileContent = fs.readFileSync(gitFilePath, 'utf8').trim();
    const hasGitdir = gitFileContent.startsWith('gitdir:');
    results.push({
      test: '.git file contains gitdir reference',
      passed: hasGitdir,
      expected: '.git file should start with "gitdir:"',
      actual: hasGitdir ? `Found: ${gitFileContent.substring(0, 50)}...` : 'No gitdir reference',
    });
    allPassed = allPassed && hasGitdir;
  }

  // Print results
  results.forEach((result, index) => {
    const status = result.passed ? '✅' : '❌';
    const color = result.passed ? 'green' : 'red';
    log(`\n${index + 1}. ${status} ${result.test}`, color);
    log(`   Expected: ${result.expected}`);
    log(`   Actual: ${result.actual}`);
  });

  // Summary
  log('\n' + '='.repeat(60), 'blue');
  const summary = allPassed
    ? '✅ All tests passed! Worktree path format is correct.'
    : '❌ Some tests failed. Worktree path format is incorrect.';
  log(summary, allPassed ? 'green' : 'red');
  log('='.repeat(60) + '\n', 'blue');

  return allPassed;
}

// Run verification
const currentPath = process.cwd();
const passed = verifyWorktreePath(currentPath);

process.exit(passed ? 0 : 1);
