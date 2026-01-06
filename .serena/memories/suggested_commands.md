# Suggested Commands

## Development

```bash
pnpm dev                    # Start dev server
pnpm build                  # Build all packages
pnpm typecheck              # TypeScript check
```

## Testing

```bash
pnpm test                   # Run unit tests
pnpm test:integration       # Run integration tests
pnpm --filter @hollon-ai/server test:watch  # Watch mode
```

## Linting & Formatting

```bash
pnpm lint                   # Run ESLint
pnpm lint:fix               # Fix lint issues
pnpm format                 # Format with Prettier
pnpm format:check           # Check formatting
```

## Database

```bash
pnpm docker:up              # Start PostgreSQL
pnpm docker:down            # Stop PostgreSQL
pnpm db:migrate             # Run migrations
pnpm db:seed                # Seed data
```

## Server-specific (from apps/server)

```bash
cd apps/server
pnpm test                   # Unit tests only
pnpm test:watch             # Watch mode
```
