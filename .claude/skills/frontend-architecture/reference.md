# Frontend Reference

## Project Structure

```
mad_sessionops_frontend/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # Root: ThemeProvider, ReduxProvider
│   ├── page.tsx                # Home → redirects to /schools
│   ├── login/                  # Login page
│   ├── auth/callback/          # OAuth callback handler
│   ├── forgot-password/        # Password reset request
│   ├── set-password/           # Initial password setup
│   ├── reset-password/         # Password reset form
│   └── schools/                # Main authenticated routes
│       ├── page.tsx            # School list
│       └── [id]/              # School detail (tabs)
├── components/                 # Reusable UI components
│   ├── common/                 # Shared across features
│   └── {feature}/             # Feature-specific
├── lib/
│   ├── api/                    # Axios client + typed API functions
│   │   ├── client.ts          # Shared Axios instance
│   │   ├── types.ts           # API response types
│   │   └── {feature}.ts      # Feature-specific API functions
│   ├── redux/
│   │   ├── store.ts           # Store configuration
│   │   ├── persistConfig.ts   # SSR-safe persistence
│   │   └── features/auth/     # Auth slice
│   ├── auth/                   # PKCE helpers
│   └── utils/                  # Helper functions
├── hooks/                      # Custom React hooks
├── config/                     # App configuration
├── public/                     # Static assets
└── docs/                       # Frontend-specific docs
```

## Adding a New Feature

When building a new feature (e.g., "children"):

1. **API layer**: `lib/api/children.ts` — typed API functions
2. **Types**: Add types to `lib/api/types.ts` or feature-specific file
3. **Components**: `components/children/` — UI components
4. **Pages**: `app/schools/[id]/children/` — route pages
5. **Tests**: `components/children/__tests__/` — co-located tests

## Route Protection

All route protection is in `proxy.ts` (Next.js 16 convention):

```typescript
// proxy.ts
export function proxy(request: Request) {
  // Check auth cookie
  // Redirect unauthenticated to /login
  // Redirect authenticated away from /login
}
```

Individual pages do NOT check auth. They assume the user is authenticated.

## Environment Variables

```
NEXT_PUBLIC_API_BASE_URL       # Backend URL (required)
NEXT_PUBLIC_GOOGLE_CLIENT_ID   # Google OAuth client ID
NODE_ENV                        # development | staging | production
```

Files:
- `.env` — defaults
- `.env.development` — dev overrides
- `.env.staging` — staging config
- `.env.production` — production config
- `.env.local` — local overrides (gitignored)

## Testing Conventions

- **Framework**: Vitest + React Testing Library
- **Location**: Co-located `__tests__/` directories
- **Naming**: `{Component}.test.tsx`
- **Focus**: User interaction, not implementation details

```tsx
// components/schools/__tests__/SchoolList.test.tsx
import { render, screen } from '@testing-library/react';
import { SchoolList } from '../SchoolList';

describe('SchoolList', () => {
  it('shows loading state initially', () => {
    render(<SchoolList />);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('displays schools after loading', async () => {
    // Mock API, render, assert
  });
});
```

## TypeScript Configuration

- Strict mode enabled
- Path alias: `@/*` → `./`
- Target: ES2017
- Module resolution: bundler

```tsx
// Use path aliases:
import { schoolsApi } from '@/lib/api/schools';
import { PageHeader } from '@/components/common/PageHeader';
```

## Key Decisions (from FRONTEND_DECISIONS.md)

- Redux for auth state only (not global state for everything)
- MUI v6 for component library (not Shadcn — different from dalgo)
- Axios over fetch (for interceptor ecosystem)
- Zod for validation (not Yup)
- Vitest over Jest (faster, ESM-native)
- `proxy.ts` for route guards (Next.js 16 specific)
