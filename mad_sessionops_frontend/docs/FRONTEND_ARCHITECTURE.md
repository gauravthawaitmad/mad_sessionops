# Frontend Architecture

How this Next.js app is put together. Read before any task that touches routing, state, auth, or API calls.

## Big picture

The frontend is a single-page-ish application using Next.js App Router. It authenticates via Google OAuth PKCE, stores a JWT pair issued by the backend, and calls the backend API for everything else. It holds no domain state that isn't derived from backend responses.┌─────────────────────────────────────────────────────────┐
│ Next.js 16 app │
│ │
│ ┌───────────┐ ┌───────────┐ ┌───────────────────┐ │
│ │ proxy.ts │ │ app/ │ │ components/ │ │
│ │ (route │──▶│ (routes) │──▶│ (UI primitives) │ │
│ │ guard) │ │ │ │ │ │
│ └───────────┘ └─────┬─────┘ └───────────────────┘ │
│ │ │
│ ▼ │
│ ┌────────────────┐ │
│ │ lib/redux/ │ │
│ │ (auth, ui) │ │
│ └────────┬───────┘ │
│ │ │
│ ▼ │
│ ┌────────────────┐ │
│ │ lib/api/ │ ───────▶ backend API │
│ │ (Axios + │ │
│ │ interceptor) │ │
│ └────────────────┘ │
└─────────────────────────────────────────────────────────┘

## Routing

App Router with file-based routing. Route protection is a single layer in `proxy.ts` at the project root.

### Public routes

- `/login` — Google sign-in page
- `/auth/callback` — OAuth return URL
- `/_next/*`, `/favicon.ico`, static assets — Next.js internals

Everything else is protected.

### Protected routes (authenticated users only)

- `/` — redirects to `/schools`
- `/schools` — school list
- `/schools/[id]` — school detail, with nested panels for classes, sections, volunteers, slots
- `/admin/*` — admin-only (sync dashboard, year progression) — role check happens at the page level, in addition to auth check

### How `proxy.ts` worksIncoming request

↓
Is path in PUBLIC_ROUTES? → yes → let through
↓ no
Read access_token from cookies
↓
Cookie present?
├─ no → redirect to /login?next=<original path>
└─ yes → let through (do NOT validate expiry here —
let the Axios interceptor handle refresh when
API calls fail)

Deliberate design: the proxy is optimistic. It doesn't decode or validate the token — it just checks presence. Expiry is handled on the first API call via the Axios refresh interceptor. This keeps the proxy fast and stateless.

## State management

Redux Toolkit with redux-persist. Two slices to start; more added per feature.

### Auth slice (`lib/redux/features/auth/`)

Single source of truth for:

- `accessToken` (in-memory + persisted)
- `refreshToken` (in-memory + persisted)
- `user` (profile: id, email, name, role, etc.)
- `isAuthenticated` (derived)

Actions:

- `loginSucceeded(tokens, user)` — called after OAuth exchange
- `tokenRefreshed(newAccessToken)` — called by Axios interceptor
- `loggedOut()` — clears slice, clears cookie, (future) calls backend blacklist

### SSR-safe storage

redux-persist touches `localStorage` at module load, which crashes in Next.js server rendering. The persist config uses a `createNoopStorage` fallback when `window` is undefined:const storage = typeof window !== 'undefined'
? require('redux-persist/lib/storage').default
: createNoopStorage();

On server: noop storage, no crash, store initializes empty.
On client hydration: real localStorage takes over, state rehydrates.

**Do not remove this pattern.** Future sprints will add more persisted slices; they all must go through this config.

### The cookie + Redux dual storage (deliberate)

The access token lives in two places, and this is intentional:

| Where                 | Why                                                          |
| --------------------- | ------------------------------------------------------------ |
| Redux (persisted)     | API calls read from here via the Axios interceptor           |
| `access_token` cookie | `proxy.ts` reads from here (proxies can't read localStorage) |

Both are updated together:

- On login: set Redux + set cookie
- On refresh (Axios interceptor): update Redux + update cookie
- On logout: clear Redux + expire cookie

**Do not add a third storage location.** Specifically: no `tokenUtils` wrapper, no separate `localStorage.setItem('token', ...)`. That was a Sprint 0 bug.

The refresh token lives only in Redux-persist. It doesn't need to be in a cookie because no server-side component needs to read it.

## API layer

### Single Axios instance

`lib/api/client.ts` exports one Axios instance. Every typed API function imports it. No other file calls `fetch()` or creates another Axios instance.

Two interceptors:

**Request interceptor** — attaches `Authorization: Bearer <accessToken>` from Redux store.

**Response interceptor** — handles token refresh on 401:Request → 401 response
↓
Already refreshing?
├─ yes → queue this request, wait for refresh to complete, retry
└─ no → start refresh:

1. Mark refreshing=true
2. POST /api/auth/refresh with refresh token
3. On success: dispatch tokenRefreshed, update cookie,
   retry original + all queued requests
4. On failure: dispatch loggedOut, redirect to /login
5. Mark refreshing=false

This queue prevents the "N requests hit 401 at once, all trigger refresh, race condition" problem. One refresh call, queued retries.

### Typed API functions

Per-domain folders: `lib/api/schools.ts`, `lib/api/volunteers.ts`, etc. Each exports typed async functions:

```tsexport async function getSchools(): Promise<School[]> {
const { data } = await client.get<School[]>('/api/schools');
return data;
}

Types mirror backend Pydantic schemas. When a backend schema changes, the frontend type changes in the same PR cycle. If we add code generation later (from OpenAPI), these hand-written types get replaced — but until then, they're the contract.

### Error handling

Backend errors follow: `{error: {code: string, message: string, details?: object}}`.

The response interceptor maps this to a thrown typed error. Components catch and display:

- `AuthenticationError` → redirect to login
- `PermissionDenied` → show "not authorized" toast
- `ValidationError` → show field errors via form library
- `ConflictError` → show specific message (e.g., "Section already has 5 children")
- `NotFound` → show "not found" page or inline message
- `NetworkError` → show "connection lost" toast + retry option

## Components

### Structure

- `components/ui/` — primitives: Button, Input, Dialog wrappers around MUI with our theme
- `components/layout/` — shells: AppBar, Sidebar, PageHeader
- `components/schools/` — feature components for schools
- `components/volunteers/` — etc.

Feature components live under their feature, not in a shared `components/` dump. If a component is used by 3+ features, promote it to `components/ui/`.

### Client vs server components

- **Server by default.** Route page files (`app/schools/page.tsx`) are server components when possible — they fetch data and pass it to client children.
- **Client when needed.** Files with `'use client'` at the top. Mark for: state, effects, browser APIs, MUI components that use context.
- **MUI note:** most MUI components require client context because of theming. A page that renders MUI components directly usually needs to be a client component or delegate MUI rendering to a client child.

Rule of thumb: the route page is a server component that renders a single top-level client component, which handles all the interactive UI. This pattern keeps the initial HTML fast while allowing rich client-side behavior.

## Forms

React Hook Form + Zod resolvers. No custom form state.

The Zod schema is **client-side UX validation only.** The authoritative validation is on the backend (Pydantic + service layer). The frontend shows errors faster; the backend is the source of truth.

When backend returns a 400 with field errors, the form maps them back to field-level errors via RHF's `setError`.

## Theming

MUI v6 with a custom theme. Theme tokens (colors, spacing, typography, breakpoints) are defined in `lib/theme.ts`. Components consume via `sx` prop or `styled()`.

**Rules:**
- Colors: use `theme.palette.*` — never hardcode hex
- Spacing: use `theme.spacing(n)` or `sx={{ p: 2 }}` — never hardcode pixels
- Typography: use `theme.typography.*` variants — never hardcode font sizes

When a design reference (Figma, prototype) specifies a color or size that isn't in the theme, **add it to the theme first, then use it.** This keeps the theme authoritative.

## Testing

To be fleshed out in Sprint 2 as the first real components land. Outline:

- **Component tests** with Vitest/React Testing Library — render, interact, assert. No snapshot tests.
- **API client tests** — mock Axios, verify interceptor behavior (especially the refresh queue).
- **No E2E in this repo** — if/when Playwright comes, it goes in a separate repo or a top-level folder, not inside either product repo.

## Build and deploy

Build: `npm run build`. Output: `.next/`.

Deploy target for production is TBD. Likely candidates: Vercel (zero-config Next.js), or a Node process on the same EC2 as the backend behind nginx. Decision deferred to Sprint 8.

## What this architecture is NOT

- **Not a hybrid SSR-data-fetching app.** We don't use Next.js server components for fetching backend data on every page. Data fetches happen client-side via Axios because auth tokens live client-side. Server components render the shell; client components fetch.
- **Not GraphQL.** Backend is REST-ish via Ninja. If GraphQL happens, it's a decision for another day.
- **Not a PWA.** No service worker, no offline support, no install prompt. This is an internal staff tool.
- **Not i18n'd.** English only for v1. If Hindi (or other) translations happen, add `next-intl` later.
```
