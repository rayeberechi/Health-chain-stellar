# Security Guidelines

## Authentication System Security

### Token Management

#### Access Tokens
- **Lifetime**: 15 minutes (recommended)
- **Storage**: sessionStorage (client-side)
- **Transmission**: Authorization header only
- **Never**: In URLs, localStorage, or cookies (client-side)

#### Refresh Tokens
- **Lifetime**: 7 days (recommended)
- **Storage**: httpOnly cookie (backend) or sessionStorage (current implementation)
- **Transmission**: Request body for refresh endpoint
- **Rotation**: Recommended for production

### Storage Security

#### Why sessionStorage?

✅ **Advantages:**
- Cleared on browser/tab close
- Not accessible across tabs
- Reduced XSS attack surface
- Better for sensitive data

❌ **localStorage Risks:**
- Persists indefinitely
- Accessible across all tabs
- Higher XSS risk
- Not cleared automatically

#### XSS Protection

1. **Content Security Policy (CSP)**
   ```typescript
   // next.config.ts
   const securityHeaders = [
     {
       key: 'Content-Security-Policy',
       value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline'; style-src 'self' 'unsafe-inline';"
     }
   ];
   ```

2. **Input Sanitization**
   - Always sanitize user input
   - Use React's built-in XSS protection
   - Avoid dangerouslySetInnerHTML

3. **Dependency Security**
   ```bash
   npm audit
   npm audit fix
   ```

### Network Security

#### HTTPS Only
```typescript
// Enforce HTTPS in production
if (process.env.NODE_ENV === 'production' && !req.secure) {
  return res.redirect('https://' + req.headers.host + req.url);
}
```

#### CORS Configuration
```typescript
// backend/src/main.ts
app.enableCors({
  origin: process.env.FRONTEND_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});
```

#### Rate Limiting
```typescript
// backend - Install: npm install @nestjs/throttler
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot({
      ttl: 60,
      limit: 10,
    }),
  ],
})
```

### Token Refresh Security

#### Request Queue Pattern
- Prevents duplicate refresh calls
- Reduces server load
- Minimizes race conditions
- Already implemented ✅

#### Refresh Token Rotation
```typescript
// Recommended backend implementation
async refreshToken(refreshToken: string) {
  const payload = this.jwtService.verify(refreshToken);
  
  // Invalidate old refresh token
  await this.tokenBlacklist.add(refreshToken);
  
  // Generate new tokens
  return {
    access_token: this.generateAccessToken(payload),
    refresh_token: this.generateRefreshToken(payload), // New refresh token
  };
}
```

#### Token Reuse Detection
```typescript
// Detect compromised tokens
if (await this.tokenBlacklist.exists(refreshToken)) {
  // Token reuse detected - possible security breach
  await this.revokeAllUserTokens(userId);
  throw new UnauthorizedException('Token reuse detected');
}
```

### Backend Security Checklist

- [ ] JWT secret is strong (min 32 characters)
- [ ] JWT secret is stored in environment variables
- [ ] Access tokens expire in 15 minutes or less
- [ ] Refresh tokens expire in 7 days or less
- [ ] Refresh tokens are rotated on each use
- [ ] Token reuse is detected and handled
- [ ] Rate limiting is enabled on auth endpoints
- [ ] CORS is properly configured
- [ ] HTTPS is enforced in production
- [ ] Passwords are hashed with bcrypt (min 10 rounds)
- [ ] SQL injection protection is enabled
- [ ] Input validation is implemented
- [ ] Error messages don't leak sensitive info

### Frontend Security Checklist

- [ ] Tokens stored in sessionStorage (not localStorage)
- [ ] No tokens in URLs or query parameters
- [ ] CSP headers configured
- [ ] XSS protection enabled
- [ ] Dependencies are up to date
- [ ] npm audit shows no vulnerabilities
- [ ] Environment variables are properly configured
- [ ] API URL uses HTTPS in production
- [ ] Error messages don't expose sensitive data
- [ ] User input is sanitized

### Common Vulnerabilities

#### 1. XSS (Cross-Site Scripting)

**Risk**: Attacker injects malicious scripts
**Mitigation**:
- Use React (auto-escapes by default)
- Implement CSP headers
- Sanitize user input
- Avoid dangerouslySetInnerHTML

