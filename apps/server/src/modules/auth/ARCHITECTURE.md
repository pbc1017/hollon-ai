# Authentication System Architecture

## Overview

This document describes the architecture and flow of the advanced authentication system.

## System Components

```
┌─────────────────────────────────────────────────────────────────┐
│                        Client Application                        │
└────────────┬────────────────────────────────────────┬───────────┘
             │                                        │
             │ HTTP/REST                              │ OAuth Redirect
             │                                        │
┌────────────▼────────────────────────────────────────▼───────────┐
│                         API Gateway                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              JWT Auth Guard (Global)                     │  │
│  │  • Validates JWT tokens                                  │  │
│  │  • Loads user from database                             │  │
│  │  • Skips @Public() routes                               │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────┬─────────────────────────────────┬────────────────┘
               │                                 │
        ┌──────▼──────┐                  ┌──────▼──────┐
        │   Auth      │                  │   OAuth     │
        │ Controller  │                  │ Controller  │
        └──────┬──────┘                  └──────┬──────┘
               │                                 │
               │                          ┌──────▼──────────┐
               │                          │  OAuth Providers│
               │                          │  • Google       │
               │                          │  • GitHub       │
               │                          └─────────────────┘
               │
        ┌──────▼──────────────────────────────────────────┐
        │              Auth Service                        │
        │  ┌────────────────────────────────────────┐    │
        │  │  Core Functions                        │    │
        │  │  • register()                          │    │
        │  │  • login()                             │    │
        │  │  • oauthLogin()                        │    │
        │  │  • refreshToken()                      │    │
        │  │  • logout()                            │    │
        │  │  • enable2FA()                         │    │
        │  │  • verify2FASetup()                    │    │
        │  │  • disable2FA()                        │    │
        │  │  • getActiveSessions()                 │    │
        │  │  • revokeSession()                     │    │
        │  └────────────────────────────────────────┘    │
        │                                                  │
        │  ┌────────────────────────────────────────┐    │
        │  │  Security Functions                    │    │
        │  │  • hashPassword()                      │    │
        │  │  • generateToken()                     │    │
        │  │  • verify2FACode()                     │    │
        │  │  • handleFailedLogin()                 │    │
        │  │  • generateTOTP()                      │    │
        │  │  • generateBackupCodes()               │    │
        │  └────────────────────────────────────────┘    │
        └──────┬───────────────────────┬───────────────────┘
               │                       │
        ┌──────▼──────┐         ┌──────▼──────┐
        │    User     │         │   Session   │
        │  Repository │         │  Repository │
        └──────┬──────┘         └──────┬──────┘
               │                       │
        ┌──────▼───────────────────────▼──────┐
        │          PostgreSQL Database         │
        │  ┌─────────────┐  ┌───────────────┐ │
        │  │ users table │  │sessions table │ │
        │  └─────────────┘  └───────────────┘ │
        └──────────────────────────────────────┘
```

## Authentication Flows

### 1. Email/Password Registration

```
Client                  AuthController              AuthService              Database
  │                           │                          │                       │
  ├─ POST /auth/register ────►│                          │                       │
  │  {email, password}        │                          │                       │
  │                           ├─ register(dto) ─────────►│                       │
  │                           │                          ├─ Check existing ─────►│
  │                           │                          │◄─────────────────────┤
  │                           │                          │                       │
  │                           │                          ├─ Hash password        │
  │                           │                          │                       │
  │                           │                          ├─ Create user ────────►│
  │                           │                          │◄─────────────────────┤
  │                           │                          │                       │
  │                           │                          ├─ Generate JWT         │
  │                           │                          │                       │
  │                           │                          ├─ Create session ─────►│
  │                           │◄─ AuthResponse ──────────┤◄─────────────────────┤
  │◄─ {accessToken, etc.} ────┤                          │                       │
```

### 2. Email/Password Login (without 2FA)

```
Client                  AuthController              AuthService              Database
  │                           │                          │                       │
  ├─ POST /auth/login ───────►│                          │                       │
  │  {email, password}        │                          │                       │
  │                           ├─ login(dto) ────────────►│                       │
  │                           │                          ├─ Find user ──────────►│
  │                           │                          │◄─────────────────────┤
  │                           │                          │                       │
  │                           │                          ├─ Verify password      │
  │                           │                          │                       │
  │                           │                          ├─ Update lastLogin ───►│
  │                           │                          │                       │
  │                           │                          ├─ Generate tokens      │
  │                           │                          │                       │
  │                           │                          ├─ Create session ─────►│
  │                           │◄─ AuthResponse ──────────┤◄─────────────────────┤
  │◄─ {accessToken, etc.} ────┤                          │                       │
```

