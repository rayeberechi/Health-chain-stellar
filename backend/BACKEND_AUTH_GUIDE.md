# Backend Authentication Implementation Guide

## Overview

This guide helps you implement the required authentication endpoints for the frontend token refresh system.

## Required Endpoints

### 1. Login Endpoint

```typescript
// backend/src/auth/auth.controller.ts
@Post('login')
@HttpCode(HttpStatus.OK)
async login(@Body() loginDto: LoginDto) {
  return this.authService.login(loginDto);
}
```

```typescript
// backend/src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    // Add your user service/repository
  ) {}

  async login(loginDto: { email: string; password: string }) {
    // 1. Validate user credentials
    const user = await this.validateUser(loginDto.email, loginDto.password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // 2. Generate tokens
    const payload = { 
      sub: user.id, 
      email: user.email, 
      role: user.role 
    };
    
    const accessToken = this.jwtService.sign(payload, { 
      expiresIn: '15m' 
    });
    
    const refreshToken = this.jwtService.sign(payload, { 
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    });

    // 3. Optional: Store refresh token in database
    await this.storeRefreshToken(user.id, refreshToken);

    // 4. Return response
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async validateUser(email: string, password: string): Promise<any> {
    // Implement your user validation logic
    // Example:
    const user = await this.usersService.findByEmail(email);
    
    if (!user) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    
    if (!isPasswordValid) {
      return null;
    }

    return user;
  }

  private async storeRefreshToken(userId: string, token: string) {
    // Optional: Store refresh token in database
    // Useful for token rotation and revocation
    // await this.refreshTokenRepository.save({ userId, token });
  }
}
```

### 2. Refresh Endpoint

```typescript
// backend/src/auth/auth.controller.ts
@Post('refresh')
@HttpCode(HttpStatus.OK)
async refresh(@Body('refreshToken') refreshToken: string) {
  return this.authService.refreshToken(refreshToken);
}
```

```typescript
// backend/src/auth/auth.service.ts
async refreshToken(refreshToken: string) {
  try {
    // 1. Verify refresh token
    const payload = this.jwtService.verify(refreshToken, {
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    });

    // 2. Optional: Check if token is blacklisted
    const isBlacklisted = await this.isTokenBlacklisted(refreshToken);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    // 3. Optional: Check if token exists in database
    const storedToken = await this.findRefreshToken(payload.sub, refreshToken);
    if (!storedToken) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // 4. Generate new access token
    const newPayload = { 
      sub: payload.sub, 
      email: payload.email, 
      role: payload.role 
    };
    
    const newAccessToken = this.jwtService.sign(newPayload, { 
      expiresIn: '15m' 
    });

    // 5. Optional: Rotate refresh token (recommended for production)
    const newRefreshToken = this.jwtService.sign(newPayload, { 
      expiresIn: '7d',
      secret: process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    });

    // 6. Optional: Update stored refresh token
    await this.updateRefreshToken(payload.sub, refreshToken, newRefreshToken);

    // 7. Return new tokens
    return {
      access_token: newAccessToken,
      refresh_token: newRefreshToken, // Optional: omit if not rotating
    };
  } catch (error) {
    throw new UnauthorizedException('Invalid refresh token');
  }
}

private async isTokenBlacklisted(token: string): Promise<boolean> {
  // Check if token is in blacklist
  // return await this.tokenBlacklistRepository.exists(token);
  return false;
}

private async findRefreshToken(userId: string, token: string) {
  // Find token in database
  // return await this.refreshTokenRepository.findOne({ userId, token });
  return true; // Placeholder
}

private async updateRefreshToken(
  userId: string, 
  oldToken: string, 
  newToken: string
) {
  // Update token in database
  // await this.refreshTokenRepository.update({ userId, token: oldToken }, { token: newToken });
}
```

### 3. Logout Endpoint

```typescript
// backend/src/auth/auth.controller.ts
@Post('logout')
@HttpCode(HttpStatus.OK)
@UseGuards(JwtAuthGuard) // Optional: require authentication
async logout(@Body('userId') userId: string) {
  return this.authService.logout(userId);
}
```

