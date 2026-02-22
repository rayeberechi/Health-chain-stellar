# Authentication Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd frontend/health-chain
npm install
```

This will install:
- `zustand` - State management with persistence
- `vitest` - Testing framework (dev dependency)

### 2. Configure Environment

Create `.env.local` file:

```bash
cp .env.example .env.local
```

Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### 3. Update Backend

Ensure your backend implements the required endpoints:

#### Update `backend/src/auth/auth.service.ts`

```typescript
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private jwtService: JwtService) {}

  async login(loginDto: { email: string; password: string }) {
    // Validate user credentials (implement your logic)
    const user = await this.validateUser(loginDto.email, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const payload = { sub: user.id, email: user.email, role: user.role };
    
    return {
      access_token: this.jwtService.sign(payload, { expiresIn: '15m' }),
      refresh_token: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken);
      
      // Generate new access token
      const newPayload = { sub: payload.sub, email: payload.email, role: payload.role };
      
      return {
        access_token: this.jwtService.sign(newPayload, { expiresIn: '15m' }),
        // Optionally rotate refresh token
        // refresh_token: this.jwtService.sign(newPayload, { expiresIn: '7d' }),
      };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async validateUser(email: string, password: string): Promise<any> {
    // Implement your user validation logic
    // Example: fetch user from database and compare password
    return null;
  }

  async logout(userId: string) {
    // Implement logout logic (e.g., blacklist token, clear sessions)
    return { message: 'Logged out successfully' };
  }
}
```

#### Install JWT Package (if not already installed)

```bash
cd backend
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt
```

#### Update `backend/src/auth/auth.module.ts`

```typescript
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService],
})
export class AuthModule {}
```

### 4. Test the Implementation

#### Start Backend
```bash
cd backend
npm run start:dev
```

#### Start Frontend
```bash
cd frontend/health-chain
npm run dev
```

#### Run Tests
```bash
cd frontend/health-chain
npm run test
```

### 5. Verify Functionality

1. **Login Flow**
   - Navigate to http://localhost:3000/auth/signin
   - Enter credentials
   - Verify redirect to dashboard
   - Check sessionStorage for auth tokens

2. **Token Refresh**
   - Open DevTools > Application > Session Storage
   - Note the access token
   - Wait 15 minutes (or modify token expiry for testing)
   - Make an API call
   - Verify token is automatically refreshed

3. **Session Expiry**
   - Invalidate refresh token on backend
   - Make an API call
   - Verify redirect to login with "session expired" message

4. **Route Protection**
   - Logout
   - Try to access http://localhost:3000/dashboard
   - Verify redirect to login
   - Login and verify redirect back to dashboard

## Testing Checklist

- [ ] Login with valid credentials works
- [ ] Login with invalid credentials shows error
- [ ] Dashboard is accessible when authenticated
- [ ] Dashboard redirects to login when not authenticated
- [ ] Token refresh happens automatically on 401
- [ ] Multiple concurrent requests trigger only one refresh
- [ ] Session expiry shows toast notification
- [ ] Logout clears session and redirects to login
- [ ] Page refresh preserves session
- [ ] Browser close clears session
- [ ] Redirect after login works correctly

## Troubleshooting

### Backend not returning tokens

**Check:**
1. Backend is running on correct port (3001)
2. CORS is configured to allow frontend origin
3. JWT secret is configured
4. Auth endpoints are properly implemented

**Fix:**
```typescript
// backend/src/main.ts
app.enableCors({
  origin: 'http://localhost:3000',
  credentials: true,
});
```

### Middleware redirect loop

**Check:**
1. Middleware matcher excludes static files
2. Auth routes are properly configured
3. sessionStorage is accessible

**Fix:**
Already configured in `middleware.ts` - verify matcher pattern.

### Token not refreshing

**Check:**
1. Refresh endpoint doesn't require authentication
2. Refresh token is valid
3. Backend returns correct response format

**Fix:**
Ensure refresh endpoint is public (no auth guard).

### Session not persisting

**Check:**
1. Browser privacy settings
2. sessionStorage is enabled
3. Zustand persist is configured correctly

**Fix:**
Already configured - check browser compatibility.

## Production Deployment

### Environment Variables

Set these in your production environment:

```env
# Frontend
NEXT_PUBLIC_API_URL=https://api.yourdomain.com

# Backend
JWT_SECRET=your-secure-random-secret-key
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

### Security Checklist

- [ ] Use HTTPS in production
- [ ] Set secure JWT secret (min 32 characters)
- [ ] Configure CORS properly
- [ ] Enable rate limiting on auth endpoints
- [ ] Implement token rotation
- [ ] Set up error monitoring
- [ ] Configure security headers
- [ ] Enable httpOnly cookies for refresh tokens (recommended)

### Build and Deploy

```bash
# Frontend
cd frontend/health-chain
npm run build
npm run start

# Backend
cd backend
npm run build
npm run start:prod
```

## Next Steps

1. Implement user registration
2. Add password reset functionality
3. Implement remember me feature
4. Add multi-factor authentication
5. Set up error monitoring (Sentry, LogRocket)
6. Configure analytics
7. Add rate limiting
8. Implement token rotation

## Support

For detailed documentation, see:
- [AUTHENTICATION_IMPLEMENTATION.md](../../AUTHENTICATION_IMPLEMENTATION.md)
- [lib/api/README.md](./lib/api/README.md)

For issues:
1. Check troubleshooting section above
2. Review test files for examples
3. Check backend logs
4. Verify environment variables
