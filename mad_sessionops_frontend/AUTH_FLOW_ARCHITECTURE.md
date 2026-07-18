# Authentication Flow Architecture

## Complete Connection Map: Components → Redux → API Services → Backend

---

## 📊 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE LAYER                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌─────────────────┐  │
│  │  LoginForm.tsx   │  │ GoogleLogin      │  │ RegisterForm    │  │
│  │  /login          │  │ Button.tsx       │  │ /register       │  │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬────────┘  │
│           │                     │                      │            │
│           │ dispatch(          │ OAuth Flow           │ dispatch(  │
│           │ loginUser())       │                      │ registerUser())
│           │                     │                      │            │
└───────────┼─────────────────────┼──────────────────────┼────────────┘
            │                     │                      │
            ↓                     ↓                      ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         REDUX LAYER (State Management)               │
├─────────────────────────────────────────────────────────────────────┤
│                     lib/redux/features/auth/authSlice.ts            │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ ASYNC THUNKS (Action Creators)                             │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │                                                             │    │
│  │  • loginUser(credentials)              ────────────┐       │    │
│  │    ├─ Calls: services.auth.login()                 │       │    │
│  │    └─ Saves tokens to localStorage                 │       │    │
│  │                                                     │       │    │
│  │  • loginWithGoogleOAuth(data)          ────────────┼───┐   │    │
│  │    ├─ Calls: services.auth.loginWithGoogleOAuth()  │   │   │    │
│  │    └─ Saves tokens to localStorage                 │   │   │    │
│  │                                                     │   │   │    │
│  │  • registerUser(data)                  ────────────┼───┼───┤   │
│  │    ├─ Calls: services.auth.register()              │   │   │   │
│  │    └─ Saves tokens to localStorage                 │   │   │   │
│  │                                                     │   │   │   │
│  │  • verifyToken()                       ────────────┼───┼───┼───┤
│  │    └─ Calls: services.auth.verifyToken()           │   │   │   │
│  │                                                     │   │   │   │
│  │  • refreshAccessToken()                ────────────┼───┼───┼───┤
│  │    └─ Calls: services.auth.refreshToken()          │   │   │   │
│  │                                                     │   │   │   │
│  │  • logoutUser()                        ────────────┼───┼───┼───┤
│  │    ├─ Calls: services.auth.logout()                │   │   │   │
│  │    └─ Clears tokens from localStorage              │   │   │   │
│  │                                                     │   │   │   │
│  └─────────────────────────────────────────────────────┼───┼───┼───┘
│                                                        │   │   │
│  ┌────────────────────────────────────────────────────┼───┼───┼───┐
│  │ SYNC ACTIONS (Direct State Updates)                │   │   │   │
│  ├────────────────────────────────────────────────────┤   │   │   │
│  │                                                     │   │   │   │
│  │  • loginSuccess({ user, accessToken, refreshToken })   │   │   │
│  │    └─ Used by OAuth callback to directly update state  │   │   │
│  │                                                     │   │   │   │
│  │  • updateActivity()                                │   │   │   │
│  │  • checkSessionTimeout()                           │   │   │   │
│  │  • clearError()                                    │   │   │   │
│  │  • setUser(user)                                   │   │   │   │
│  │                                                     │   │   │   │
│  └─────────────────────────────────────────────────────┘   │   │   │
│                                                            │   │   │
└────────────────────────────────────────────────────────────┼───┼───┼──┘
                                                            │   │   │
                                                            ↓   ↓   ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         API SERVICE LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│                   lib/api/services/auth.service.ts                  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐    │
│  │ AUTH SERVICE METHODS                                        │    │
│  ├────────────────────────────────────────────────────────────┤    │
│  │                                                             │    │
│  │  login(credentials)                                         │    │
│  │    POST /api/auth/login                                     │    │
│  │    ↓ Returns: { user, accessToken, refreshToken }          │    │
│  │                                                             │    │
│  │  loginWithGoogleOAuth({ code, codeVerifier, redirectUri }) │    │
│  │    POST /api/auth/google/oauth/callback                    │    │
│  │    ↓ Returns: { user, accessToken, refreshToken }          │    │
│  │                                                             │    │
│  │  register(data)                                             │    │
│  │    POST /api/auth/register                                  │    │
│  │    ↓ Returns: { user, accessToken, refreshToken }          │    │
│  │                                                             │    │
│  │  verifyToken()                                              │    │
│  │    POST /api/auth/verify-token                             │    │
│  │    ↓ Returns: { valid, user }                              │    │
│  │                                                             │    │
│  │  refreshToken(refreshToken)                                 │    │
│  │    POST /api/auth/refresh-token                            │    │
│  │    ↓ Returns: { accessToken, expiresIn }                   │    │
│  │                                                             │    │
│  │  logout()                                                   │    │
│  │    POST /api/auth/logout                                   │    │
│  │    ↓ Returns: void                                         │    │
│  │                                                             │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  All methods use: api.post() from lib/api/client.ts                │
│  • Adds Authorization header automatically                          │
│  • Handles errors globally                                          │
│  • Auto-refreshes expired tokens                                    │
│                                                                      │
└──────────────────────────────────┬───────────────────────────────────┘
                                   │
                                   ↓
