# Hollon-AI Project Overview

## Purpose

Recursive Multi-Agent System - AI agents (called "Hollons") collaborating like a startup organization.

## Tech Stack

- **Backend**: NestJS 10.x with TypeScript (strict mode)
- **Database**: PostgreSQL with TypeORM
- **Package Manager**: pnpm 9.x (monorepo with Turbo)
- **Testing**: Jest
- **Validation**: class-validator, class-transformer

## Project Structure

```
hollon-ai/
├── apps/
│   └── server/           # NestJS backend (@hollon-ai/server)
│       └── src/
│           ├── modules/  # Feature modules
│           ├── common/   # Shared utilities
│           ├── config/   # Configuration
│           └── database/ # Migrations, seeds
├── packages/
│   └── shared/           # Shared types/utilities
├── docker/               # Docker compose files
└── docs/                 # Documentation
```

## Module Pattern

Each module follows NestJS conventions:

- `*.module.ts` - Module definition
- `*.service.ts` - Business logic
- `*.controller.ts` - HTTP endpoints
- `entities/*.entity.ts` - TypeORM entities
- `dto/*.dto.ts` - Data Transfer Objects with class-validator
- `*.service.spec.ts` - Unit tests

## Code Style

- TypeScript strict mode
- snake_case for database columns (via TypeORM decorators)
- camelCase for TypeScript properties
- class-validator decorators for DTO validation
- NotFoundException for not found errors
- Repository pattern with TypeORM
