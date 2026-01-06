# Main Repo Pollution Prevention Guide

## Issue #12 & Recurrence Prevention

### Problem

Brain Provider가 `workingDirectory` 없이 호출되면 `process.cwd()` (main repo)에서 실행되어 main repo에 파일 생성

### All Brain Provider Call Sites

#### ✅ Already Fixed (Fix #12 - c184767)

1. **manager.service.ts** (Line 274, 426)
   ```typescript
   // ProcessManager 레벨에서 cwd 없으면 os.tmpdir() 사용
   const cwd = options.cwd || os.tmpdir();
   ```

#### 🔍 Need to Verify

2. **task-execution.service.ts** - Task decomposition
   - When: `estimatedComplexity === 'high'`
   - Location: `decomposeTask()` method
   - MUST pass: `workingDirectory: task.workingDirectory`

3. **task-execution.service.ts** - Task execution
   - When: `executeTask()` calls Brain Provider
   - Location: Main task execution flow
   - MUST pass: `workingDirectory: worktreePath`

4. **code-review.service.ts** - Code review
   - When: Manager reviews code
   - Location: `reviewCode()` or similar methods
   - MUST pass: `workingDirectory` from task

5. **Any future Brain Provider calls**
   - ALWAYS specify `workingDirectory`
   - ALWAYS add to `disallowedTools` for analysis-only tasks

### Detection Strategy

#### 1. Runtime Detection

```typescript
// ProcessManagerService.spawn()
if (!options.cwd) {
  this.logger.warn(
    `⚠️  Brain Provider spawned without cwd! Defaulting to tmpdir. Stack: ${new Error().stack}`,
  );
  // This will help identify call sites that forget workingDirectory
}
```

#### 2. Git Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Check for untracked files in main repo src directory
if git status --porcelain | grep "^??" | grep "apps/server/src/" > /dev/null; then
  echo "❌ ERROR: Untracked files found in apps/server/src/"
  echo "This may indicate main repo pollution from Brain Provider"
  git status --porcelain | grep "^??" | grep "apps/server/src/"
  echo ""
  echo "Please investigate and remove these files before committing"
  exit 1
fi
```

#### 3. Automated Tests

```typescript
// test: Brain Provider calls must have workingDirectory
describe('Brain Provider calls', () => {
  it('should always specify workingDirectory', async () => {
    const spy = jest.spyOn(processManager, 'spawn');

    // Execute any Brain Provider calling code
    await taskExecutionService.executeTask(task);

    // Verify workingDirectory was provided
    expect(spy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        cwd: expect.stringMatching(/\.git-worktrees\/|\/tmp\//),
      }),
    );
  });
});
```

### Cleanup Procedure

When main repo pollution is detected:

```bash
# 1. Identify polluted files
git status --porcelain | grep "^??"

# 2. Remove untracked files in src directory
rm -rf apps/server/src/<polluted-directory>

# 3. Verify clean state
git status

# 4. Find which task caused it
# Check recent logs for Brain Provider spawns without cwd warning
grep "Brain Provider spawned without cwd" /tmp/hollon-server-clean.log

# 5. Check which tasks were running at file creation time
# Use file modification time to narrow down
stat <polluted-file> | grep "Modify"
# Then query tasks active at that time
psql ... "SELECT * FROM tasks WHERE started_at <= '<file-time>' AND ..."
```

### Code Review Checklist

When reviewing PRs that call Brain Provider:

- [ ] `workingDirectory` parameter is specified
- [ ] `workingDirectory` points to worktree or tmpdir (NOT main repo)
- [ ] For analysis-only tasks, `disallowedTools` includes file writing tools
- [ ] Tests verify workingDirectory is properly set

### Long-term Solution

**Option A**: Make `workingDirectory` required

```typescript
interface BrainProviderOptions {
  workingDirectory: string; // Remove optional, make required
  // ...
}
```

**Option B**: Runtime assertion

```typescript
if (!options.workingDirectory || options.workingDirectory === process.cwd()) {
  throw new Error(
    `Brain Provider MUST specify workingDirectory and it CANNOT be main repo! ` +
      `Provided: ${options.workingDirectory}, Main repo: ${process.cwd()}`,
  );
}
```

**Recommendation**: Implement Option B immediately in ProcessManagerService.spawn()
