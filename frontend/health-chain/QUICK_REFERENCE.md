# Authentication System - Quick Reference

## 🚀 Quick Start

```bash
cd frontend/health-chain
./install-auth.sh
```

## 📦 Import Statements

```typescript
// HTTP Client
import { api } from '@/lib/api/http-client';

// Auth Hook
import { useAuth } from '@/lib/hooks/useAuth';

// Toast Hook
import { useToast } from '@/lib/hooks/useToast';

// Auth Store (direct access)
import { useAuthStore } from '@/lib/stores/auth.store';
```

## 🔌 API Calls

```typescript
// GET
const data = await api.get<User>('/users/me');

// POST
const result = await api.post('/orders', { bloodType: 'A+' });

// PUT
await api.put(`/users/${id}`, userData);

// DELETE
await api.delete(`/orders/${id}`);

// Public endpoint (skip auth)
const stats = await api.get('/public/stats', { skipAuth: true });
```

## 🔐 Authentication

```typescript
const { user, isAuthenticated, login, logout } = useAuth();

// Login
const result = await login({ email, password });
if (result.success) {
  // Success - redirect handled automatically
} else {
  console.error(result.error);
}

// Logout
await logout(); // Clears auth and redirects to login

// Check auth status
if (isAuthenticated) {
  console.log('User:', user);
}
```

## 🔔 Toast Notifications

```typescript
const { success, error, warning, info } = useToast();

success('Operation completed!');
error('Something went wrong');
warning('Please be careful');
info('Here is some information');
```

## 🛡️ Protected Routes

```typescript
// app/dashboard/page.tsx
// Automatically protected by middleware
export default function Dashboard() {
  return <div>Protected Content</div>;
}
```

## 🔧 Configuration

```bash
# .env.local
NEXT_PUBLIC_API_URL=http://localhost:3001
```

## 📝 Backend Endpoints Required

```typescript
// Login
POST /auth/login
Body: { email: string, password: string }
Response: { access_token, refresh_token, user }

// Refresh
POST /auth/refresh
Body: { refreshToken: string }
Response: { access_token, refresh_token? }

// Logout
POST /auth/logout
Body: { userId: string }
Response: { message: string }

// Protected endpoints return 401 when token invalid
```

## 🧪 Testing

```bash
npm run test              # Run tests
npm run test:watch        # Watch mode
npm run type-check        # TypeScript check
npm run lint              # ESLint
```

## 🐛 Common Issues

### Token not refreshing
- Check refresh endpoint doesn't require auth
- Verify backend returns correct format

### Infinite redirect
- Check middleware matcher
- Verify auth state in sessionStorage

### Session not persisting
- Check browser privacy settings
- Verify sessionStorage is enabled

## 📊 Token Lifecycle

```
Login → Store Tokens → Make Request → 401? → Refresh → Retry
                                        ↓
                                    Success → Return Data
```

## 🔒 Security Checklist

- [x] sessionStorage (not localStorage)
- [x] Short-lived access tokens (15 min)
- [x] Long-lived refresh tokens (7 days)
- [x] No tokens in URLs
- [x] Server-side route protection
- [ ] httpOnly cookies (backend)
- [ ] Token rotation (backend)
- [ ] Rate limiting (backend)

## 📚 Documentation

- **Setup**: SETUP_AUTH.md
- **Implementation**: ../../AUTHENTICATION_IMPLEMENTATION.md
- **API**: lib/api/README.md
- **Security**: ../../SECURITY.md
- **Summary**: ../../AUTH_IMPLEMENTATION_SUMMARY.md

## 💡 Tips

1. Always use `api` client for HTTP requests
2. Use `useAuth` hook for auth operations
3. Protected routes work automatically
4. Toast notifications for user feedback
5. Check sessionStorage in DevTools

## 🎯 Key Features

- ✅ Automatic token refresh
- ✅ Request queue (no duplicate refreshes)
- ✅ Session management (sessionStorage)
- ✅ Route protection (middleware)
- ✅ Toast notifications
- ✅ TypeScript support
- ✅ Production ready

## 📞 Need Help?

1. Check troubleshooting in SETUP_AUTH.md
2. Review examples in test files
3. Check backend logs
4. Verify environment variables