### 3. Email/Password Login (with 2FA)

```
Client                  AuthController              AuthService              Database
  │                           │                          │                       │
  ├─ POST /auth/login ───────►│                          │                       │
  │  {email, password}        │                          │                       │
  │                           ├─ login(dto) ────────────►│                       │
  │                           │                          ├─ Verify password      │
  │                           │                          │                       │
  │                           │                          ├─ Check 2FA enabled    │
  │                           │                          │                       │
  │                           │◄─ TwoFactorChallenge ────┤                       │
  │◄─ {requiresTwoFactor} ────┤                          │                       │
  │                           │                          │                       │
  ├─ POST /auth/login ───────►│                          │                       │
  │  {email, pwd, 2FAcode}    │                          │                       │
  │                           ├─ login(dto) ────────────►│                       │
  │                           │                          ├─ Verify 2FA code      │
  │                           │                          │                       │
  │                           │                          ├─ Generate tokens      │
  │                           │                          │                       │
  │                           │                          ├─ Create session ─────►│
  │                           │◄─ AuthResponse ──────────┤◄─────────────────────┤
  │◄─ {accessToken, etc.} ────┤                          │                       │
```

### 4. OAuth Login (Google/GitHub)

```
Client          OAuthController      OAuth Provider      AuthService         Database
  │                   │                      │                 │                 │
  ├─ GET /oauth/google►                      │                 │                 │
  │                   ├─ Redirect ──────────►│                 │                 │
  │◄──────────────────┤                      │                 │                 │
  │                   │                      │                 │                 │
  │ (User authorizes) │                      │                 │                 │
  │                   │                      │                 │                 │
  │                   │◄─ Callback (code) ───┤                 │                 │
  │                   │                      │                 │                 │
  │                   ├─ Exchange code ──────►                 │                 │
  │                   │◄─ Access token ───────┤                 │                 │
  │                   │                      │                 │                 │
  │                   ├─ Get user info ──────►                 │                 │
  │                   │◄─ User data ──────────┤                 │                 │
  │                   │                      │                 │                 │
  │                   ├─ oauthLogin(provider, data) ──────────►│                 │
  │                   │                      │                 ├─ Find/create ──►│
  │                   │                      │                 │◄────────────────┤
  │                   │                      │                 │                 │
  │                   │                      │                 ├─ Generate tokens│
  │                   │                      │                 │                 │
  │                   │                      │                 ├─ Create session►│
  │                   │◄─ AuthResponse ──────────────────────────┤◄────────────────┤
  │                   │                      │                 │                 │
  │◄─ Redirect to frontend with tokens ──────┤                 │                 │
```

### 5. Token Refresh

```
Client                  AuthController              AuthService              Database
  │                           │                          │                       │
  ├─ POST /auth/refresh ─────►│                          │                       │
  │  {refreshToken}           │                          │                       │
  │                           ├─ refreshToken() ────────►│                       │
  │                           │                          ├─ Find session ───────►│
  │                           │                          │◄─────────────────────┤
  │                           │                          │                       │
  │                           │                          ├─ Validate session     │
  │                           │                          │                       │
  │                           │                          ├─ Generate new tokens  │
  │                           │                          │                       │
  │                           │                          ├─ Update session ─────►│
  │                           │◄─ AuthResponse ──────────┤◄─────────────────────┤
  │◄─ {accessToken, etc.} ────┤                          │                       │
```

### 6. 2FA Setup Flow

```
Client                  AuthController              AuthService              Database
  │                           │                          │                       │
  ├─ POST /auth/2fa/enable ──►│                          │                       │
  │  [with JWT]               │                          │                       │
  │                           ├─ enable2FA(userId) ─────►│                       │
  │                           │                          ├─ Generate secret      │
  │                           │                          │                       │
  │                           │                          ├─ Generate backups     │
  │                           │                          │                       │
  │                           │                          ├─ Save to user ───────►│
  │                           │◄─ {secret, qrCode} ──────┤◄─────────────────────┤
  │◄─ {secret, qrCode} ───────┤                          │                       │
  │                           │                          │                       │
  │ (User scans QR, gets code)│                          │                       │
  │                           │                          │                       │
  ├─ POST /auth/2fa/verify ──►│                          │                       │
  │  {code}                   │                          │                       │
  │                           ├─ verify2FASetup() ───────►│                       │
  │                           │                          ├─ Verify code          │
  │                           │                          │                       │
  │                           │                          ├─ Enable 2FA ─────────►│
  │                           │◄─ {backupCodes} ─────────┤◄─────────────────────┤
  │◄─ {backupCodes} ──────────┤                          │                       │
```