```typescript
// backend/src/auth/auth.service.ts
async logout(userId: string) {
  // 1. Revoke all refresh tokens for user
  await this.revokeAllUserTokens(userId);

  // 2. Optional: Add current access token to blacklist
  // (requires passing token from request)

  return {
    message: 'Logged out successfully',
  };
}

private async revokeAllUserTokens(userId: string) {
  // Delete all refresh tokens for user
  // await this.refreshTokenRepository.delete({ userId });
}
```

## Module Configuration

### Install Dependencies

```bash
npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
npm install -D @types/passport-jwt @types/bcrypt
```

### Configure Auth Module

```typescript
// backend/src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
      signOptions: { expiresIn: '15m' },
    }),
    // Add your UsersModule or database module
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService],
})
export class AuthModule {}
```

### JWT Strategy

```typescript
// backend/src/auth/strategies/jwt.strategy.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key-change-in-production',
    });
  }

  async validate(payload: any) {
    return { 
      userId: payload.sub, 
      email: payload.email, 
      role: payload.role 
    };
  }
}
```

### JWT Auth Guard

```typescript
// backend/src/auth/guards/jwt-auth.guard.ts
import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}
```

## Environment Configuration

```bash
# backend/.env
JWT_SECRET=your-super-secret-key-min-32-characters-long
JWT_REFRESH_SECRET=your-refresh-secret-key-different-from-jwt-secret
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
```

## Protected Routes

```typescript
// Example protected endpoint
import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';

@Controller('orders')
export class OrdersController {
  @Get()
  @UseGuards(JwtAuthGuard)
  async findAll() {
    // This endpoint requires authentication
    return [];
  }
}
```

## CORS Configuration

```typescript
// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  await app.listen(3001);
}
bootstrap();
```

## Database Schema (Optional)

### Refresh Token Table

```sql
CREATE TABLE refresh_tokens (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, token)
);

CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_token ON refresh_tokens(token);
```

### Token Blacklist Table

```sql
CREATE TABLE token_blacklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_token_blacklist_token ON token_blacklist(token);
CREATE INDEX idx_token_blacklist_expires_at ON token_blacklist(expires_at);
```

## Testing

### Test Login

```bash
curl -X POST http://localhost:3001/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}'
```

### Test Refresh

```bash
curl -X POST http://localhost:3001/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{"refreshToken":"your-refresh-token"}'
```

### Test Protected Endpoint

```bash
curl -X GET http://localhost:3001/orders \
  -H "Authorization: Bearer your-access-token"
```

## Security Best Practices

### 1. Strong JWT Secret

```bash
# Generate strong secret
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2. Rate Limiting

```typescript
// Install: npm install @nestjs/throttler
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10, // 10 requests per minute
    }),
  ],
})
```

### 3. Password Hashing

```typescript
import * as bcrypt from 'bcrypt';

// Hash password
const hashedPassword = await bcrypt.hash(password, 10);

// Compare password
const isValid = await bcrypt.compare(password, hashedPassword);
```

### 4. Token Rotation

Always rotate refresh tokens on each refresh to detect token reuse.

### 5. Token Revocation

Implement token blacklist or database storage for revocation.

## Troubleshooting

### Issue: Frontend gets 401 on refresh

**Cause**: Refresh endpoint requires authentication
**Solution**: Make refresh endpoint public (no auth guard)

### Issue: CORS errors

**Cause**: CORS not configured
**Solution**: Add CORS configuration in main.ts

### Issue: Token verification fails

**Cause**: Wrong secret or expired token
**Solution**: Check JWT_SECRET and token expiry

## Production Checklist

- [ ] Strong JWT secrets (min 32 characters)
- [ ] Secrets in environment variables
- [ ] HTTPS enabled
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] Token rotation implemented
- [ ] Token blacklist implemented
- [ ] Password hashing (bcrypt, 10+ rounds)
- [ ] Input validation
- [ ] Error handling
- [ ] Logging configured
- [ ] Monitoring setup

## Next Steps

1. Implement the three endpoints
2. Configure JWT module
3. Set up database tables (optional)
4. Test with frontend
5. Implement rate limiting
6. Add token rotation
7. Set up monitoring

## Support

For questions:
1. Check NestJS documentation
2. Review JWT best practices
3. Check frontend implementation
4. Test endpoints with curl/Postman
