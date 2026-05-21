# Feature Plan: F-M3-1 — Activate Volunteers Tab

## Overview

The Volunteers tab on the school detail page was disabled in M2 with a "Coming soon" placeholder. This feature removes that placeholder and wires the tab to the `VolunteerListTab` component backed by the volunteer list endpoint built in F-M3-3. F-M3-1 is a frontend-only activation gate; the data and API belong to F-M3-3.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | No model changes |
| Backend services | None | No service changes |
| Backend API endpoints | None | Endpoint built in F-M3-3 |
| Frontend pages | Modified | `SchoolDetailPage.tsx` — tab enabled |
| Frontend components | New (reference) | `VolunteerListTab.tsx` wired in |
| Database migrations | No | — |
| Celery tasks | No | — |
| Existing tests | Update | `SchoolDetailPage.test.tsx` — tab was disabled |
| Documentation | None | — |

## High-Level Design

### Data flow

```
User clicks "Volunteers" tab
  → SchoolDetailPage renders active VolunteerListTab component
  → VolunteerListTab fetches GET /api/schools/{schoolId}/volunteers/
  → Renders volunteer cards or one of the two empty states
```

### Integration points

- `SchoolDetailPage.tsx` — currently has Volunteers tab rendered as disabled / "Coming soon"; replace with `<VolunteerListTab schoolId={schoolId} />`
- `VolunteerListTab.tsx` — built in F-M3-3; this feature simply activates it

## Low-Level Design

### Frontend

**`components/schools/SchoolDetailPage.tsx`** (modify)

Find the Volunteers tab definition. Remove any `disabled` prop or "Coming soon" conditional. Render `<VolunteerListTab schoolId={schoolId} />` when the tab is active.

**Tab is read-only** — no Add/Remove action buttons at all. `VolunteerListTab` handles empty states internally (see F-M3-3).

**Tab clickability** — must be clickable for CO (own schools), Admin (all schools), and CHO (worknode-scoped schools).

### State management

Local state only inside `VolunteerListTab`. No new Redux slices.

### Form validation

None — activation only.

## Business Rules Enforced

None directly. Rules enforced at the API level in F-M3-3.

## Security Review

- Tab visibility is not role-gated at the UI level; RBAC is enforced server-side on `GET /api/schools/{id}/volunteers/`
- CO accessing a school they don't own already gets 403 from the API; the tab will render an error state

## Testing Strategy

**Frontend tests** (`SchoolDetailPage.test.tsx` — update):
- `test_volunteers_tab_renders_for_co_with_school_access`
- `test_volunteers_tab_returns_403_for_co_without_school_access`
- `test_volunteers_tab_renders_for_cho_with_school_access`
- `test_volunteers_tab_no_add_button_present`

**Manual verification:**
- [ ] CO opens a school → Volunteers tab is clickable (no "Coming soon")
- [ ] Tab content rendered by `VolunteerListTab` (verified in F-M3-3 smoke test)
- [ ] No Add or Remove buttons anywhere on the tab

## Implementation Order

**Chunk 1 (only chunk):** Modify `SchoolDetailPage.tsx` to activate the tab. Remove disabled / coming-soon treatment. Render `<VolunteerListTab schoolId={schoolId} />`.

**Dependency:** F-M3-3 (`VolunteerListTab` component) must exist before this renders usefully, but the tab activation itself can land first with a loading skeleton.

## Open Questions

None. All resolved.