┌─────────────────────────────────────────────────────────────────────┐
│                         BACKEND API LAYER                            │
├─────────────────────────────────────────────────────────────────────┤
│                    http://localhost:8000/api                        │
│                                                                      │
│  Endpoints (to be implemented by backend team):                     │
│                                                                      │
│  POST /auth/login                                                   │
│  POST /auth/register                                                │
│  POST /auth/google/oauth/callback  ← OAuth endpoint                │
│  POST /auth/verify-token                                            │
│  POST /auth/refresh-token                                           │
│  POST /auth/logout                                                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Complete Login Flow Example

### 1. Email/Password Login

```
User enters email + password
         ↓
[LoginForm.tsx]
  const { handleSubmit } = useLoginForm()
  handleSubmit(e) →
         ↓
[useLoginForm.ts]
  dispatch(loginUser(credentials))
         ↓
[authSlice.ts - loginUser thunk]
  → services.auth.login(credentials)
         ↓
[auth.service.ts]
  → api.post('/api/auth/login', credentials)
         ↓
[client.ts - axios interceptor]
  → Adds headers (X-Request-ID, timezone, etc.)
  → Sends HTTP POST request
         ↓
[BACKEND API]
  → Validates credentials
  → Returns { user, accessToken, refreshToken }
         ↓
[client.ts - response interceptor]
  → Logs response
  → Returns data
         ↓
[authSlice.ts - loginUser.fulfilled]
  → saveTokens(accessToken, refreshToken)
  → Updates Redux state:
    - state.user = user
    - state.accessToken = accessToken
    - state.refreshToken = refreshToken
    - state.isAuthenticated = true
    - state.isLoading = false
         ↓
[Redux Persist]
  → Saves to localStorage: persist:root
         ↓
[LoginForm.tsx]
  → Redirects to /dashboard
         ↓
User is logged in! ✅
```

---

## 🔐 Google OAuth Flow

### Step-by-Step

```
1. USER CLICKS "CONTINUE WITH GOOGLE"
   └─ [GoogleLoginButton.tsx]
      onClick → googleOAuthClient.initiateAuthFlow()

2. FRONTEND PREPARES OAUTH
   └─ [lib/auth/oauth/client.ts]
      • Generates PKCE challenge (code_verifier + code_challenge)
      • Generates state (CSRF protection)
      • Stores in sessionStorage
      • Redirects to Google

3. GOOGLE AUTHORIZATION
   └─ User logs in and authorizes
   └─ Google redirects to: /auth/callback/google?code=XXX&state=YYY

4. CALLBACK PAGE RECEIVES CODE
   └─ [app/auth/callback/google/page.tsx]
      • Validates state (CSRF check)
      • Retrieves code_verifier from sessionStorage
      • Calls backend with code + codeVerifier

5. CALL AUTH SERVICE
   └─ authService.loginWithGoogleOAuth({
        code,
        codeVerifier,
        redirectUri
      })

6. BACKEND EXCHANGES CODE
   └─ POST /api/auth/google/oauth/callback
      • Backend sends code to Google
      • Google returns access_token + id_token
      • Backend decodes id_token (user info)
      • Backend creates/updates user
      • Backend generates app tokens
      • Returns: { user, accessToken, refreshToken }

7. FRONTEND UPDATES STATE
   └─ dispatch(loginSuccess({
        user,
        accessToken,
        refreshToken
      }))

8. REDIRECT TO DASHBOARD
   └─ User is logged in! ✅
```

---

## 📝 Code Connections Table

| UI Component            | Redux Action           | Auth Service                         | Backend Endpoint                   |
| ----------------------- | ---------------------- | ------------------------------------ | ---------------------------------- |
| `LoginForm.tsx`         | `loginUser()`          | `authService.login()`                | `POST /auth/login`                 |
| `GoogleLoginButton.tsx` | `loginSuccess()`       | `authService.loginWithGoogleOAuth()` | `POST /auth/google/oauth/callback` |
| `RegisterForm.tsx`      | `registerUser()`       | `authService.register()`             | `POST /auth/register`              |
| -                       | `verifyToken()`        | `authService.verifyToken()`          | `POST /auth/verify-token`          |
| -                       | `refreshAccessToken()` | `authService.refreshToken()`         | `POST /auth/refresh-token`         |
| Logout Button           | `logoutUser()`         | `authService.logout()`               | `POST /auth/logout`                |

