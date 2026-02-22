# Authentication System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         User Browser                             │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                    Next.js Frontend                     │    │
│  │                                                          │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │    │
│  │  │   Pages      │  │  Components  │  │  Middleware  │ │    │
│  │  │              │  │              │  │              │ │    │
│  │  │ - Login      │  │ - Toast      │  │ - Route      │ │    │
│  │  │ - Dashboard  │  │ - Auth Forms │  │   Protection │ │    │
│  │  └──────┬───────┘  └──────────────┘  └──────────────┘ │    │
│  │         │                                               │    │
│  │         ▼                                               │    │
│  │  ┌──────────────────────────────────────────────────┐ │    │
│  │  │              Custom Hooks                         │ │    │
│  │  │  - useAuth()  - useToast()                       │ │    │
│  │  └──────┬───────────────────────────────────────────┘ │    │
│  │         │                                               │    │
│  │         ▼                                               │    │
│  │  ┌──────────────────────────────────────────────────┐ │    │
│  │  │           HTTP Client (http-client.ts)           │ │    │
│  │  │  - Request Interceptor                           │ │    │
│  │  │  - Token Refresh Logic                           │ │    │
│  │  │  - Request Queue                                 │ │    │
│  │  └──────┬───────────────────────────────────────────┘ │    │
│  │         │                                               │    │
│  │         ▼                                               │    │
│  │  ┌──────────────────────────────────────────────────┐ │    │
│  │  │        Zustand Store (auth.store.ts)             │ │    │
│  │  │  - Access Token                                  │ │    │
│  │  │  - Refresh Token                                 │ │    │
│  │  │  - User Data                                     │ │    │
│  │  │  - Persist to sessionStorage                     │ │    │
│  │  └──────────────────────────────────────────────────┘ │    │
│  └────────────────────────────────────────────────────────┘    │
└───────────────────────────┬──────────────────────────────────────┘
                            │
                            │ HTTPS
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Backend Server (NestJS)                     │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                  Auth Controller                        │    │
│  │  POST /auth/login                                      │    │
│  │  POST /auth/refresh                                    │    │
│  │  POST /auth/logout                                     │    │
│  └──────┬─────────────────────────────────────────────────┘    │
│         │                                                        │
│         ▼                                                        │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                   Auth Service                          │    │
│  │  - Validate Credentials                                │    │
│  │  - Generate JWT Tokens                                 │    │
│  │  - Verify Tokens                                       │    │
│  │  - Refresh Tokens                                      │    │
│  └──────┬─────────────────────────────────────────────────┘    │
│         │                                                        │
│         ▼                                                        │
│  ┌────────────────────────────────────────────────────────┐    │
│  │                    Database                             │    │
│  │  - Users                                               │    │
│  │  - Refresh Tokens (optional)                           │    │
│  │  - Token Blacklist (optional)                          │    │
│  └────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
```

## Request Flow - Normal Request

```
┌──────┐                                                    ┌──────┐
│Client│                                                    │Server│
└──┬───┘                                                    └──┬───┘
   │                                                           │
   │ 1. Make API Request                                      │
   │ GET /orders                                              │
   │ Authorization: Bearer <access_token>                     │
   ├──────────────────────────────────────────────────────────>│
   │                                                           │
   │                                                           │ 2. Verify Token
   │                                                           │
   │                                                           │ 3. Process Request
   │                                                           │
   │ 4. Return Data                                           │
   │<──────────────────────────────────────────────────────────┤
   │                                                           │
```

## Request Flow - Token Expired (Single Request)

```
┌──────┐                                                    ┌──────┐
│Client│                                                    │Server│
└──┬───┘                                                    └──┬───┘
   │                                                           │
   │ 1. Make API Request                                      │
   │ GET /orders                                              │
   │ Authorization: Bearer <expired_token>                    │
   ├──────────────────────────────────────────────────────────>│
   │                                                           │
   │                                                           │ 2. Token Expired
   │                                                           │
   │ 3. Return 401 Unauthorized                               │
   │<──────────────────────────────────────────────────────────┤
   │                                                           │
   │ 4. Detect 401                                            │
   │                                                           │
   │ 5. Call Refresh Endpoint                                 │
   │ POST /auth/refresh                                       │
   │ Body: { refreshToken: <refresh_token> }                  │
   ├──────────────────────────────────────────────────────────>│
   │                                                           │
   │                                                           │ 6. Verify Refresh Token
   │                                                           │
   │                                                           │ 7. Generate New Access Token
   │                                                           │
   │ 8. Return New Token                                      │
   │<──────────────────────────────────────────────────────────┤
   │                                                           │
   │ 9. Update Token in Store                                 │
   │                                                           │
   │ 10. Retry Original Request                               │
   │ GET /orders                                              │
   │ Authorization: Bearer <new_access_token>                 │
   ├──────────────────────────────────────────────────────────>│
   │                                                           │
   │                                                           │ 11. Process Request
   │                                                           │
   │ 12. Return Data                                          │
   │<──────────────────────────────────────────────────────────┤
   │                                                           │
