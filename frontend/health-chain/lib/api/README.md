# HTTP Client with Automatic Token Refresh

## Overview

This HTTP client implements automatic token refresh with a request queue pattern to prevent duplicate refresh calls and ensure seamless user experience.

## Features

- ✅ Automatic token refresh on 401 responses
- ✅ Request queue pattern (no duplicate refresh calls)
- ✅ Concurrent request handling during refresh
- ✅ Session expiry notifications
- ✅ TypeScript support with generics
- ✅ Zustand store with sessionStorage persistence

## Architecture

### Request Flow

```
1. Request sent with access token
2. If 401 received:
   a. Check if refresh already in progress
   b. If yes: Queue request and wait
   c. If no: Start refresh process
3. Refresh token exchanged for new access token
4. All queued requests retried with new token
5. If refresh fails: Clear auth and redirect to login
```

### Components

1. **HTTP Client** (`lib/api/http-client.ts`)
   - Main fetch wrapper with interceptor logic
   - Request queue management
   - Token refresh coordination

2. **Auth Store** (`lib/stores/auth.store.ts`)
   - Zustand store with persist middleware
   - sessionStorage for security (cleared on browser close)
   - Token and user state management

3. **Auth Hook** (`lib/hooks/useAuth.ts`)
   - React hook for auth operations
   - Login, logout, and state access

4. **Middleware** (`middleware.ts`)
   - Server-side route protection
   - Redirect unauthenticated users
   - Prevent authenticated users from accessing auth pages

## Usage

### Making API Calls

```typescript
import { api } from '@/lib/api/http-client';

// GET request
const data = await api.get<User>('/users/me');

// POST request
const result = await api.post('/orders', { 
  bloodType: 'A+', 
  quantity: 2 
});

// PUT request
await api.put(`/users/${id}`, userData);

// DELETE request
await api.delete(`/orders/${orderId}`);

// Skip authentication (for public endpoints)
const publicData = await api.get('/public/stats', { skipAuth: true });
```

### Using Auth Hook

```typescript
import { useAuth } from '@/lib/hooks/useAuth';

function MyComponent() {
  const { user, isAuthenticated, login, logout } = useAuth();

  const handleLogin = async () => {
    const result = await login({
      email: 'user@example.com',
      password: 'password123'
    });

    if (result.success) {
      console.log('Logged in:', result.user);
    } else {
      console.error('Login failed:', result.error);
    }
  };

  return (
    <div>
      {isAuthenticated ? (
        <>
          <p>Welcome, {user?.name}</p>
          <button onClick={logout}>Logout</button>
        </>
      ) : (
        <button onClick={handleLogin}>Login</button>
      )}
    </div>
  );
}
```

### Toast Notifications

```typescript
import { useToast } from '@/lib/hooks/useToast';

function MyComponent() {
  const { success, error, warning, info } = useToast();

  const handleAction = async () => {
    try {
      await api.post('/action');
      success('Action completed successfully!');
    } catch (err) {
      error('Action failed. Please try again.');
    }
  };

  return <button onClick={handleAction}>Perform Action</button>;
}
```

## Security Considerations

### sessionStorage vs localStorage

We use **sessionStorage** instead of localStorage for the following reasons:

1. **Automatic cleanup**: Cleared when browser/tab closes
2. **Reduced XSS risk**: Shorter lifetime limits exposure
3. **Better for sensitive data**: Tokens don't persist indefinitely
4. **Compliance**: Meets security best practices for token storage

### Token Refresh Security

1. **Refresh tokens are httpOnly** (backend implementation required)
2. **Access tokens have short expiry** (recommended: 15 minutes)
3. **Refresh tokens have longer expiry** (recommended: 7 days)
4. **Failed refresh clears all auth state**
5. **Tokens are never exposed in URLs**

### CSRF Protection

For production, implement:
1. CSRF tokens for state-changing operations
2. SameSite cookie attributes
3. Origin/Referer header validation

## Backend Requirements

Your backend must implement:

### 1. Login Endpoint

```typescript
POST /auth/login
Body: { email: string, password: string }
Response: {
  access_token: string,
  refresh_token: string,
  user: {
    id: string,
    email: string,
    name: string,
    role: string
  }
}
```

### 2. Refresh Endpoint

```typescript
POST /auth/refresh
Body: { refreshToken: string }
Response: {
  access_token: string,
  refresh_token?: string  // Optional: rotate refresh token
}
```

### 3. Logout Endpoint

```typescript
POST /auth/logout
Body: { userId: string }
Response: { message: string }
```

### 4. Protected Endpoints

Return 401 status code when access token is invalid/expired:

```typescript
Response: 401 Unauthorized
Body: { message: "Token expired" }
```

## Testing

### Manual Testing

1. **Login Flow**
   ```bash
   # Login and verify tokens are stored
   # Check sessionStorage in DevTools
   ```

2. **Token Refresh**
   ```bash
   # Wait for access token to expire
   # Make API call
   # Verify automatic refresh and request retry
   ```

3. **Concurrent Requests**
   ```bash
   # Make multiple API calls simultaneously
   # Verify only one refresh call is made
   # Verify all requests complete successfully
   ```

4. **Session Expiry**
   ```bash
   # Invalidate refresh token on backend
   # Make API call
   # Verify redirect to /auth/signin?reason=session_expired
   # Verify toast notification appears
   ```

5. **Route Protection**
   ```bash
   # Logout
   # Try to access /dashboard
   # Verify redirect to /auth/signin?redirect=/dashboard
   ```

### Automated Testing

See `__tests__` directory for unit and integration tests.

## Troubleshooting

### Issue: Infinite refresh loop

**Cause**: Refresh endpoint returns 401
**Solution**: Ensure refresh endpoint doesn't require authentication

### Issue: Requests fail after refresh

**Cause**: New token not being used
**Solution**: Check that `updateAccessToken` is called before retrying

### Issue: Multiple refresh calls

**Cause**: Race condition in refresh logic
**Solution**: Verify `isRefreshing` flag is properly managed

### Issue: Session not persisting

**Cause**: sessionStorage not available
**Solution**: Check browser compatibility and privacy settings

## CI/CD Integration

### Environment Variables

```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.production.com
```

### Build Checks

```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build
npm run build
```

### Deployment Checklist

- [ ] Environment variables configured
- [ ] API URL points to correct backend
- [ ] CORS configured on backend
- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] Error monitoring setup (Sentry, etc.)

## Performance Considerations

1. **Request Queue**: Minimal memory overhead, cleared after refresh
2. **Token Storage**: sessionStorage is synchronous but fast
3. **Retry Logic**: Only retries original request once
4. **Network**: Single refresh call for multiple concurrent requests

## Future Enhancements

- [ ] Token refresh before expiry (proactive refresh)
- [ ] Offline support with request queuing
- [ ] Request deduplication
- [ ] Retry logic for network errors
- [ ] Request/response interceptor plugins
