# Task Completion Checklist

When completing a task, ensure:

1. **TypeScript Compilation**
   - `pnpm typecheck` passes

2. **Linting**
   - `pnpm lint` passes (or `pnpm lint:fix` to auto-fix)

3. **Formatting**
   - `pnpm format:check` passes (or `pnpm format` to auto-fix)

4. **Testing**
   - `pnpm test` passes for unit tests
   - Add/update tests for new functionality

5. **Code Style**
   - Use class-validator decorators for DTOs
   - Use NotFoundException for not found errors
   - Follow existing patterns in similar modules
