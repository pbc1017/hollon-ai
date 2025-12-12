# Database Migration Guide

This guide explains how to set up the database tables required for the authentication system.

## Option 1: Using TypeORM Migrations (Recommended)

### Step 1: Generate Migration

```bash
npm run db:migrate:generate -- CreateAuthTables
```

This will create a migration file in `src/database/migrations/` with a timestamp.

### Step 2: Review the Migration

The migration should create two tables: `users` and `sessions`. Review the generated file to ensure it matches the schema below.

### Step 3: Run the Migration

```bash
npm run db:migrate
```

## Option 2: Manual SQL Migration

If you prefer to create the tables manually, run the following SQL:

```sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  provider VARCHAR(50) NOT NULL DEFAULT 'local',
  provider_id VARCHAR(255),
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  two_factor_secret TEXT,
  two_factor_backup_codes JSONB,
  refresh_token TEXT,
  last_login_at TIMESTAMP,
  last_login_ip VARCHAR(45),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TIMESTAMP,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for users table
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider_id ON users(provider_id);

-- Create sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_info JSONB,
  is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
  revoked_at TIMESTAMP,
  last_activity_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id)
    REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for sessions table
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token);

-- Create trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
```

## Verification

After running the migration, verify the tables were created correctly:

```sql
-- Check users table
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Check sessions table
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'sessions'
ORDER BY ordinal_position;

-- Check indexes
SELECT
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename IN ('users', 'sessions');
```

## Expected Schema

### Users Table Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| email | VARCHAR(255) | NO | - | Unique user email |
| password | VARCHAR(255) | YES | NULL | Hashed password (null for OAuth) |
| first_name | VARCHAR(255) | YES | NULL | User's first name |
| last_name | VARCHAR(255) | YES | NULL | User's last name |
| provider | VARCHAR(50) | NO | 'local' | Auth provider (local/google/github) |
| provider_id | VARCHAR(255) | YES | NULL | OAuth provider ID |
| email_verified | BOOLEAN | NO | FALSE | Email verification status |
| two_factor_enabled | BOOLEAN | NO | FALSE | 2FA enabled status |
| two_factor_secret | TEXT | YES | NULL | TOTP secret for 2FA |
| two_factor_backup_codes | JSONB | YES | NULL | Backup codes (hashed) |
| refresh_token | TEXT | YES | NULL | Current refresh token |
| last_login_at | TIMESTAMP | YES | NULL | Last login timestamp |
| last_login_ip | VARCHAR(45) | YES | NULL | Last login IP address |
| failed_login_attempts | INTEGER | NO | 0 | Failed login counter |
| locked_until | TIMESTAMP | YES | NULL | Account lockout expiry |
| is_active | BOOLEAN | NO | TRUE | Account active status |
| metadata | JSONB | YES | {} | Additional user metadata |
| created_at | TIMESTAMP | NO | NOW() | Record creation time |
| updated_at | TIMESTAMP | NO | NOW() | Record update time |

### Sessions Table Columns

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| id | UUID | NO | uuid_generate_v4() | Primary key |
| user_id | UUID | NO | - | Foreign key to users table |
| access_token | TEXT | NO | - | JWT access token |
| refresh_token | TEXT | NO | - | JWT refresh token |
| expires_at | TIMESTAMP | NO | - | Session expiration time |
| ip_address | VARCHAR(45) | YES | NULL | Client IP address |
| user_agent | TEXT | YES | NULL | Client user agent |
| device_info | JSONB | YES | NULL | Device information |
| is_revoked | BOOLEAN | NO | FALSE | Session revocation status |
| revoked_at | TIMESTAMP | YES | NULL | Revocation timestamp |
| last_activity_at | TIMESTAMP | YES | NULL | Last activity timestamp |
| created_at | TIMESTAMP | NO | NOW() | Record creation time |
| updated_at | TIMESTAMP | NO | NOW() | Record update time |

## Rollback

If you need to rollback the migration:

