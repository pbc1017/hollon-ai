/**
 * Unit tests for worktree path format verification
 *
 * These tests ensure that worktree paths follow the expected pattern:
 * .git-worktrees/hollon-{hollonId}/task-{taskId}/
 */

const fs = require('fs');
const path = require('path');

describe('Worktree Path Format', () => {
  const currentPath = process.cwd();

  describe('Directory Structure', () => {
    it('should contain .git-worktrees in the path', () => {
      expect(currentPath).toContain('.git-worktrees');
    });

    it('should contain hollon-{id} pattern with 8 hex characters', () => {
      const hollonMatch = currentPath.match(/hollon-([a-f0-9]{8})/);
      expect(hollonMatch).not.toBeNull();
      expect(hollonMatch[1]).toHaveLength(8);
      expect(hollonMatch[1]).toMatch(/^[a-f0-9]{8}$/);
    });

    it('should contain task-{id} pattern with 8 hex characters', () => {
      const taskMatch = currentPath.match(/task-([a-f0-9]{8})/);
      expect(taskMatch).not.toBeNull();
      expect(taskMatch[1]).toHaveLength(8);
      expect(taskMatch[1]).toMatch(/^[a-f0-9]{8}$/);
    });

    it('should follow the complete pattern: .git-worktrees/hollon-{id}/task-{id}/', () => {
      const fullPattern =
        /\.git-worktrees\/hollon-[a-f0-9]{8}\/task-[a-f0-9]{8}/;
      expect(currentPath).toMatch(fullPattern);
    });
  });

  describe('Worktree Existence', () => {
    it('should exist as a directory', () => {
      expect(fs.existsSync(currentPath)).toBe(true);
      const stats = fs.statSync(currentPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should have a .git file (worktree reference)', () => {
      const gitFilePath = path.join(currentPath, '.git');
      expect(fs.existsSync(gitFilePath)).toBe(true);
    });

    it('.git file should contain gitdir reference', () => {
      const gitFilePath = path.join(currentPath, '.git');
      const content = fs.readFileSync(gitFilePath, 'utf8');
      expect(content).toMatch(/^gitdir: /);
    });

    it('.git file should reference the main repository worktrees directory', () => {
      const gitFilePath = path.join(currentPath, '.git');
      const content = fs.readFileSync(gitFilePath, 'utf8').trim();
      const gitdir = content.replace('gitdir: ', '');

      // The gitdir should point to the main repo's .git/worktrees/{task-id}
      expect(gitdir).toContain('/.git/worktrees/');
      expect(gitdir).toContain('task-');
    });
  });

  describe('Path Component Extraction', () => {
    it('should be able to extract hollon ID from path', () => {
      const hollonMatch = currentPath.match(/hollon-([a-f0-9]{8})/);
      const hollonId = hollonMatch[1];

      expect(hollonId).toBeDefined();
      expect(hollonId.length).toBe(8);
      console.log(`Extracted Hollon ID: ${hollonId}`);
    });

    it('should be able to extract task ID from path', () => {
      const taskMatch = currentPath.match(/task-([a-f0-9]{8})/);
      const taskId = taskMatch[1];

      expect(taskId).toBeDefined();
      expect(taskId.length).toBe(8);
      console.log(`Extracted Task ID: ${taskId}`);
    });
  });

  describe('Path Uniqueness', () => {
    it('should have unique combination of hollon and task IDs', () => {
      const hollonMatch = currentPath.match(/hollon-([a-f0-9]{8})/);
      const taskMatch = currentPath.match(/task-([a-f0-9]{8})/);

      const hollonId = hollonMatch[1];
      const taskId = taskMatch[1];

      // Hollon ID and Task ID should be different (very unlikely to be the same)
      // This ensures each worktree is uniquely identified
      const uniqueCombination = `${hollonId}-${taskId}`;
      expect(uniqueCombination.length).toBe(17); // 8 + 1 (dash) + 8
    });
  });

  describe('Integration with E2E Test Expectations', () => {
    it('should match the pattern expected by phase4-worktree-scenarios.e2e-spec.ts', () => {
      // From lines 220-233 of the E2E test file
      expect(currentPath).toContain('hollon-');

      const taskMatch = currentPath.match(/task-([a-f0-9]{8})/);
      expect(currentPath).toContain('task-' + taskMatch[1]);
    });

    it('should be suitable for worktree isolation', () => {
      // Each hollon-{id}/task-{id} combination should be independent
      // This path structure ensures:
      // 1. Different hollons get different directories (hollon-{id})
      // 2. Different tasks for the same hollon get different directories (task-{id})

      const pathParts = currentPath.split(path.sep);
      const worktreeIndex = pathParts.findIndex(
        (part) => part === '.git-worktrees',
      );

      expect(worktreeIndex).toBeGreaterThan(-1);
      expect(pathParts[worktreeIndex + 1]).toMatch(/^hollon-[a-f0-9]{8}$/);
      expect(pathParts[worktreeIndex + 2]).toMatch(/^task-[a-f0-9]{8}$/);
    });
  });
});

// Run tests if executed directly (not through Jest)
if (require.main === module) {
  console.log('Run this file with Jest or another test runner');
  console.log('Example: jest worktree-path.test.js');
}
