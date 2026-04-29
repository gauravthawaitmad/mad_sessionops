# Frontend Decisions

Frontend-specific ADRs. System-wide decisions (Django Ninja, Postgres, JWT, PKCE, etc.) live in the backend repo at `../mad-sessionops-backend/docs/DECISIONS.md`.

Format: same as backend — ID, Date, Status, Context, Decision, Consequences, Alternatives.

---

## FD001 — Next.js 16 App Router over Pages Router

**Date:** Planning phase
**Status:** Accepted

**Context:** Choosing a Next.js routing model for a greenfield project in early 2026.

**Decision:** App Router (not Pages Router).

**Consequences:**
- Nested layouts, server components, streaming SSR available
- `proxy.ts` (not `middleware.ts`) for route guards per Next.js 16 naming
- Some third-party libs have weaker App Router integration — evaluated per-case
- Smaller ecosystem of tutorials than Pages Router, but the canonical one going forward

**Alternatives:**
- **Pages Router** — more mature, more examples. Rejected because App Router is the forward path and Pages Router is deprecated-in-spirit.

---

## FD002 — MUI v6 over Tailwind / shadcn / Chakra

**Date:** Planning phase; re-confirmed in Sprint 0
**Status:** Accepted

**Context:** Component library for a staff-facing operations tool. Needs good defaults, accessibility, and a path to consistent design without designing from scratch.

**Decision:** MUI v6 with Emotion.

**Consequences:**
- Accessibility built in on most components
- React 19 compatible (v5 was not — forced the upgrade in Sprint 0)
- Larger bundle than Tailwind alternatives
- Grid v2 API differs from v1 — code follows v2
- Theming via `theme.palette`, `theme.spacing`, etc. — enforced throughout

**Alternatives:**
- **Tailwind + shadcn/ui** — smaller bundle, more control, but copy-in model increases maintenance and MAD's design language leans Material. Rejected.
- **Chakra UI** — nice API, smaller ecosystem and slower on React 19. Rejected.
- **Ant Design** — heavier, very opinionated look. Rejected.

---

## FD003 — Redux Toolkit + redux-persist over Zustand / React Context

**Date:** Planning phase
**Status:** Accepted

**Context:** Client state management for auth, user profile, cached lists. Need persistence for decent reload UX.

**Decision:** Redux Toolkit with redux-persist and a SSR-safe storage fallback.

**Consequences:**
- Great devtools, predictable patterns
- More boilerplate than Zustand
- SSR gotcha: redux-persist crashes without a storage fallback (see FD005)
- Team familiarity wins over novelty

**Alternatives:**
- **Zustand** — cleaner API, less ceremony. Rejected because team familiarity with Redux outweighs boilerplate costs.
- **React Context only** — works for auth but weak for data caching. Rejected.
- **TanStack Query (React Query) alone** — great for server state, but we also need client-only state like UI preferences. Could add later alongside Redux, not instead of.

---

## FD004 — Axios with queued token-refresh interceptor

**Date:** Planning phase
**Status:** Accepted

**Context:** JWT access tokens are short-lived. When they expire mid-session, multiple in-flight requests can all receive 401. Naive refresh logic triggers parallel refresh calls that race each other.

**Decision:** Single Axios instance with a response interceptor. On 401, queue all concurrent failing requests, trigger one refresh, re-run the queue with the new access token.

**Consequences:**
- No refresh races
- Interceptor is non-trivial — documented and tested
- Only path for API calls (fetch is forbidden)
- Refresh failure → log out + redirect cleanly

**Alternatives:**
- **Plain fetch with per-request retry** — we'd reinvent the wheel badly.
- **Refresh before each request** — chatty, doesn't handle server-side token invalidation.

---

## FD005 — SSR-safe storage with `createNoopStorage` fallback

**Date:** Sprint 0 (fix)
**Status:** Accepted

**Context:** redux-persist imports the storage engine at module load. The default storage engine touches `localStorage`, which doesn't exist during Next.js server rendering. This crashes the server build with "localStorage is not defined."

**Decision:** Persist config checks for `typeof window` and falls back to a `createNoopStorage` object (async methods that resolve with empty values) on the server.

**Consequences:**
- Server renders cleanly with empty persisted state
- Client hydrates and rehydrates real localStorage
- Any new persisted slices inherit this behavior via the shared config
- A small "flash" of unauthenticated state is possible on first paint if the user is mid-action — acceptable for an internal tool

**Alternatives:**
- **Dynamic import of the store on client only** — breaks server components that need store access.
- **Cookie-based persistence for the whole store** — overkill; cookies should be for what the server needs to read.