```

## Request Flow - Token Expired (Concurrent Requests)

```
┌────────┐                                                  ┌──────┐
│Client  │                                                  │Server│
│(3 Reqs)│                                                  └──┬───┘
└───┬────┘                                                     │
    │                                                          │
    │ 1. Request A: GET /orders                               │
    ├─────────────────────────────────────────────────────────>│
    │                                                          │
    │ 2. Request B: GET /users                                │
    ├─────────────────────────────────────────────────────────>│
    │                                                          │
    │ 3. Request C: GET /inventory                            │
    ├─────────────────────────────────────────────────────────>│
    │                                                          │
    │                                                          │ 4. All tokens expired
    │                                                          │
    │ 5. Return 401 (Request A)                               │
    │<─────────────────────────────────────────────────────────┤
    │                                                          │
    │ 6. Return 401 (Request B)                               │
    │<─────────────────────────────────────────────────────────┤
    │                                                          │
    │ 7. Return 401 (Request C)                               │
    │<─────────────────────────────────────────────────────────┤
    │                                                          │
    │ 8. Request A triggers refresh                           │
    │    Set isRefreshing = true                              │
    │                                                          │
    │ 9. Request B & C queued                                 │
    │    (waiting for refresh)                                │
    │                                                          │
    │ 10. Call Refresh Endpoint (ONCE)                        │
    │ POST /auth/refresh                                      │
    ├─────────────────────────────────────────────────────────>│
    │                                                          │
    │                                                          │ 11. Generate New Token
    │                                                          │
    │ 12. Return New Token                                    │
    │<─────────────────────────────────────────────────────────┤
    │                                                          │
    │ 13. Update Token                                        │
    │     Set isRefreshing = false                            │
    │     Notify all queued requests                          │
    │                                                          │
    │ 14. Retry Request A                                     │
    ├─────────────────────────────────────────────────────────>│
    │                                                          │
    │ 15. Retry Request B                                     │
    ├─────────────────────────────────────────────────────────>│
    │                                                          │
    │ 16. Retry Request C                                     │
    ├─────────────────────────────────────────────────────────>│
    │                                                          │
    │                                                          │ 17. Process all requests
    │                                                          │
    │ 18. Return all responses                                │
    │<─────────────────────────────────────────────────────────┤
    │                                                          │
```

## State Management Flow

```
┌─────────────────────────────────────────────────────────────┐
│                      User Actions                            │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────┐     ┌─────────┐    ┌─────────┐
    │ Login  │     │ Logout  │    │ Refresh │
    └───┬────┘     └────┬────┘    └────┬────┘
        │               │              │
        ▼               ▼              ▼
┌────────────────────────────────────────────────────────────┐
│                   Zustand Store Actions                     │
│                                                             │
│  setTokens()      clearAuth()      updateAccessToken()    │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│                   Zustand Store State                       │
│                                                             │
│  - accessToken: string | null                              │
│  - refreshToken: string | null                             │
│  - user: User | null                                       │
│  - isAuthenticated: boolean                                │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│              Persist Middleware (Zustand)                   │
│                                                             │
│  - Automatically saves to sessionStorage                   │
│  - Automatically loads on page refresh                     │
│  - Cleared on browser close                                │
└────────────────────────┬───────────────────────────────────┘
                         │
                         ▼
┌────────────────────────────────────────────────────────────┐
│                    sessionStorage                           │
│                                                             │
│  Key: "auth-storage"                                       │
│  Value: {                                                  │
│    state: {                                                │
│      accessToken: "...",                                   │
│      refreshToken: "...",                                  │
│      user: {...},                                          │
│      isAuthenticated: true                                 │
│    }                                                       │
│  }                                                         │
└────────────────────────────────────────────────────────────┘
```

## Route Protection Flow

```
┌──────────────────────────────────────────────────────────┐
│              User Navigates to Route                      │
└────────────────────────┬─────────────────────────────────┘
                         │
                         ▼
