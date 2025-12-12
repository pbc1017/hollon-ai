# Advanced Authentication System

A comprehensive authentication system for NestJS with JWT, OAuth (Google/GitHub), Two-Factor Authentication (2FA), and session management.

## Features

### 🔐 Core Authentication
- **Email/Password Registration & Login** with bcrypt hashing
- **JWT Token-based Authentication** with access and refresh tokens
- **Session Management** with device tracking
- **Account Security** with failed login attempts tracking and account lockout

### 🌐 OAuth Integration
- **Google OAuth** integration
- **GitHub OAuth** integration
- **Automatic Account Linking** for existing users
- **Seamless Provider Switching**

### 🔑 Two-Factor Authentication (2FA)
- **TOTP-based 2FA** using time-based one-time passwords
- **QR Code Generation** for easy setup with authenticator apps
- **Backup Codes** for account recovery
- **Flexible 2FA Enforcement** - users can enable/disable as needed

### 📊 Session Management
- **Multiple Active Sessions** support
- **Session Tracking** with IP address and user agent
- **Device Information** storage
- **Session Revocation** (individual or all sessions)
- **Automatic Session Expiration**

### 🛡️ Security Features
- **Password Hashing** with bcrypt (12 salt rounds)
- **Account Lockout** after 5 failed login attempts (15-minute lockout)
- **Token Expiration** management
- **Refresh Token Rotation**
- **Session Validation**

## Architecture

### Entities

#### User Entity
```typescript
- id: UUID (primary key)
- email: string (unique, indexed)
- password: string (hashed, nullable for OAuth users)
- firstName: string (nullable)
- lastName: string (nullable)
- provider: enum (local, google, github)
- providerId: string (indexed, for OAuth)
- emailVerified: boolean
- twoFactorEnabled: boolean
- twoFactorSecret: string (nullable)
- twoFactorBackupCodes: string[] (hashed, nullable)
- refreshToken: string (nullable)
- lastLoginAt: timestamp
- lastLoginIp: string
- failedLoginAttempts: number
- lockedUntil: timestamp (nullable)
- isActive: boolean
- metadata: jsonb
- sessions: Session[] (one-to-many)
```

#### Session Entity
```typescript
- id: UUID (primary key)
- userId: UUID (foreign key, indexed)
- accessToken: string
- refreshToken: string (indexed)
- expiresAt: timestamp
- ipAddress: string
- userAgent: string
- deviceInfo: jsonb
- isRevoked: boolean
- revokedAt: timestamp (nullable)
- lastActivityAt: timestamp
```

### Controllers

#### AuthController (`/auth`)
- `POST /auth/register` - Register new user
- `POST /auth/login` - Login with email/password
- `POST /auth/refresh` - Refresh access token
- `POST /auth/logout` - Logout and revoke session
- `GET /auth/me` - Get current user profile
- `GET /auth/sessions` - Get active sessions
- `DELETE /auth/sessions/:sessionId` - Revoke specific session
- `POST /auth/2fa/enable` - Initialize 2FA setup
- `POST /auth/2fa/verify-setup` - Verify and activate 2FA
- `POST /auth/2fa/disable` - Disable 2FA

#### OAuthController (`/auth/oauth`)
- `GET /auth/oauth/google` - Initiate Google OAuth
- `GET /auth/oauth/google/callback` - Google OAuth callback
- `GET /auth/oauth/github` - Initiate GitHub OAuth
- `GET /auth/oauth/github/callback` - GitHub OAuth callback

### Services

#### AuthService
Core authentication logic including:
- User registration and login
- Password hashing and validation
- JWT token generation and validation
- OAuth user creation/linking
- 2FA setup, verification, and management
- Session management
- Account security (lockout, failed attempts)

### Guards & Decorators

#### Guards
- **JwtAuthGuard** - Protects routes requiring authentication
- **TwoFactorGuard** - Ensures 2FA verification when enabled

#### Decorators
- **@Public()** - Marks routes as publicly accessible
- **@CurrentUser()** - Injects authenticated user into route handler

### Strategies

#### JwtStrategy
Passport strategy for validating JWT tokens and loading user data.

## API Usage

### Registration

```bash
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Response:**
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "expiresIn": 3600,
  "tokenType": "Bearer",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "twoFactorEnabled": false
  }
}
```