## Security Layers

### 1. Password Security
- **Bcrypt hashing** with 12 salt rounds
- **Minimum password length** enforced via validation
- **No password storage** for OAuth users

### 2. Token Security
- **JWT with HMAC-SHA256** signature
- **Short-lived access tokens** (1 hour default)
- **Long-lived refresh tokens** (7 days default)
- **Token type validation** (access vs refresh vs temp)

### 3. Session Security
- **Session tracking** with device info
- **IP address logging**
- **Session expiration**
- **Manual revocation** support
- **Automatic cleanup** of expired sessions

### 4. Account Security
- **Failed login tracking**
- **Account lockout** after 5 failed attempts
- **Temporary lockout** (15 minutes)
- **IP address logging**

### 5. 2FA Security
- **TOTP with 30-second window**
- **Backup codes** for recovery
- **QR code generation** for easy setup
- **Optional enforcement**

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password VARCHAR(255),
  first_name VARCHAR(255),
  last_name VARCHAR(255),
  provider VARCHAR(50) DEFAULT 'local',
  provider_id VARCHAR(255),
  email_verified BOOLEAN DEFAULT FALSE,
  two_factor_enabled BOOLEAN DEFAULT FALSE,
  two_factor_secret TEXT,
  two_factor_backup_codes JSONB,
  refresh_token TEXT,
  last_login_at TIMESTAMP,
  last_login_ip VARCHAR(45),
  failed_login_attempts INTEGER DEFAULT 0,
  locked_until TIMESTAMP,
  is_active BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_provider_id ON users(provider_id);
```

### Sessions Table
```sql
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_info JSONB,
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP,
  last_activity_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_refresh_token ON sessions(refresh_token);
```

## API Endpoint Summary

| Method | Endpoint | Auth Required | Description |
|--------|----------|---------------|-------------|
| POST | `/auth/register` | No | Register new user |
| POST | `/auth/login` | No | Login with email/password |
| POST | `/auth/refresh` | No | Refresh access token |
| POST | `/auth/logout` | Yes | Logout and revoke session |
| GET | `/auth/me` | Yes | Get current user profile |
| GET | `/auth/sessions` | Yes | Get active sessions |
| DELETE | `/auth/sessions/:id` | Yes | Revoke specific session |
| POST | `/auth/2fa/enable` | Yes | Initialize 2FA setup |
| POST | `/auth/2fa/verify-setup` | Yes | Verify and activate 2FA |
| POST | `/auth/2fa/disable` | Yes | Disable 2FA |
| GET | `/auth/oauth/google` | No | Initiate Google OAuth |
| GET | `/auth/oauth/google/callback` | No | Google OAuth callback |
| GET | `/auth/oauth/github` | No | Initiate GitHub OAuth |
| GET | `/auth/oauth/github/callback` | No | GitHub OAuth callback |

## Configuration

All authentication configuration is managed through environment variables. See `.env.example` for required variables.

## Testing Strategy

1. **Unit Tests**: Test individual service methods
2. **Integration Tests**: Test full authentication flows
3. **E2E Tests**: Test API endpoints end-to-end
4. **Security Tests**: Test attack scenarios (brute force, etc.)

## Monitoring & Logging

Key events that should be logged:
- User registration
- Successful/failed logins
- Account lockouts
- 2FA enable/disable
- Session creation/revocation
- OAuth authentications
- Token refreshes

## Performance Considerations

1. **Database Indexing**: Email and refresh_token fields are indexed
2. **Session Cleanup**: Implement periodic cleanup of expired sessions
3. **Token Validation**: Cache user data to reduce database queries
4. **Rate Limiting**: Implement on authentication endpoints

## Compliance

This system supports compliance with:
- **GDPR**: User data management and deletion
- **CCPA**: Privacy and data access controls
- **SOC 2**: Security controls and audit logging
- **PCI DSS**: Secure credential handling (if processing payments)
