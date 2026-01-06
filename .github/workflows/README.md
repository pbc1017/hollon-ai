# CI/CD Workflows

This directory contains GitHub Actions workflows for continuous integration and deployment.

## 📋 Workflows

### CI Workflow (`ci.yml`)

Runs on every push to `main`, `develop`, and feature branches (`HL-*`), as well as on pull requests.

**Jobs:**

1. **Setup** - Install dependencies and cache them
2. **Lint** - Run ESLint on all TypeScript files
3. **Format** - Check code formatting with Prettier
4. **Type Check** - Run TypeScript compiler check (`tsc --noEmit`)
5. **Build** - Build the NestJS server application
6. **Unit Tests** - Run unit tests with coverage
7. **Integration Tests** - Run integration tests with PostgreSQL
8. **Security Audit** - Run `pnpm audit` to check for vulnerabilities
9. **Dependency Review** - Review dependencies on PRs (GitHub native)
10. **CI Success** - Final status check

**Environment Requirements:**

- Node.js 20 LTS
- pnpm 9.14.4
- PostgreSQL 16 (for integration tests)

## 🚀 Running CI Jobs Locally

You can run most CI checks locally before pushing:

### Lint

```bash
pnpm lint
```

### Format Check

```bash
pnpm format:check
```

### Type Check

```bash
pnpm typecheck
```

### Build

```bash
pnpm build
```

### Unit Tests

```bash
pnpm test
```

### Integration Tests

```bash
# Start PostgreSQL first
pnpm docker:up

# Run migrations
pnpm db:migrate

# Run integration tests
pnpm test:integration
```

### All Tests

```bash
pnpm test:all
```

### Security Audit

```bash
pnpm audit
```

## 📊 CI Status

The CI workflow uses concurrency controls to cancel in-progress runs when new commits are pushed to the same branch.

**Caching Strategy:**

- Dependencies are cached using pnpm's lockfile hash
- Build artifacts are cached per commit SHA
- Cache is shared across jobs to speed up workflow

**Test Database:**

- Integration tests use PostgreSQL 16 service container
- Test schema: `hollon_test_worker_1`
- Database is ephemeral and torn down after tests

## 🔧 Configuration Files

Related configuration files:

- `.prettierrc` - Prettier formatting rules
- `.prettierignore` - Files to ignore during formatting
- `eslint.config.js` - ESLint configuration
- `tsconfig.json` - TypeScript compiler options
- `jest.config.js` - Jest test configuration
- `test/jest-integration.json` - Integration test config
- `test/jest-e2e.json` - E2E test config

## 🎯 Pull Request Requirements

For a PR to be merged, all CI jobs must pass:

- ✅ Lint check
- ✅ Format check
- ✅ Type check
- ✅ Build successful
- ✅ Unit tests passing
- ✅ Integration tests passing
- ✅ No high-severity security vulnerabilities
- ✅ Dependency review (no high-severity issues)

## 📝 Adding New Checks

To add a new CI check:

1. Add a new job to `.github/workflows/ci.yml`
2. Add it to the `needs` array of the `ci-success` job
3. Update this README with the new check details

## 🐛 Troubleshooting

### CI fails but works locally

- Ensure you're using the same Node.js version (20 LTS)
- Check that your local dependencies match `pnpm-lock.yaml`
- Run `pnpm install --frozen-lockfile` to match CI exactly

### Integration tests fail in CI

- Check PostgreSQL service health
- Verify database migrations run successfully
- Ensure test schema is created correctly
- Check environment variables match `.env.test.example`

### Build artifacts not found

- Check that the build job completed successfully
- Verify cache keys match between jobs
- Ensure build output directory exists (`apps/server/dist`)

## 📚 Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [pnpm CI Setup](https://pnpm.io/continuous-integration)
- [NestJS Testing](https://docs.nestjs.com/fundamentals/testing)
