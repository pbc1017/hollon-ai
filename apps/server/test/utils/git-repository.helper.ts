import { promisify } from 'util';
import { exec } from 'child_process';
import * as path from 'path';

const execAsync = promisify(exec);

/**
 * Git Repository Helper for E2E Tests
 * Phase 3.11: Git Worktree and Branch Testing Utilities
 */
export class GitRepositoryHelper {
  /**
   * Create test git repository with initial commit
   */
  static async createTestRepository(basePath: string): Promise<string> {
    const repoPath = path.join(basePath, `test-repo-${Date.now()}`);

    try {
      // Create repository directory
      await execAsync(`mkdir -p ${repoPath}`);

      // Initialize git repository
      await execAsync(`git init`, { cwd: repoPath });

      // Configure git user
      await execAsync(`git config user.email "test@hollon.ai"`, {
        cwd: repoPath,
      });
      await execAsync(`git config user.name "Hollon Test"`, {
        cwd: repoPath,
      });

      // Create initial commit
      await execAsync(`echo "# Test Project" > README.md`, {
        cwd: repoPath,
      });
      await execAsync(`git add .`, { cwd: repoPath });
      await execAsync(`git commit -m "Initial commit"`, { cwd: repoPath });

      // Create main branch (some git versions default to 'master')
      await execAsync(`git checkout -b main || git branch -M main`, {
        cwd: repoPath,
      });

      return repoPath;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create test repository: ${errorMessage}`);
    }
  }

  /**
   * Verify branch exists in repository
   */
  static async verifyBranchExists(
    repoPath: string,
    branchPattern: string,
  ): Promise<boolean> {
    try {
      const { stdout } = await execAsync(`git branch --list`, {
        cwd: repoPath,
      });

      const branches = stdout
        .split('\n')
        .map((b) => b.trim().replace(/^\* /, ''));

      // Check if any branch matches the pattern
      return branches.some((branch) => branch.includes(branchPattern));
    } catch {
      return false;
    }
  }

  /**
   * Get all branches in repository
   */
  static async getBranches(repoPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`git branch --list`, {
        cwd: repoPath,
      });

      return stdout
        .split('\n')
        .map((b) => b.trim().replace(/^\* /, ''))
        .filter((b) => b.length > 0);
    } catch {
      return [];
    }
  }

  /**
   * Get worktree info
   */
  static async getWorktreeInfo(worktreePath: string): Promise<{
    exists: boolean;
    branch?: string;
  }> {
    try {
      // Check if worktree directory exists
      await execAsync(`test -d ${worktreePath}`);

      // Get current branch
      const { stdout } = await execAsync(`git branch --show-current`, {
        cwd: worktreePath,
      });

      return {
        exists: true,
        branch: stdout.trim(),
      };
    } catch {
      return { exists: false };
    }
  }

  /**
   * List all worktrees for a repository
   */
  static async listWorktrees(repoPath: string): Promise<string[]> {
    try {
      const { stdout } = await execAsync(`git worktree list --porcelain`, {
        cwd: repoPath,
      });

      // Parse worktree list output
      const worktrees: string[] = [];
      const lines = stdout.split('\n');

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          const worktreePath = line.replace('worktree ', '').trim();
          worktrees.push(worktreePath);
        }
      }

      return worktrees;
    } catch {
      return [];
    }
  }

  /**
   * Verify worktree exists
   */
  static async worktreeExists(worktreePath: string): Promise<boolean> {
    const info = await this.getWorktreeInfo(worktreePath);
    return info.exists;
  }

  /**
   * Get worktree path for hollon
   */
  static getWorktreePath(repoPath: string, hollonId: string): string {
    return path.join(
      repoPath,
      '..',
      '.git-worktrees',
      `worktree-${hollonId.slice(0, 8)}`,
    );
  }

  /**
   * Cleanup test repository and all worktrees
   */
  static async cleanupRepository(repoPath: string): Promise<void> {
    try {
      // Remove all worktrees first
      const worktrees = await this.listWorktrees(repoPath);

      for (const worktreePath of worktrees) {
        // Skip main worktree (the repository itself)
        if (worktreePath === repoPath) {
          continue;
        }

        try {
          await execAsync(`git worktree remove ${worktreePath} --force`, {
            cwd: repoPath,
          });
        } catch {
          // Ignore errors (worktree might already be removed)
          console.warn(`Failed to remove worktree ${worktreePath}`);
        }
      }

      // Remove .git-worktrees directory
      const worktreesDir = path.join(repoPath, '..', '.git-worktrees');
      await execAsync(`rm -rf ${worktreesDir}`).catch(() => {
        // Ignore errors
      });

      // Remove repository directory
      await execAsync(`rm -rf ${repoPath}`);
    } catch (cleanupError) {
      const errorMessage =
        cleanupError instanceof Error ? cleanupError.message : 'Unknown error';
      throw new Error(`Failed to cleanup repository: ${errorMessage}`);
    }
  }

  /**
   * Create a commit in worktree
   */
  static async createCommit(
    worktreePath: string,
    message: string,
    fileContent?: string,
  ): Promise<void> {
    try {
      // Create or modify file
      if (fileContent) {
        await execAsync(`echo "${fileContent}" > test-file.txt`, {
          cwd: worktreePath,
        });
      } else {
        await execAsync(`echo "Test content $(date)" > test-file.txt`, {
          cwd: worktreePath,
        });
      }

      // Add and commit
      await execAsync(`git add .`, { cwd: worktreePath });
      await execAsync(`git commit -m "${message}"`, { cwd: worktreePath });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      throw new Error(`Failed to create commit: ${errorMessage}`);
    }
  }

  /**
   * Get commit count on current branch
   */
  static async getCommitCount(worktreePath: string): Promise<number> {
    try {
      const { stdout } = await execAsync(`git rev-list --count HEAD`, {
        cwd: worktreePath,
      });
      return parseInt(stdout.trim(), 10);
    } catch {
      return 0;
    }
  }

  /**
   * Verify git worktree is properly initialized
   */
  static async verifyWorktreeValid(worktreePath: string): Promise<boolean> {
    try {
      // Check if .git file exists (worktrees have a .git file, not directory)
      await execAsync(`test -f ${worktreePath}/.git`);

      // Verify git commands work
      await execAsync(`git status`, { cwd: worktreePath });

      return true;
    } catch {
      return false;
    }
  }
}