#### 2. CSRF (Cross-Site Request Forgery)

**Risk**: Unauthorized actions on behalf of user
**Mitigation**:
```typescript
// Use CSRF tokens for state-changing operations
import { csurf } from 'csurf';
app.use(csurf({ cookie: true }));
```

#### 3. Token Theft

**Risk**: Attacker steals tokens
**Mitigation**:
- Short token lifetime
- sessionStorage (cleared on close)
- HTTPS only
- httpOnly cookies for refresh tokens

#### 4. Man-in-the-Middle (MITM)

**Risk**: Attacker intercepts communication
**Mitigation**:
- HTTPS everywhere
- HSTS headers
- Certificate pinning (mobile apps)

#### 5. Brute Force Attacks

**Risk**: Attacker guesses credentials
**Mitigation**:
- Rate limiting
- Account lockout after failed attempts
- CAPTCHA after multiple failures
- Strong password requirements

### Monitoring and Logging

#### What to Log
```typescript
// Security events to log
- Failed login attempts
- Token refresh failures
- Unusual access patterns
- API errors
- Rate limit violations
```

#### What NOT to Log
```typescript
// Never log these
- Passwords
- Tokens (access or refresh)
- Credit card numbers
- Personal identification numbers
- API keys
```

#### Monitoring Tools
- **Sentry**: Error tracking
- **LogRocket**: Session replay
- **DataDog**: Application monitoring
- **CloudWatch**: AWS monitoring

### Incident Response

#### If Token is Compromised

1. **Immediate Actions**
   ```typescript
   // Revoke all user tokens
   await this.revokeAllUserTokens(userId);
   
   // Force re-authentication
   await this.clearUserSessions(userId);
   
   // Notify user
   await this.sendSecurityAlert(userId);
   ```

2. **Investigation**
   - Check access logs
   - Identify affected users
   - Determine attack vector
   - Document findings

3. **Prevention**
   - Patch vulnerability
   - Update security measures
   - Rotate secrets if needed
   - Notify affected users

### Compliance

#### GDPR Considerations
- User data is stored in sessionStorage (temporary)
- Data is cleared on browser close
- Users can delete data by logging out
- No persistent tracking without consent

#### HIPAA Considerations (Healthcare Data)
- Encrypt data in transit (HTTPS)
- Encrypt data at rest (backend)
- Implement audit logging
- Access controls and authentication
- Regular security assessments

### Security Testing

#### Manual Testing
```bash
# Test XSS
<script>alert('XSS')</script>

# Test SQL Injection
' OR '1'='1

# Test CSRF
# Try making requests from different origin

# Test Rate Limiting
# Make multiple rapid requests
```

#### Automated Testing
```bash
# Dependency vulnerabilities
npm audit

# OWASP ZAP
zap-cli quick-scan http://localhost:3000

# Snyk
snyk test
```

### Production Deployment

#### Pre-Deployment Checklist
- [ ] All secrets in environment variables
- [ ] HTTPS configured
- [ ] Security headers configured
- [ ] Rate limiting enabled
- [ ] Error monitoring setup
- [ ] Logging configured
- [ ] Backup strategy in place
- [ ] Incident response plan documented

#### Security Headers
```typescript
// next.config.ts
const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on'
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload'
  },
  {
    key: 'X-Frame-Options',
    value: 'SAMEORIGIN'
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff'
  },
  {
    key: 'X-XSS-Protection',
    value: '1; mode=block'
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin'
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()'
  }
];
```

### Regular Maintenance

#### Weekly
- [ ] Review access logs
- [ ] Check for failed login attempts
- [ ] Monitor error rates

#### Monthly
- [ ] Update dependencies
- [ ] Run security audit
- [ ] Review and rotate secrets
- [ ] Test backup restoration

#### Quarterly
- [ ] Security assessment
- [ ] Penetration testing
- [ ] Review and update policies
- [ ] Team security training

### Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)
- [Next.js Security](https://nextjs.org/docs/advanced-features/security-headers)
- [NestJS Security](https://docs.nestjs.com/security/authentication)

### Reporting Security Issues

If you discover a security vulnerability:

1. **DO NOT** open a public issue
2. Email: security@yourdomain.com
3. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

We will respond within 48 hours.