---

## FD006 — Rename `middleware.ts` → `proxy.ts` per Next.js 16

**Date:** Sprint 0
**Status:** Accepted

**Context:** Next.js 16 renamed `middleware.ts` to `proxy.ts` and the exported function must be named `proxy` (not `middleware`). Build fails loudly with a clear error, but the rename is non-obvious to anyone following older tutorials.

**Decision:** Follow the Next.js 16 convention. Project uses `proxy.ts` at repo root with `export function proxy(...)`.

**Consequences:**
- Tutorials and docs written for Next.js 13–15 refer to `middleware.ts` — ignore that naming
- Future upgrades may rename again; check release notes

**Alternatives:**
- None. This is what Next.js 16 requires.

---

## FD007 — Cookie + Redux dual storage for access token (no third location)

**Date:** Sprint 0 (deduplication)
**Status:** Accepted

**Context:** Initial scaffolding stored the access token in three places: Redux, redux-persist's localStorage (via Redux), and a `tokenUtils` localStorage helper. These drifted — refresh updated one, not another — causing auth bugs.

**Decision:** The access token has exactly two storage locations, both updated together:
- Redux slice (persisted automatically by redux-persist) — for API client reads
- `access_token` cookie — for `proxy.ts` route guard reads

The `tokenUtils` direct localStorage wrapper is deleted.

**Consequences:**
- Every token update (login, refresh, logout) updates both locations atomically
- No drift because the auth slice's reducers are the only code path that writes
- Adding another read location in future requires revisiting this doc

**Alternatives:**
- **Cookie only** — API client can't read httpOnly cookies directly. Would require a server proxy for every API call. Rejected.
- **Redux only** — `proxy.ts` can't read client-side state. Rejected.

---

## FD008 — Client-side Zod validation, backend is source of truth

**Date:** Planning phase
**Status:** Accepted

**Context:** Forms need validation. Backend already validates via Pydantic + service rules. Should the frontend re-implement?

**Decision:** Yes, but only for UX. Zod schemas on the frontend validate field shape, required fields, obvious patterns (email format, phone E.164). Business rules (max 5 children, 1 volunteer per school) are **never** checked client-side.

**Consequences:**
- Faster error feedback for typos and format mistakes
- No duplicated business logic
- Backend validation errors are mapped back to form fields via React Hook Form's `setError`

**Alternatives:**
- **No client validation** — worse UX, every typo is a round trip.
- **Client validation including business rules** — duplicates logic, drifts, creates false confidence.

---

## FD009 — One Axios instance, `fetch()` forbidden

**Date:** Planning phase
**Status:** Accepted

**Context:** Multiple ways to make HTTP calls in a React app. Without discipline, some go through auth interceptors and some don't, causing silent auth failures.

**Decision:** All API calls go through the single Axios instance exported from `lib/api/client.ts`. Direct `fetch()` calls to the backend are forbidden. Per-feature typed functions wrap the client.

**Consequences:**
- Every request gets auth headers and refresh logic
- Adding telemetry, logging, or tracing is one-file change
- `fetch()` is still fine for non-backend calls (CDN resources, etc.)

**Alternatives:**
- **`fetch()` + manual headers** — disciplined teams do this. We're a team of one, simpler to enforce via lint.

---

## FD010 — UI prototype reference (placeholder — to be filled at Sprint 2)

**Date:** Pre-Sprint 2
**Status:** Pending

**Context:** A UI prototype was generated via AI during planning. It will inform visual design for Sprint 2 feature pages (auth, school list, school detail shell).

**Decision:** TBD at Sprint 2 kickoff. Options depending on prototype quality:
- Adopt screens/components directly
- Take as design reference, rebuild in MUI
- Ignore if it doesn't fit the MUI + theme approach

**Link:** [to be added when the prototype is shared]

**Consequences:** Documented at Sprint 2.

---

## Frontend-only conventions (not ADRs, just rules)

Smaller decisions that didn't warrant a full entry:

- **TypeScript strict mode on, no `any` in committed code** (exceptions require a comment explaining why)
- **ESLint + Prettier on pre-commit** (configured in Sprint 0, enforced by CI)
- **Component file names are PascalCase** (e.g., `SchoolList.tsx`), non-component files are kebab-case (e.g., `api-client.ts`)
- **No default exports for components** — named exports only, for refactor-safety and better IDE support
- **Test files sit next to the code they test** — `SchoolList.tsx` + `SchoolList.test.tsx` in the same folder