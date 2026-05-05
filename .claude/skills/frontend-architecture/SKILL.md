# Frontend Architecture Skill

Session-Ops frontend: Next.js 16 + React 19 + TypeScript + MUI v6 + Redux Toolkit.

## Architecture

Thin UI over the backend API. No business logic — only presentation and input validation.

## Key Files

| File | Purpose |
|------|---------|
| `proxy.ts` | Route protection (NOT middleware.ts) |
| `app/layout.tsx` | Root layout, providers |
| `lib/api/client.ts` | Axios instance + interceptors |
| `lib/redux/store.ts` | Redux store config |
| `lib/redux/features/auth/` | Auth slice (token source of truth) |

## Patterns

See `patterns.md` for component and state management patterns.
See `reference.md` for project structure and conventions.

## Conventions

- Server components by default, `'use client'` only when needed
- All API calls through `lib/api/client.ts` (never raw `fetch`)
- MUI imports from subpaths (`@mui/material/Button`, not `@mui/material`)
- Auth state in Redux only (no localStorage except via redux-persist)
- Forms: React Hook Form + Zod resolvers
- Route protection in `proxy.ts`, not in individual pages
- Error/loading states are always explicit (skeleton or error boundary)
