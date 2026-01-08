# DTO Standards and Validation Conventions

> **Last Updated**: 2026-01-06
> **Purpose**: Document existing DTO patterns, validation conventions, and best practices for the Hollon-AI project

---

## 📋 Table of Contents

- [Overview](#overview)
- [File Organization](#file-organization)
- [Naming Conventions](#naming-conventions)
- [Validation Decorators](#validation-decorators)
- [Class-Transformer Usage](#class-transformer-usage)
- [Update DTO Patterns](#update-dto-patterns)
- [Nested DTOs](#nested-dtos)
- [Response DTOs](#response-dtos)
- [Global Validation Configuration](#global-validation-configuration)
- [Best Practices](#best-practices)
- [Examples](#examples)

---

## Overview

This project uses:

- **class-validator** for DTO validation
- **class-transformer** for type transformation
- **@nestjs/mapped-types** for creating derived DTOs

All DTOs are automatically validated through the global `ValidationPipe` configured in `main.ts`.

---

## File Organization

### Directory Structure

DTOs are organized within each module's `dto/` subdirectory:

```
apps/server/src/modules/
├── {module-name}/
│   ├── dto/
│   │   ├── create-{entity}.dto.ts
│   │   ├── update-{entity}.dto.ts
│   │   ├── {specific-action}.dto.ts
│   │   └── {entity}-response.dto.ts
│   ├── entities/
│   ├── {module-name}.controller.ts
│   ├── {module-name}.service.ts
│   └── {module-name}.module.ts
```

### Example Module Structure

```
apps/server/src/modules/task/
├── dto/
│   ├── create-task.dto.ts
│   └── update-task.dto.ts
├── entities/
│   └── task.entity.ts
├── task.controller.ts
├── task.service.ts
└── task.module.ts
```

---

## Naming Conventions

### DTO File Names

Use **kebab-case** for file names with the `.dto.ts` suffix:

| Pattern                    | Example                                | Purpose                    |
| -------------------------- | -------------------------------------- | -------------------------- |
| `create-{entity}.dto.ts`   | `create-task.dto.ts`                   | Creating new entities      |
| `update-{entity}.dto.ts`   | `update-task.dto.ts`                   | Updating existing entities |
| `{action}-{entity}.dto.ts` | `send-message.dto.ts`                  | Specific actions           |
| `{entity}-query.dto.ts`    | `message-query.dto.ts`                 | Query parameters           |
| `{entity}-response.dto.ts` | `knowledge-extraction-response.dto.ts` | API responses              |

### DTO Class Names

Use **PascalCase** with `Dto` suffix:

```typescript
export class CreateTaskDto {}
export class UpdateTaskDto {}
export class SendMessageDto {}
export class MessageQueryDto {}
export class KnowledgeExtractionResponseDto {}
```

---

## Validation Decorators

### Common Validators

The project uses these class-validator decorators:

#### String Validation

```typescript
import { IsString, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;
}
```

#### UUID Validation

```typescript
import { IsUUID } from 'class-validator';

export class CreateTaskDto {
  @IsUUID()
  projectId: string;

  @IsOptional()
  @IsUUID()
  parentTaskId?: string;
}
```

#### Enum Validation

```typescript
import { IsEnum } from 'class-validator';
import { TaskType, TaskPriority } from '../entities/task.entity';

export class CreateTaskDto {
  @IsOptional()
  @IsEnum(TaskType)
  type?: TaskType;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;
}
```

#### Number Validation

```typescript
import { IsInt, IsNumber, Min, Max } from 'class-validator';

export class CreateHollonDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  maxConcurrentTasks?: number;
}

export class RecordProgressDto {
  @IsNumber()
  @Min(0)
  @Max(100)
  progressPercent: number;
}
```

#### Array Validation

```typescript
import { IsArray, IsString } from 'class-validator';

export class CreateTaskDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
```

#### Date Validation

```typescript
import { IsDateString, IsDate } from 'class-validator';

// For input DTOs (accepts ISO 8601 strings)
export class CreateTaskDto {
  @IsOptional()
  @IsDateString()
  dueDate?: string;
}

// For response DTOs (actual Date objects)
export class KnowledgeExtractionResponseDto {
  @IsDate()
  extractedAt: Date;
}
```

#### Boolean Validation

```typescript
import { IsBoolean } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsBoolean()
  requiresResponse?: boolean;
}
```

#### Object Validation

```typescript
import { IsObject } from 'class-validator';

export class SendMessageDto {
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
```

### Optional Fields

Use `@IsOptional()` decorator for optional properties:

```typescript
import { IsOptional, IsString } from 'class-validator';

export class CreateOrganizationDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  settings?: Record<string, unknown>;
}
```

**Note**: `@IsOptional()` should be placed **before** other validators.

---

## Class-Transformer Usage

### Type Transformation in Query DTOs

For query parameters (which come as strings from HTTP), use `@Type()` to transform them:

```typescript
import { IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class MessageQueryDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unreadOnly?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}
```

**When to use `@Type()`:**

- Query parameters (GET requests)
- When explicit type conversion is needed
- With `enableImplicitConversion: true` in ValidationPipe, simple types are auto-converted, but complex types need `@Type()`

---

## Update DTO Patterns

### Using PartialType

The standard pattern for update DTOs uses `PartialType` from `@nestjs/mapped-types`:

```typescript
import { PartialType } from '@nestjs/mapped-types';
import { CreateOrganizationDto } from './create-organization.dto';

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}
```

This makes all properties from `CreateOrganizationDto` optional.

### Using OmitType with PartialType

For update DTOs that exclude certain immutable fields:

```typescript
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsUUID, IsString } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';
import { TaskStatus } from '../entities/task.entity';

export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['projectId', 'parentTaskId'] as const),
) {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsUUID()
  assignedHollonId?: string;
}
```

**Pattern**: Omit immutable fields (like `projectId`, `parentTaskId`), then add update-specific fields (like `status`, `assignedHollonId`).

---

## Nested DTOs

### Validating Nested Objects

For DTOs containing nested objects or arrays of objects:

```typescript
import {
  IsEnum,
  IsString,
  IsUUID,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ChannelRole } from '../entities/channel-membership.entity';
import { ParticipantType } from '../../message/entities/message.entity';

export class ChannelMemberDto {
  @IsEnum(ParticipantType)
  type: ParticipantType;

  @IsUUID()
  id: string;

  @IsOptional()
  @IsEnum(ChannelRole)
  role?: ChannelRole;
}

export class CreateGroupChannelDto {
  @IsString()
  name: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelMemberDto)
  members: ChannelMemberDto[];
}
```

**Key points**:

1. Define the nested DTO class separately
2. Use `@ValidateNested({ each: true })` for arrays of objects
3. Use `@Type(() => NestedDtoClass)` to enable transformation
4. The nested class should also have validation decorators

### Another Example

```typescript
import {
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ContextVariable {
  @IsString()
  @MaxLength(100)
  key: string;

  @IsString()
  value: string;
}

export class ComposePromptDto {
  @IsString()
  @MaxLength(100)
  templateName: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContextVariable)
  contextVariables?: ContextVariable[];
}
```

---

## Response DTOs

### When to Use Response DTOs

Response DTOs are used to:

1. Define the structure of API responses
2. Document return types for OpenAPI/Swagger
3. Apply transformations to outgoing data

### Response DTO Example

```typescript
import {
  IsString,
  IsDate,
  IsObject,
  IsOptional,
  IsUUID,
} from 'class-validator';

export class KnowledgeExtractionResponseDto {
  @IsUUID()
  id: string;

  @IsString()
  content: string;

  @IsString()
  source: string;

  @IsDate()
  extractedAt: Date;

  @IsOptional()
  @IsObject()
  metadata: Record<string, unknown> | null;

  @IsUUID()
  organizationId: string;

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}
```

### Simple Response DTOs

Not all response DTOs need validation decorators, especially for internal types:

```typescript
import { Task } from '../../task/entities/task.entity';

export class StandupResponse {
  hollonId: string;
  hollonName: string;
  completedYesterday: Task[];
  todayPlan: Task[];
  blockers: {
    taskId: string;
    reason: string;
  }[];
}
```

---

## Global Validation Configuration

The project has a global `ValidationPipe` configured in `apps/server/src/main.ts`:

```typescript
import { ValidationPipe } from '@nestjs/common';

app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true, // Strip properties without decorators
    forbidNonWhitelisted: true, // Throw error if non-whitelisted properties exist
    transform: true, // Auto-transform payloads to DTO instances
    transformOptions: {
      enableImplicitConversion: true, // Auto-convert primitive types
    },
  }),
);
```

### What This Means

1. **whitelist: true** - Removes properties not decorated in the DTO
2. **forbidNonWhitelisted: true** - Throws 400 error if extra properties are sent
3. **transform: true** - Converts plain objects to DTO class instances
4. **enableImplicitConversion: true** - Auto-converts string "123" to number 123, "true" to boolean true

---

## Best Practices

### 1. Always Use Validation Decorators

```typescript
// ✅ Good
export class CreateTaskDto {
  @IsString()
  @MaxLength(255)
  title: string;
}

// ❌ Bad - No validation
export class CreateTaskDto {
  title: string;
}
```

### 2. Place @IsOptional() First

```typescript
// ✅ Good
@IsOptional()
@IsString()
@MaxLength(255)
description?: string;

// ❌ Bad - Order matters
@IsString()
@IsOptional()
description?: string;
```

### 3. Use Appropriate Constraints

```typescript
// ✅ Good - Specific constraints
@IsString()
@MaxLength(255)
name: string;

@IsInt()
@Min(1)
@Max(5)
maxConcurrentTasks: number;

// ❌ Bad - No constraints
@IsString()
name: string;

@IsNumber()
maxConcurrentTasks: number;
```

### 4. Import Enums from Entities

```typescript
// ✅ Good - Reuse entity enums
import { TaskType, TaskPriority } from '../entities/task.entity';

export class CreateTaskDto {
  @IsEnum(TaskType)
  type: TaskType;

  @IsEnum(TaskPriority)
  priority: TaskPriority;
}

// ❌ Bad - Duplicate enum definitions
```

### 5. Use TypeScript Types Consistently

```typescript
// ✅ Good - Explicit types
@IsOptional()
@IsObject()
metadata?: Record<string, any>;

@IsOptional()
@IsArray()
@IsString({ each: true })
tags?: string[];

// ❌ Bad - Using 'any' without type hints
metadata?: any;
tags?: any;
```

### 6. Document Special DTOs

For DTOs with special purposes or business logic:

```typescript
/**
 * DTO for Emergency Stop operation
 *
 * Phase 3.7: Kill switch for autonomous execution
 * Sets autonomousExecutionEnabled = false
 */
export class EmergencyStopDto {
  @IsString()
  @IsOptional()
  reason?: string;
}
```

### 7. Use Nested DTOs for Complex Structures

```typescript
// ✅ Good - Separate nested DTO
export class ChannelMemberDto {
  @IsEnum(ParticipantType)
  type: ParticipantType;

  @IsUUID()
  id: string;
}

export class CreateGroupChannelDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ChannelMemberDto)
  members: ChannelMemberDto[];
}

// ❌ Bad - Inline object validation
export class CreateGroupChannelDto {
  members: { type: ParticipantType; id: string }[];
}
```

---

## Examples

### Example 1: Simple Create DTO

```typescript
import { IsString, IsOptional, MaxLength } from 'class-validator';

export class CreateOrganizationDto {
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  settings?: Record<string, unknown>;
}
```

### Example 2: Update DTO with Additional Fields

```typescript
import { PartialType, OmitType } from '@nestjs/mapped-types';
import { IsEnum, IsOptional, IsUUID, IsString } from 'class-validator';
import { CreateTaskDto } from './create-task.dto';
import { TaskStatus } from '../entities/task.entity';

export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['projectId', 'parentTaskId'] as const),
) {
  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsUUID()
  assignedHollonId?: string;

  @IsOptional()
  @IsString()
  estimatedComplexity?: 'low' | 'medium' | 'high';
}
```

### Example 3: Query DTO with Pagination

```typescript
import { IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class MessageQueryDto {
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  unreadOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  requiresResponse?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  @Type(() => Number)
  limit?: number = 50;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Type(() => Number)
  offset?: number = 0;
}
```

### Example 4: DTO with Nested Validation

```typescript
import {
  IsString,
  IsOptional,
  IsObject,
  IsArray,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ContextVariable {
  @IsString()
  @MaxLength(100)
  key: string;

  @IsString()
  value: string;
}

export class ComposePromptDto {
  @IsUUID()
  organizationId: string;

  @IsString()
  @MaxLength(100)
  templateName: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContextVariable)
  contextVariables?: ContextVariable[];

  @IsOptional()
  @IsString()
  additionalContext?: string;
}
```

### Example 5: Response DTO

```typescript
import { IsString, IsObject, IsOptional } from 'class-validator';

export class ComposedPromptResponseDto {
  @IsString()
  composedPrompt: string;

  @IsString()
  templateName: string;

  @IsObject()
  variables: Record<string, any>;

  @IsOptional()
  @IsObject()
  metadata?: {
    templateVersion?: string;
    composedAt?: Date;
    variablesUsed?: string[];
  };
}
```

### Example 6: Action-Specific DTO

```typescript
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PullRequestStatus } from '../entities/task-pull-request.entity';

export class ReviewSubmissionDto {
  @IsEnum(PullRequestStatus)
  decision: PullRequestStatus.APPROVED | PullRequestStatus.CHANGES_REQUESTED;

  @IsOptional()
  @IsString()
  comments?: string;
}
```

---

## Summary

The Hollon-AI project follows these key DTO conventions:

1. **File Organization**: DTOs in `dto/` subdirectories within each module
2. **Naming**: kebab-case files, PascalCase classes with `Dto` suffix
3. **Validation**: Comprehensive use of class-validator decorators
4. **Transformation**: Use `@Type()` for query parameters and nested objects
5. **Update Pattern**: `PartialType()` and `OmitType()` for update DTOs
6. **Nested Objects**: `@ValidateNested()` with `@Type()` for complex structures
7. **Global Config**: Strict validation with whitelist and auto-transform enabled

These patterns ensure type safety, consistent validation, and maintainable code across the entire application.

---

**Related Documents**:

- [Project Overview](./README.md)
- [SSOT Principles](./principles/ssot.md)
