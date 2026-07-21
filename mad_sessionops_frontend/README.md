# Session-Ops Frontend

Next.js 16 (App Router) frontend for Session-Ops, MAD's school operations platform. Talks to the Django backend in `../mad_sessionops_backend`; holds no business logic of its own — see that project's `docs/BUSINESS_RULES.md`.

Read `CLAUDE.md` in this directory before making changes — it has the full architecture rules (no business logic client-side, one Axios instance, MUI subpath imports only, etc.).

## Stack

- Next.js 16 (App Router), React 19, TypeScript (strict mode)
- Redux Toolkit + redux-persist
- MUI v6 (Emotion)
- Axios with queued token refresh
- Google OAuth (PKCE)
- Zod for input-shape validation
- Vitest + Testing Library

## Getting started

```bash
npm install
cp .env.development.example .env.development   # if present; otherwise ask a teammate for values
npm run dev
```

Open http://localhost:3000.

## Required environment variables

All frontend env vars are `NEXT_PUBLIC_*` (baked into the JS bundle at build time — see `config/env.config.ts`):

| Variable                                                                                    | Purpose                                    |
| ------------------------------------------------------------------------------------------- | ------------------------------------------ |
| `NEXT_PUBLIC_API_URL`                                                                       | Backend API base URL                       |
| `NEXT_PUBLIC_APP_URL`                                                                       | This app's own URL (OAuth redirects, etc.) |
| `NEXT_PUBLIC_APP_NAME`                                                                      | Required — build fails without it          |
| `NEXT_PUBLIC_APP_ENV`                                                                       | `development` / `staging` / `production`   |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID`                                                              | Google OAuth client ID                     |
| `NEXT_PUBLIC_ENABLE_ANALYTICS` / `NEXT_PUBLIC_ENABLE_DEBUG` / `NEXT_PUBLIC_ENABLE_MOCK_API` | Feature flags                              |
| `NEXT_PUBLIC_LOG_LEVEL`                                                                     | `debug` / `info` / `warn` / `error`        |
| `NEXT_PUBLIC_API_TIMEOUT`                                                                   | Axios request timeout (ms)                 |

## Scripts

```bash
npm run dev            # start dev server
npm run build           # production build
npm run lint             # ESLint
npm run lint:strict       # ESLint, zero warnings allowed (what CI runs)
npm run type-check        # tsc --noEmit
npm run format            # Prettier --write
npm run format:check      # Prettier --check (what CI runs)
npm run test              # vitest run
npm run test:watch        # vitest (watch mode)
npm run test:coverage     # vitest run --coverage
```

## Folder structure

```
app/                  ← routes (App Router) — schools/, admin/, login/, auth/callback/
components/           ← reusable UI
lib/
├── api/              ← Axios client, interceptors, typed API functions
├── redux/            ← store, persistConfig, feature slices (auth, etc.)
└── auth/             ← PKCE helpers
proxy.ts              ← route guards (Next.js 16's replacement for middleware.ts)
docs/                 ← frontend-specific docs
```

## Testing

Vitest + Testing Library, jsdom environment. Test files live under `__tests__/`, mirroring the `app/`/`components/`/`lib/` structure they cover. Coverage uses the v8 provider (`npm run test:coverage`); reports go to `coverage/` (gitignored) as `text` + `lcov` + `html`.

## Related docs

- `docs/FRONTEND_ARCHITECTURE.md` — this repo's architecture
- `../mad_sessionops_backend/docs/BUSINESS_RULES.md` — business rules (enforced server-side only)
- `../mad_sessionops_backend/docs/ARCHITECTURE.md`, `API_CONVENTIONS.md` — API shape, auth flow
- `../mad_sessionops_backend/docs/GLOSSARY.md` — domain terms
