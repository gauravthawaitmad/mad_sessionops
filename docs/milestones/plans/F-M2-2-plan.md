# Feature Plan: F-M2-2 — Activate Children Tab

## Overview

The Children tab was disabled in M1 with a "Coming soon" placeholder. This feature removes that placeholder and wires the tab to the real `ChildrenTab` component backed by the children API endpoints built in F-M2-6 through F-M2-10. Like F-M2-1, this is a frontend-only activation gate.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | No model changes |
| Backend services | None | No service changes |
| Backend API endpoints | None | Endpoints built in F-M2-6 |
| Frontend pages | Modified | `SchoolDetailPage.tsx` — tab enabled |
| Frontend components | New (reference) | `ChildrenTab.tsx` wired in |
| Database migrations | No | — |
| Celery tasks | No | — |
| Existing tests | Update | `SchoolDetailPage.test.tsx` — tab was disabled |
| Documentation | None | — |

## High-Level Design

### Data flow

```
User clicks "Children" tab
  → SchoolDetailPage renders active ChildrenTab component
  → ChildrenTab fetches GET /api/schools/{schoolId}/children/?status=active
  → Renders children table (or empty state if no children)
```

### Integration points

- `SchoolDetailPage.tsx` — replace disabled/coming-soon Children tab with `<ChildrenTab schoolId={schoolId} />`
- `ChildrenTab.tsx` — new component (built in F-M2-6 plan); this feature simply activates it

## Low-Level Design

### Frontend

**`components/schools/SchoolDetailPage.tsx`** (modify)

Find the Children tab definition. Replace any `disabled` prop or "Coming soon" conditional with `<ChildrenTab schoolId={schoolId} />`.

**Empty state** — `ChildrenTab.tsx` must handle zero children:
- Show: "No children enrolled yet. Click 'Enroll Child' to get started."
- "Enroll Child" button visible even in empty state

**Tab clickability** — clickable for CO (own schools) and Admin (all schools). No client-side role-gating.

### State management

Local state only in `ChildrenTab`. No new Redux slices.

## Business Rules Enforced

None directly. Child data enforces rules in F-M2-6 through F-M2-10.

## Security Review

- RBAC enforced server-side on `/api/schools/{id}/children/`
- CO cannot see another school's children — 403 from API, not from tab visibility

## Testing Strategy

**Frontend tests** (`SchoolDetailPage.test.tsx` — update, or `ChildrenTab.test.tsx`):
- `test_children_tab_renders_for_co_with_school_access`
- `test_children_tab_returns_403_for_co_without_school_access`
- `test_children_tab_shows_empty_state_for_school_with_no_children`

**Manual verification:**
- [ ] CO opens school → Children tab clickable (no "Coming soon")
- [ ] School with no children → empty state with "Enroll Child" button
- [ ] "Enroll Child" opens enrollment modal (F-M2-6)

## Implementation Order

**Chunk 1 (only chunk):** Modify `SchoolDetailPage.tsx` to activate the Children tab. Render `<ChildrenTab schoolId={schoolId} />`.

Dependency: F-M2-6 (ChildrenTab component) must exist. Build F-M2-6 first.

## Open Questions

None. All spec requirements are clear.