---

## 🎯 File Locations

### UI Components

```
components/auth/LoginForm/LoginForm.tsx
components/auth/common/GoogleLoginButton.tsx
components/auth/RegisterForm/ (to be created)
```

### Redux (State Management)

```
lib/redux/features/auth/authSlice.ts      ← Async thunks + reducers
lib/redux/features/auth/types.ts          ← TypeScript types
lib/redux/features/auth/tokenUtils.ts     ← Token storage helpers
lib/redux/store.ts                         ← Redux store config
lib/redux/persistConfig.ts                 ← Persistence config
```

### API Services

```
lib/api/services/auth.service.ts           ← Auth API methods
lib/api/client.ts                          ← Axios client + interceptors
```

### OAuth Implementation

```
lib/auth/oauth/client.ts                   ← OAuth client
lib/auth/oauth/config.ts                   ← OAuth config
lib/auth/oauth/pkce.ts                     ← PKCE implementation
lib/auth/oauth/storage.ts                  ← Session storage
app/auth/callback/google/page.tsx          ← OAuth callback page
```

---

## 🔑 Key Features

### ✅ Implemented in Frontend

1. **Token Management**
   - Stored in localStorage via Redux Persist
   - Automatically attached to API requests
   - Auto-refresh on 401 errors

2. **Error Handling**
   - Global error interceptor in API client
   - User-friendly error messages
   - Network error detection

3. **Security**
   - PKCE for OAuth
   - CSRF protection with state parameter
   - Secure token storage
   - Session timeout tracking

4. **State Management**
   - Redux Toolkit for predictable state
   - Redux Persist for session persistence
   - Activity tracking
   - Loading states

---

## 🚀 Usage Examples

### From Components

```typescript
// Login
import { useAppDispatch } from "@/lib/redux";
import { loginUser } from "@/lib/redux/features/auth/authSlice";

const dispatch = useAppDispatch();

const handleLogin = async () => {
  await dispatch(
    loginUser({
      email: "user@example.com",
      password: "password123",
    })
  );
};
```

```typescript
// Register
import { registerUser } from "@/lib/redux/features/auth/authSlice";

await dispatch(
  registerUser({
    name: "John Doe",
    email: "john@example.com",
    password: "password123",
    confirmPassword: "password123",
    acceptTerms: true,
  })
);
```

```typescript
// Logout
import { logoutUser } from "@/lib/redux/features/auth/authSlice";

await dispatch(logoutUser());
```

```typescript
// Check Auth State
import { useAppSelector } from "@/lib/redux";
import { selectIsAuthenticated, selectUser } from "@/lib/redux/features/auth/authSlice";

const isAuthenticated = useAppSelector(selectIsAuthenticated);
const user = useAppSelector(selectUser);
```

---

## 🔧 Error Handling Flow

```
API Request Error
      ↓
[client.ts - Response Interceptor]
      ↓
Categorizes Error:
  • 401 → Try refresh token
  • 403 → Forbidden
  • 404 → Not Found
  • 422 → Validation Error
  • 429 → Rate Limited
  • 500+ → Server Error
  • No Response → Network Error
      ↓
Returns Structured Error:
{
  code: 'NETWORK_ERROR',
  message: 'Network error...',
  status: 0
}
      ↓
[authSlice.ts - rejected case]
      ↓
Updates state.error
      ↓
[Component]
      ↓
Displays error to user
```

---

## 📊 State Structure

```typescript
// Redux auth state
{
  user: {
    id: string,
    email: string,
    name: string,
    avatar?: string,
    role: string,
    emailVerified: boolean
  } | null,

  isAuthenticated: boolean,
  isLoading: boolean,
  isInitialized: boolean,

  accessToken: string | null,
  refreshToken: string | null,

  error: string | null,
  lastActivity: number | null,
  sessionTimeout: number
}
```

---

## 🧪 Testing Checklist

### Frontend Ready ✅

- [x] Login form with validation
- [x] Google OAuth button
- [x] Redux actions connected to services
- [x] Error handling
- [x] Token storage
- [x] Auto token refresh
- [x] Session persistence

### Backend Needed ❌

- [ ] POST /auth/login endpoint
- [ ] POST /auth/register endpoint
- [ ] POST /auth/google/oauth/callback endpoint
- [ ] POST /auth/verify-token endpoint
- [ ] POST /auth/refresh-token endpoint
- [ ] POST /auth/logout endpoint

---

## 📚 Additional Resources

- [Redux Toolkit Documentation](https://redux-toolkit.js.org/)
- [Redux Persist Documentation](https://github.com/rt2zz/redux-persist)
- [Axios Interceptors](https://axios-http.com/docs/interceptors)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [PKCE RFC 7636](https://tools.ietf.org/html/rfc7636)