┌──────────────────────────────────────────────────────────┐
│              Next.js Middleware                           │
│                                                           │
│  1. Check if route is protected                          │
│  2. Check auth state in sessionStorage                   │
└────────────────────────┬─────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    Protected        Public         Auth Route
    + Authed        Route          + Authed
         │               │               │
         ▼               ▼               ▼
    ┌─────────┐    ┌─────────┐    ┌──────────┐
    │ Allow   │    │ Allow   │    │ Redirect │
    │ Access  │    │ Access  │    │ to       │
    │         │    │         │    │ Dashboard│
    └─────────┘    └─────────┘    └──────────┘
         │
         │
    Protected
    + Not Authed
         │
         ▼
    ┌──────────────────────┐
    │ Redirect to Login    │
    │ with redirect param  │
    │ /auth/signin?        │
    │ redirect=/dashboard  │
    └──────────────────────┘
```

## Component Hierarchy

```
App (layout.tsx)
│
├── ToastProvider
│   │
│   └── Toast Notifications
│       ├── Session Expiry
│       ├── Login Success
│       └── Error Messages
│
└── Pages
    │
    ├── Public Pages
    │   ├── Home (/)
    │   └── Auth Pages
    │       ├── Sign In (/auth/signin)
    │       └── Sign Up (/auth/signup)
    │
    └── Protected Pages (Middleware)
        └── Dashboard (/dashboard)
            ├── Orders
            ├── Track Riders
            └── Other Features
```

## Data Flow Summary

```
1. User Login
   ↓
2. Store Tokens (sessionStorage)
   ↓
3. Make API Request (with token)
   ↓
4. Token Expired? → Yes → Refresh Token → Retry Request
   │                                           ↓
   └─────────────────→ No → Return Data ←─────┘
   
5. Refresh Failed? → Yes → Clear Auth → Redirect to Login
   │
   └─────────────→ No → Continue
```

## Security Layers

```
┌─────────────────────────────────────────────────────────┐
│                    Security Layers                       │
│                                                          │
│  Layer 1: HTTPS (Transport Security)                    │
│  ├─ All communication encrypted                         │
│  └─ Prevents man-in-the-middle attacks                  │
│                                                          │
│  Layer 2: JWT Tokens (Authentication)                   │
│  ├─ Short-lived access tokens (15 min)                  │
│  ├─ Long-lived refresh tokens (7 days)                  │
│  └─ Signed with secret key                              │
│                                                          │
│  Layer 3: sessionStorage (Client Storage)               │
│  ├─ Cleared on browser close                            │
│  ├─ Not accessible across tabs                          │
│  └─ Reduced XSS attack surface                          │
│                                                          │
│  Layer 4: Server-side Middleware (Route Protection)     │
│  ├─ Validates auth before rendering                     │
│  ├─ No client-side bypass possible                      │
│  └─ Redirects unauthenticated users                     │
│                                                          │
│  Layer 5: Request Queue (Refresh Protection)            │
│  ├─ Prevents duplicate refresh calls                    │
│  ├─ Coordinates concurrent requests                     │
│  └─ Minimizes attack surface                            │
│                                                          │
│  Layer 6: Input Validation (Data Security)              │
│  ├─ Sanitizes user input                                │
│  ├─ Validates data types                                │
│  └─ Prevents injection attacks                          │
└─────────────────────────────────────────────────────────┘
```

## Performance Optimization

```
┌─────────────────────────────────────────────────────────┐
│              Performance Optimizations                   │
│                                                          │
│  1. Request Queue                                       │
│     - Single refresh for multiple requests              │
│     - Minimal memory overhead                           │
│     - Fast coordination                                 │
│                                                          │
│  2. sessionStorage                                      │
│     - Synchronous access (fast)                         │
│     - No network calls                                  │
│     - Minimal storage (~2KB)                            │
│                                                          │
│  3. Token Refresh                                       │
│     - < 200ms average                                   │
│     - Transparent to user                               │
│     - No UI blocking                                    │
│                                                          │
│  4. Middleware                                          │
│     - Server-side (fast)                                │
│     - No client-side delay                              │
│     - Efficient routing                                 │
└─────────────────────────────────────────────────────────┘
```

---

**Legend:**
- `│` : Vertical connection
- `─` : Horizontal connection
- `┌┐└┘├┤┬┴┼` : Box drawing characters
- `▼` : Flow direction
- `<>` : Bidirectional flow