### Login

```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**With 2FA enabled:**
```json
{
  "requiresTwoFactor": true,
  "tempToken": "temporary-token"
}
```

**Then verify 2FA:**
```bash
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securePassword123",
  "twoFactorCode": "123456"
}
```

### OAuth Login

#### Google
```bash
GET /auth/oauth/google
# Redirects to Google OAuth consent screen
# After consent, redirects to callback URL with tokens
```

#### GitHub
```bash
GET /auth/oauth/github
# Redirects to GitHub OAuth authorization
# After authorization, redirects to callback URL with tokens
```

### Enable 2FA

**Step 1: Initiate 2FA setup**
```bash
POST /auth/2fa/enable
Authorization: Bearer <access-token>
```

**Response:**
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qrCode": "otpauth://totp/HollonAI:user@example.com?secret=JBSWY3DPEHPK3PXP&issuer=HollonAI"
}
```

**Step 2: Verify and activate**
```bash
POST /auth/2fa/verify-setup
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "code": "123456"
}
```

**Response:**
```json
{
  "backupCodes": [
    "ABCD-1234",
    "EFGH-5678",
    ...
  ]
}
```

### Session Management

**Get active sessions:**
```bash
GET /auth/sessions
Authorization: Bearer <access-token>
```

**Revoke a session:**
```bash
DELETE /auth/sessions/:sessionId
Authorization: Bearer <access-token>
```

**Logout (revoke current session):**
```bash
POST /auth/logout
Authorization: Bearer <access-token>
```

## Environment Variables

Add these to your `.env` file:

```env
# JWT Configuration
JWT_SECRET=your-super-secret-key-change-in-production
JWT_EXPIRATION=3600         # 1 hour in seconds
REFRESH_EXPIRATION=604800   # 7 days in seconds

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/auth/oauth/google/callback

# GitHub OAuth
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
GITHUB_REDIRECT_URI=http://localhost:3000/auth/oauth/github/callback

# Frontend URL (for OAuth redirects)
FRONTEND_URL=http://localhost:3001
```

## Database Migration

Create and run a migration to add the `users` and `sessions` tables:

```bash
npm run db:migrate:generate -- AddAuthTables
npm run db:migrate
```

## Installation

The required dependencies have been added to `package.json`:

```bash
npm install
```

### Dependencies Added:
- `@nestjs/jwt` - JWT token handling
- `@nestjs/passport` - Passport integration
- `passport` - Authentication middleware
- `passport-jwt` - JWT strategy for Passport
- `bcrypt` - Password hashing
- `speakeasy` - TOTP generation for 2FA
- `qrcode` - QR code generation for 2FA setup

## Security Best Practices

1. **Never commit secrets** - Use environment variables for all sensitive data
2. **Use HTTPS in production** - All authentication must be over secure connections
3. **Rotate JWT secrets** regularly
4. **Implement rate limiting** on authentication endpoints
5. **Monitor failed login attempts** and suspicious activity
6. **Keep dependencies updated** to patch security vulnerabilities
7. **Use strong password policies** (minimum length, complexity requirements)
8. **Implement CSRF protection** for state-changing operations
9. **Enable 2FA for sensitive accounts** (admins, etc.)
10. **Regularly audit active sessions** and revoke suspicious ones

## Testing

Example test for authentication:

```typescript
describe('AuthController', () => {
  it('should register a new user', async () => {
    const result = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'test@example.com',
        password: 'SecurePass123',
        firstName: 'Test',
        lastName: 'User'
      })
      .expect(201);

    expect(result.body).toHaveProperty('accessToken');
    expect(result.body).toHaveProperty('refreshToken');
    expect(result.body.user.email).toBe('test@example.com');
  });
});
```

## Future Enhancements

- [ ] Email verification flow
- [ ] Password reset functionality
- [ ] Social OAuth providers (Twitter, LinkedIn, Microsoft)
- [ ] WebAuthn/FIDO2 support
- [ ] Biometric authentication
- [ ] Advanced session analytics
- [ ] IP whitelist/blacklist
- [ ] Geolocation-based security
- [ ] Magic link authentication
- [ ] Role-based access control (RBAC)

## License

Proprietary - Hollon AI
