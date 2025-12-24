# User Service

A comprehensive User Service implementation with CRUD operations using NestJS and TypeORM.

## Features

- **Create User**: Add new users with email validation and conflict detection
- **Read Users**: Retrieve all users, find by ID, email, or organization
- **Update User**: Update user information with email conflict checking
- **Delete User**: Remove users by ID
- **Organization Integration**: Support for user-organization relationships
- **Comprehensive Testing**: Full unit test coverage for all CRUD operations

## Project Structure

```
src/
├── common/
│   └── entities/
│       └── base.entity.ts           # Base entity with common fields
├── modules/
│   ├── organization/
│   │   └── entities/
│   │       └── organization.entity.ts
│   └── user/
│       ├── dto/
│       │   ├── create-user.dto.ts   # DTO for creating users
│       │   └── update-user.dto.ts   # DTO for updating users
│       ├── entities/
│       │   └── user.entity.ts       # User entity definition
│       ├── user.controller.ts       # REST API endpoints
│       ├── user.module.ts           # User module configuration
│       ├── user.service.ts          # Business logic
│       └── user.service.spec.ts     # Unit tests
```

## API Endpoints

### Create User

```
POST /users
Body: CreateUserDto
```

### Get All Users

```
GET /users
Query: ?organizationId={uuid} (optional)
```

### Get User by ID

```
GET /users/:id
```

### Update User

```
PATCH /users/:id
Body: UpdateUserDto
```

### Delete User

```
DELETE /users/:id
```

## DTOs

### CreateUserDto

- `firstName` (string, required, max 100 chars)
- `lastName` (string, required, max 100 chars)
- `email` (string, required, valid email, max 255 chars)
- `phoneNumber` (string, optional, max 20 chars)
- `isActive` (boolean, optional, default: true)
- `organizationId` (UUID, required)

### UpdateUserDto

All fields from CreateUserDto are optional (PartialType)

## Entity Fields

### User

- `id` (UUID, auto-generated)
- `firstName` (string, max 100 chars)
- `lastName` (string, max 100 chars)
- `email` (string, unique, max 255 chars)
- `phoneNumber` (string, nullable, max 20 chars)
- `isActive` (boolean, default: true)
- `organizationId` (UUID, foreign key)
- `organization` (ManyToOne relation)
- `createdAt` (timestamp, auto-generated)
- `updatedAt` (timestamp, auto-updated)

## Service Methods

- `create(dto: CreateUserDto): Promise<User>` - Create a new user
- `findAll(): Promise<User[]>` - Get all users (sorted by last name, first name)
- `findOne(id: string): Promise<User>` - Find user by ID
- `findByEmail(email: string): Promise<User | null>` - Find user by email
- `findByOrganization(organizationId: string): Promise<User[]>` - Get users by organization
- `update(id: string, dto: UpdateUserDto): Promise<User>` - Update user
- `remove(id: string): Promise<void>` - Delete user

## Error Handling

- `NotFoundException` - Thrown when user not found
- `ConflictException` - Thrown when email already exists

## Testing

Run the test suite:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:cov
```

### Test Coverage

All service methods are fully tested with 13 test cases covering:

- Successful operations
- Error scenarios
- Edge cases
- Validation logic

## Installation

```bash
npm install
```

## Usage

Import the UserModule in your application:

```typescript
import { UserModule } from './modules/user/user.module';

@Module({
  imports: [UserModule],
})
export class AppModule {}
```

## Dependencies

- `@nestjs/common` - NestJS core functionality
- `@nestjs/typeorm` - TypeORM integration for NestJS
- `typeorm` - ORM for database operations
- `class-validator` - DTO validation
- `class-transformer` - Object transformation

## Development

This service follows NestJS best practices:

- Dependency injection for loose coupling
- Repository pattern for data access
- DTO validation for input safety
- Comprehensive error handling
- Clean separation of concerns

## License

MIT
