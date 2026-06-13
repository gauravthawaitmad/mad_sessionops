# Feature Plan: F-M4-1 — Activate Calendar Tab

## Overview

Remove the "Coming soon" / disabled treatment from the Calendar tab on `SchoolDetailPage`. The tab becomes clickable and renders: empty state when no session is configured, or the month grid when a session exists. This is a frontend-only gate-lift; the data layer is built in F-M4-2 and F-M4-3.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | No model changes |
| Backend services | None | |
| Backend API endpoints | None | Session endpoint added in F-M4-2 |
| Frontend pages | None | Tab lives in existing SchoolDetailPage |
| Frontend components | Modified | SchoolDetailPage — remove disabled state; new CalendarTab component |
| Database migrations | No | |
| Existing tests | Update | Tab-disabled tests become tab-enabled tests |
| Documentation | No | |

## High-Level Design (HLD)

`SchoolDetailPage` already has a tab navigation that disables the Calendar tab. F-M4-1 removes that gate and renders a new `CalendarTab` component. `CalendarTab` calls `GET /api/schools/{id}/session/` (built in F-M4-2) and branches: null response → empty state with CTA; session row → month grid stub (populated in F-M4-2/3).

Because F-M4-1 is a gate-lift with no data of its own, the empty state CTA is wired but the modal it opens is built in F-M4-2. In isolation (before F-M4-2 ships), clicking the CTA can render a placeholder.

## Low-Level Design (LLD)

### Backend

None.

### Frontend

#### Files to modify

- `mad_sessionops_frontend/components/schools/SchoolDetailPage.tsx`
  - Remove `disabled` / `coming-soon` prop from Calendar tab item
  - Import and render `<CalendarTab schoolId={partnerId} />`

#### Files to create

- `mad_sessionops_frontend/components/schools/calendar/CalendarTab.tsx`
  - Calls `GET /api/v1/schools/{schoolId}/session/` on mount
  - Loading state: skeleton
  - `session === null` → `<CalendarEmptyState onConfigureClick={...} />`
  - `session !== null` → `<CalendarMonthGrid session={session} holidays={[]} />` (grid built in F-M4-3)

- `mad_sessionops_frontend/components/schools/calendar/CalendarEmptyState.tsx`
  - Centered card with calendar icon
  - Title: "Academic session not configured"
  - Body: "Configure the academic session to enable calendar features for this school."
  - CTA button: "Configure session" → triggers `SetSessionModal` (built in F-M4-2; pass `onOpen` prop for now)

#### API integration

```ts
// lib/api/sessions.ts (new file, F-M4-2 owns the full version)
export const getSchoolSession = (schoolId: number) =>
  apiClient.get(`/schools/${schoolId}/session/`);
```

#### State management

No Redux slice needed. Local `useState` in `CalendarTab` for the session response (simple fetch-on-mount pattern matches existing tabs).

## Business Rules Enforced

- RBAC: CO can only view their own school's Calendar tab. CHO can view worknode-scoped schools. Admin can view any. These are enforced by the existing school detail route guard — no additional guard needed here.

## Security Review

- No new endpoints — RBAC is inherited from the existing school detail page auth guard.
- Session data is read-only in this feature; no mutation surface.

## Testing Strategy

**Frontend component tests (Vitest + RTL):**
- `CalendarTab` renders empty state when `GET /session/` returns `null`
- `CalendarTab` renders month grid stub when session is present
- "Configure session" CTA button is present in empty state
- Tab is no longer disabled in `SchoolDetailPage`

**Manual verification:**
- Navigate to school detail → Calendar tab is clickable
- School with no session → empty state with CTA visible
- School with session (after F-M4-2 ships) → month grid visible

## Milestones (implementation order)

1. **Remove tab disable** — `SchoolDetailPage`: remove disabled flag from Calendar tab item. Tab renders blank content. (30 min)
2. **CalendarEmptyState** — Create `CalendarEmptyState.tsx` as a standalone component with no data dependency. (1 hr)
3. **CalendarTab** — Wire `GET /session/` call, branch on null vs. data. Render `CalendarEmptyState` for null case, stub for data case. (2 hr)
4. **Tests** — Write Vitest tests for the two states. (1 hr)

## Open Questions

None. F-M4-1 is a gate-lift with clear requirements. All behaviour depends on F-M4-2 (session data) and F-M4-3 (month grid), which are planned separately.
