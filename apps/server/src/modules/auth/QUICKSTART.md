# Quick Start Guide

Get the authentication system up and running in 5 minutes.

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database running
- Basic understanding of REST APIs

## Step 1: Install Dependencies (30 seconds)

```bash
cd apps/server
npm install
```

This installs all required packages including JWT, Passport, bcrypt, and more.

## Step 2: Configure Environment (2 minutes)

Create or update your `.env.local` file in the project root:

```bash
# Minimum configuration to get started
JWT_SECRET=your-super-secret-key-change-this-in-production
JWT_EXPIRATION=3600
REFRESH_EXPIRATION=604800

# Optional: OAuth (skip for now if you want)
# GOOGLE_CLIENT_ID=...
# GITHUB_CLIENT_ID=...
```

💡 **Quick Secret Generator:**

```bash
# Generate a secure JWT secret
openssl rand -base64 64
```

## Step 3: Set Up Database (1 minute)

### Option A: Automatic (Recommended)

```bash
npm run db:migrate:generate -- CreateAuthTables
npm run db:migrate
```

### Option B: Manual

Run the SQL from `MIGRATION.md` in your PostgreSQL client.

## Step 4: Start the Server (30 seconds)

```bash
npm run dev
```

Server should start on `http://localhost:3000`

## Step 5: Test the API (1 minute)

### Register a User

```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "MySecurePass123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**Expected Response:**

```json
{
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": 3600,
  "tokenType": "Bearer",
  "user": {
    "id": "uuid-here",
    "email": "test@example.com",
    "firstName": "John",
    "lastName": "Doe",
    "twoFactorEnabled": false
  }
}
```

### Login

```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "MySecurePass123"
  }'
```

### Get User Profile

```bash
# Copy the accessToken from login response
curl -X GET http://localhost:3000/auth/me \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN_HERE"
```

## 🎉 You're Done!

The authentication system is now running. Here's what you can do next:

### Basic Features (No Additional Setup)

- ✅ Register users
- ✅ Login with email/password
- ✅ Get user profile
- ✅ Refresh tokens
- ✅ Logout
- ✅ Session management

### Advanced Features (Requires Additional Setup)

#### Enable 2FA

1. Login and get access token
2. Call `POST /auth/2fa/enable` with Bearer token
3. Scan QR code with authenticator app (Google Authenticator, Authy, etc.)
4. Call `POST /auth/2fa/verify-setup` with 6-digit code
5. Save backup codes!

#### Enable OAuth

**Google:**

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth credentials
3. Add to `.env.local`:
   ```
   GOOGLE_CLIENT_ID=your-id
   GOOGLE_CLIENT_SECRET=your-secret
   GOOGLE_REDIRECT_URI=http://localhost:3000/auth/oauth/google/callback
   ```
4. Visit `http://localhost:3000/auth/oauth/google`

**GitHub:**

1. Go to [GitHub Settings](https://github.com/settings/developers)
2. Create OAuth App
3. Add to `.env.local`:
   ```
   GITHUB_CLIENT_ID=your-id
   GITHUB_CLIENT_SECRET=your-secret
   GITHUB_REDIRECT_URI=http://localhost:3000/auth/oauth/github/callback
   ```
4. Visit `http://localhost:3000/auth/oauth/github`

## Common Issues

### "Table 'users' doesn't exist"

**Solution:** Run the database migration (Step 3)

### "Invalid credentials"

**Solution:**

- Ensure password is at least 8 characters
- Check email is correct
- Try registering a new user

### "JWT must be provided"

**Solution:**

- Add `Authorization: Bearer YOUR_TOKEN` header
- Or use `@Public()` decorator for public routes

### OAuth redirect not working

**Solution:**

- Check redirect URIs match exactly in OAuth provider settings
- Ensure FRONTEND_URL is set in `.env.local`
- Verify OAuth credentials are correct

## API Testing Tools

### Postman Collection

Import these endpoints:

```json
{
  "info": { "name": "Auth API" },
  "item": [
    {
      "name": "Register",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/auth/register",
        "body": {
          "mode": "raw",
          "raw": "{\"email\":\"test@example.com\",\"password\":\"password123\"}"
        }
      }
    },
    {
      "name": "Login",
      "request": {
        "method": "POST",
        "url": "{{baseUrl}}/auth/login",
        "body": {
          "mode": "raw",
          "raw": "{\"email\":\"test@example.com\",\"password\":\"password123\"}"
        }
      }
    }
  ],
  "variable": [{ "key": "baseUrl", "value": "http://localhost:3000" }]
}
```

### HTTPie (Alternative to curl)

```bash
# Install
brew install httpie  # macOS
# or
pip install httpie   # Python

# Use
http POST localhost:3000/auth/register email=test@example.com password=pass123
```

## Next Steps

1. **Read the Documentation**
   - `README.md` - Full feature documentation
   - `ARCHITECTURE.md` - System design and flows
   - `MIGRATION.md` - Database details

2. **Implement in Frontend**

   ```typescript
   // Example: Login function
   async function login(email: string, password: string) {
     const response = await fetch('http://localhost:3000/auth/login', {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({ email, password }),
     });
     const data = await response.json();
     localStorage.setItem('accessToken', data.accessToken);
     localStorage.setItem('refreshToken', data.refreshToken);
     return data;
   }
   ```

3. **Protect Your Routes**

   ```typescript
   // In your controllers, routes are protected by default
   @Get('protected')
   getProtectedData(@CurrentUser() user: User) {
     return { message: `Hello ${user.email}` };
   }

   // Make a route public
   @Public()
   @Get('public')
   getPublicData() {
     return { message: 'This is public' };
   }
   ```

4. **Add Rate Limiting** (Production)

   ```bash
   npm install @nestjs/throttler
   ```

5. **Set Up Monitoring**
   - Track failed login attempts
   - Monitor session creation
   - Alert on unusual activity

## Support

- 📖 Full docs: See `README.md`
- 🏗️ Architecture: See `ARCHITECTURE.md`
- 🗄️ Database: See `MIGRATION.md`
- 💬 Questions: Check the code comments

## Production Checklist

Before going to production:

- [ ] Change JWT_SECRET to a secure random value
- [ ] Set up HTTPS/SSL
- [ ] Configure OAuth for production domain
- [ ] Enable rate limiting
- [ ] Set up monitoring and logging
- [ ] Review security settings
- [ ] Test all flows thoroughly
- [ ] Set up automated backups
- [ ] Configure CORS properly
- [ ] Review GDPR/CCPA requirements

---

**Ready to build!** 🚀

Your authentication system is now running and ready for integration with your application.
