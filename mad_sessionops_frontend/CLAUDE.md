# Session-Ops Frontend — Claude Code Orientation

This file is read at the start of every Claude Code session. Read it in full before touching any code.

## What this repo is

The Next.js 16 frontend for Session-Ops. Backend lives in a separate repo: `mad-sessionops-backend`.

This repo is a thin UI over the backend API. It holds no business logic beyond presentation and input validation. All rules about schools, classes, sections, volunteers, and scheduling are enforced server-side — never re-implement them here.

## Stack

- Next.js 16 (App Router)
- React 19
- TypeScript strict mode
- Redux Toolkit + redux-persist
- MUI v6 (Material UI) with Emotion
- Axios with queued token refresh
- Google OAuth PKCE (frontend side)
- Zod for client-side schema validation
- Vitest (or Jest, see package.json) for tests

## Where to find what

For system-level context — business rules, data model, RBAC, glossary — read docs from the **backend repo**. The assumption is that both repos are checked out side by side:workspace/
├── mad-sessionops-backend/
│ └── docs/ ← system docs live here
└── mad-sessionops-frontend/
└── docs/ ← frontend-specific docs only

| If you are working on…     | Read first                                                                                                                   |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Any task                   | This file + `docs/FRONTEND_ARCHITECTURE.md`                                                                                  |
| Business rules             | `../mad-sessionops-backend/docs/BUSINESS_RULES.md`                                                                           |
| Domain terms               | `../mad-sessionops-backend/docs/GLOSSARY.md`                                                                                 |
| API shape / auth flow      | `../mad-sessionops-backend/docs/ARCHITECTURE.md` + `../mad-sessionops-backend/docs/API_CONVENTIONS.md` (when Sprint 2 lands) |
| "Why was this chosen"      | `docs/FRONTEND_DECISIONS.md` + `../mad-sessionops-backend/docs/DECISIONS.md`                                                 |
| "What's done, what's next" | `../mad-sessionops-backend/docs/PROGRESS.md`                                                                                 |
| A specific feature         | `../mad-sessionops-backend/docs/features/FXX-*.md`                                                                           |

If the backend repo is not checked out alongside, ask the human before proceeding. Working blind on system rules causes the worst bugs.

## Repo layoutmad-sessionops-frontend/

├── CLAUDE.md ← you are here
├── README.md ← human-facing setup
├── package.json
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs ← only one PostCSS config — do not add .json
├── proxy.ts ← route guards (NOT middleware.ts — Next.js 16 convention)
├── app/
│ ├── layout.tsx ← root layout, theme provider, redux provider
│ ├── page.tsx ← redirects to /schools
│ ├── login/
│ ├── auth/callback/
│ ├── schools/ ← main authenticated routes
│ └── admin/
├── components/ ← reusable UI
├── lib/
│ ├── api/ ← Axios client, interceptors, typed API functions
│ ├── redux/
│ │ ├── store.ts
│ │ ├── persistConfig.ts ← SSR-safe storage fallback
│ │ └── features/
│ │ └── auth/ ← auth slice (single source of truth for token)
│ └── auth/ ← PKCE helpers
├── docs/ ← frontend-specific docs
└── public/

## Non-negotiable rules

1. **No business logic in the frontend.** Max-5-children, 1-volunteer-per-school, slot overlap rules — none of these are re-implemented client-side. If the user action would violate a rule, the backend returns a 400/409 and the frontend displays the error.

   Exception: input shape validation (required fields, phone format, valid email) via Zod schemas is fine and encouraged — that's UX, not business rules.

2. **No localStorage access except through redux-persist.** The auth token lives in two places: Redux (in-memory + persisted via redux-persist) and an `access_token` cookie (for the `proxy.ts` guard). No other code path writes to localStorage. No `tokenUtils`-style wrapper.

3. **Never import from `@mui/material` root.** Always import from the specific subpath: `import Button from '@mui/material/Button'`. This is for tree-shaking — barrel imports pull the entire library into the bundle.

4. **No fetch calls outside `lib/api/`.** All network calls go through the shared Axios instance so the refresh interceptor and auth headers apply. Direct `fetch()` calls bypass both.

5. **Server components by default, client components when necessary.** Use `'use client'` only when a file needs state, effects, browser APIs, or event handlers. Most route pages can stay server components; interactive panels below them go client.

6. **Route protection is in `proxy.ts`, not in pages.** Don't add "if not authenticated, redirect" logic to individual pages. The proxy handles it globally. Pages assume the user is authenticated.

7. **RBAC display is the frontend's job; enforcement is the backend's.** Hide buttons and panels the current user can't use — but also expect the backend to reject the action if the user somehow triggers it anyway. Never trust a role check done only on the client.

## Architectural patterns to follow

- **One Axios instance, exported from `lib/api/client.ts`.** All typed API functions import it.
- **Error envelope from backend is `{error: {code, message, details?}}`.** Interceptor maps this to a thrown typed error that components catch.
- **Loading and error states are explicit.** No "if data, render, else null" — always show a skeleton or error boundary.
- **Forms use React Hook Form + Zod resolvers.** No custom form state.
- **MUI theme tokens are the source for colors, spacing, typography.** Never hardcode hex codes or pixel values in components.

## Commands

```bashnpm install              # install deps
npm run dev              # start dev server
npm run build            # production build
npm run lint             # ESLint + TypeScript check
npm run format           # Prettier
npm run test             # unit tests

Full dev setup is in `README.md`.

## Next.js 16 quirks to know

1. **`middleware.ts` is now `proxy.ts`.** The exported function must be named `proxy`, not `middleware`. Build fails with a specific error message if you get this wrong.
2. **React 19 is the runtime.** Some older libraries (MUI v5, old `@types/react`) are incompatible. Stay on MUI v6 + React 19 types.
3. **Server components are default.** Client components need `'use client'` at the top. Don't sprinkle it — be deliberate.
4. **App Router, not Pages Router.** Routes live in `app/`, not `pages/`. Layouts nest via directory structure.

## Rules for modifying docs

- Changing a decision (library, pattern) → add entry to `docs/FRONTEND_DECISIONS.md`
- Changing system architecture → that's in the backend repo's `docs/ARCHITECTURE.md`, update there
- Completing a user story → update `../mad-sessionops-backend/docs/PROGRESS.md`

## Before you start coding

1. You have read this file.
2. You have read `docs/FRONTEND_ARCHITECTURE.md`.
3. For anything touching business logic or data, you have read the relevant backend docs (at minimum `BUSINESS_RULES.md` and `GLOSSARY.md`).
4. You know which user story this maps to.
5. You have a plan to verify the change (visual check, component test, or manual flow).

If any of those is false, stop and clarify.
```
