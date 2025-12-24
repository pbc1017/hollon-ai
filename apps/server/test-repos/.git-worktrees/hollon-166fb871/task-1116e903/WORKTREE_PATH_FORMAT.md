# Worktree Path Format Documentation

## Overview

This document describes the worktree path format used in the Hollon AI system for managing isolated development environments for different agents (hollons) working on different tasks.

## Path Format

The worktree path follows this pattern:

```
.git-worktrees/hollon-{hollonId}/task-{taskId}/
```

### Components

1. **`.git-worktrees/`** - Root directory for all worktrees
   - This directory is created at the repository level
   - All worktrees are organized under this directory
   - Located in the test-repos directory: `test-repos/.git-worktrees/`

2. **`hollon-{hollonId}`** - Hollon-specific directory
   - `{hollonId}`: First 8 characters of the hollon's UUID (hexadecimal)
   - Example: `hollon-166fb871`
   - Each hollon (AI agent/team member) gets their own directory
   - Ensures isolation between different team members

3. **`task-{taskId}/`** - Task-specific directory
   - `{taskId}`: First 8 characters of the task's UUID (hexadecimal)
   - Example: `task-1116e903`
   - Each task gets its own isolated worktree
   - Even the same hollon working on different tasks gets separate worktrees

## Example Paths

```
.git-worktrees/hollon-166fb871/task-1116e903/
.git-worktrees/hollon-3f034afb/task-8a72b451/
.git-worktrees/hollon-742d76d7/task-92c3f104/
```

## Current Worktree

The current worktree follows this format:

```
/Users/perry/Documents/Development/hollon-ai/apps/server/test-repos/.git-worktrees/hollon-166fb871/task-1116e903
```

Breaking it down:

- **Hollon ID**: `166fb871` (first 8 chars of the hollon UUID)
- **Task ID**: `1116e903` (first 8 chars of the task UUID)

## Purpose

### Isolation Between Team Members

Each hollon (AI agent representing a team member) gets their own directory structure. This ensures:

- Different team members can work simultaneously without conflicts
- File changes in one hollon's worktree don't affect another
- Each hollon maintains their own branch and working directory

### Isolation Between Tasks

Even when the same hollon works on multiple tasks:

- Each task gets a separate worktree
- Tasks can be worked on in parallel
- No conflicts between different task implementations

### Worktree Sharing for Sub-Hollons

Sub-hollons (temporary specialized agents created for task decomposition):

- Share the parent hollon's worktree
- Work collaboratively in the same directory
- Enables coordinated work on decomposed tasks

## Git Worktree Integration

Each worktree directory contains:

- A `.git` file (not a directory) that references the main repository
- The `.git` file contains: `gitdir: /path/to/main/repo/.git/worktrees/task-{taskId}`

Example `.git` file content:

```
gitdir: /Users/perry/Documents/Development/hollon-ai/apps/server/test-repos/worktree-test-1765861154134/.git/worktrees/task-1116e903
```

## Verification

To verify a worktree path follows the correct format:

1. **Run the verification script:**

   ```bash
   node verify-worktree-path.js
   ```

2. **Run the unit tests:**
   ```bash
   jest worktree-path.test.js
   ```

## Requirements

A valid worktree path must:

1. ✅ Contain `.git-worktrees` in the path
2. ✅ Contain `hollon-` followed by 8 hexadecimal characters
3. ✅ Contain `task-` followed by 8 hexadecimal characters
4. ✅ Exist as a directory
5. ✅ Have a `.git` file (worktree reference)
6. ✅ The `.git` file must start with `gitdir:`

## References

- E2E Tests: `test/e2e/phase4-worktree-scenarios.e2e-spec.ts`
- Verification Script: `verify-worktree-path.js`
- Unit Tests: `worktree-path.test.js`

## Design Rationale

### Why This Format?

1. **Hierarchical Organization**: The two-level structure (hollon/task) makes it easy to:
   - Find all worktrees for a specific hollon
   - Find the worktree for a specific task
   - Clean up all worktrees when a hollon is removed

2. **Human Readable**: Using the first 8 characters of UUIDs makes paths:
   - Easier to read and debug
   - Still unique enough to avoid collisions
   - Shorter than full UUIDs (which are 36 characters)

3. **Git Worktree Compatibility**: The format works seamlessly with git worktree commands:

   ```bash
   git worktree add .git-worktrees/hollon-{id}/task-{id} -b feature/branch-name
   ```

4. **Scalability**: The structure supports:
   - Multiple teams (different hollons)
   - Multiple tasks per hollon
   - Parallel task execution
   - Easy cleanup and management

## Maintenance

### Cleanup

Worktrees are cleaned up:

- After task completion and PR merge
- During test teardown (in E2E tests)
- When a hollon is deactivated/removed

### Monitoring

To list all worktrees:

```bash
git worktree list
```

To remove a specific worktree:

```bash
git worktree remove .git-worktrees/hollon-{id}/task-{id}
```