```sql
-- Drop tables (will also drop dependent sessions due to CASCADE)
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

-- Drop triggers
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
DROP FUNCTION IF EXISTS update_updated_at_column();
```

## Data Seeding (Optional)

For development/testing, you can create test users:

```sql
-- Insert a test user with hashed password "password123"
-- Note: Use the application to create real users for proper password hashing
INSERT INTO users (
  email,
  password,
  first_name,
  last_name,
  email_verified,
  provider
) VALUES (
  'test@example.com',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY5ztP3vNNEkq9u', -- "password123"
  'Test',
  'User',
  true,
  'local'
);

-- Insert an OAuth test user (no password)
INSERT INTO users (
  email,
  first_name,
  last_name,
  email_verified,
  provider,
  provider_id
) VALUES (
  'oauth@example.com',
  'OAuth',
  'User',
  true,
  'google',
  'google-123456789'
);
```

## Maintenance Queries

### Clean up expired sessions

```sql
-- Delete expired sessions
DELETE FROM sessions
WHERE expires_at < NOW()
  OR (is_revoked = true AND revoked_at < NOW() - INTERVAL '30 days');
```

### Reset failed login attempts

```sql
-- Reset failed attempts for accounts that are no longer locked
UPDATE users
SET failed_login_attempts = 0, locked_until = NULL
WHERE locked_until < NOW();
```

### Find accounts with 2FA enabled

```sql
SELECT
  id,
  email,
  first_name,
  last_name,
  two_factor_enabled,
  last_login_at
FROM users
WHERE two_factor_enabled = true;
```

### Get active sessions count per user

```sql
SELECT
  u.email,
  COUNT(s.id) as active_sessions
FROM users u
LEFT JOIN sessions s ON u.id = s.user_id
  AND s.is_revoked = false
  AND s.expires_at > NOW()
GROUP BY u.id, u.email
HAVING COUNT(s.id) > 0
ORDER BY active_sessions DESC;
```

## Performance Optimization

Consider adding these additional indexes if you have a large user base:

```sql
-- Index for finding locked accounts
CREATE INDEX idx_users_locked_until ON users(locked_until)
WHERE locked_until IS NOT NULL;

-- Index for finding active users
CREATE INDEX idx_users_active ON users(is_active)
WHERE is_active = true;

-- Index for finding non-revoked sessions
CREATE INDEX idx_sessions_active ON sessions(user_id, is_revoked, expires_at)
WHERE is_revoked = false;

-- Partial index for 2FA enabled users
CREATE INDEX idx_users_2fa_enabled ON users(id)
WHERE two_factor_enabled = true;
```

## Monitoring

Set up monitoring for:

1. **Table size growth**
   ```sql
   SELECT
     schemaname,
     tablename,
     pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
   FROM pg_tables
   WHERE tablename IN ('users', 'sessions')
   ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
   ```

2. **Index usage**
   ```sql
   SELECT
     schemaname,
     tablename,
     indexname,
     idx_scan as index_scans,
     idx_tup_read as tuples_read,
     idx_tup_fetch as tuples_fetched
   FROM pg_stat_user_indexes
   WHERE schemaname = 'public'
     AND tablename IN ('users', 'sessions')
   ORDER BY idx_scan DESC;
   ```

## Backup Recommendations

1. **Regular backups**: Schedule daily backups of the `users` and `sessions` tables
2. **Point-in-time recovery**: Enable WAL archiving for PostgreSQL
3. **Backup encryption**: Encrypt backups containing user credentials
4. **Test restores**: Regularly test backup restoration procedures

## Compliance Considerations

For GDPR/CCPA compliance, implement:

1. **User data export**
   ```sql
   SELECT * FROM users WHERE id = 'user-uuid';
   SELECT * FROM sessions WHERE user_id = 'user-uuid';
   ```

2. **User data deletion** (Right to be forgotten)
   ```sql
   -- Sessions will be deleted automatically due to CASCADE
   DELETE FROM users WHERE id = 'user-uuid';
   ```

3. **Data retention policy**
   - Set up automatic deletion of old, revoked sessions
   - Archive deleted user data for legal retention requirements
