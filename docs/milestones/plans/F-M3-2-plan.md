# Feature Plan: F-M3-2 — Activate Slots Tab

## Overview

The Slots tab on the school detail page was disabled in M2 with a "Coming soon" placeholder. This feature removes that placeholder and wires the tab to the `SlotListTab` component. Full tab content is built across F-M3-5 (create slot), F-M3-6 (edit/delete slot), F-M3-7 (slot-class assignment), and F-M3-9 (schedule view). F-M3-2 is a frontend-only activation gate.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | No model changes |
| Backend services | None | No service changes |
| Backend API endpoints | None | Endpoints built in F-M3-5/F-M3-6/F-M3-7/F-M3-9 |
| Frontend pages | Modified | `SchoolDetailPage.tsx` — tab enabled |
| Frontend components | New (reference) | `SlotListTab.tsx` wired in |
| Database migrations | No | — |
| Celery tasks | No | — |
| Existing tests | Update | `SchoolDetailPage.test.tsx` — tab was disabled |
| Documentation | None | — |

## High-Level Design

### Data flow

```
User clicks "Slots" tab
  → SchoolDetailPage renders active SlotListTab component
  → SlotListTab fetches GET /api/schools/{schoolId}/slots/
  → Renders slot cards grouped by day, or empty state
```

### Integration points

- `SchoolDetailPage.tsx` — remove disabled / "Coming soon" from Slots tab; render `<SlotListTab schoolId={schoolId} />`
- `SlotListTab.tsx` — built in F-M3-5; this feature simply activates the tab

## Low-Level Design

### Frontend

**`components/schools/SchoolDetailPage.tsx`** (modify)

Find the Slots tab definition. Remove any `disabled` prop or "Coming soon" conditional. Render `<SlotListTab schoolId={schoolId} />` when the tab is active.

**Empty state (when no slots exist):** "No slots configured yet. Click 'Add Slot' to create one." — rendered inside `SlotListTab`, not in this feature.

**Tab clickability** — must be clickable for CO (own schools), Admin (all schools), and CHO (worknode-scoped schools).

### State management

Local state inside `SlotListTab`. No new Redux slices.

### Form validation

None — activation only.

## Business Rules Enforced

None directly. Rules enforced at the API level in F-M3-5 through F-M3-7.

## Security Review

- Tab visibility is not role-gated at the UI level; RBAC enforced server-side
- CO accessing a school they don't own gets 403 from the API

## Testing Strategy

**Frontend tests** (`SchoolDetailPage.test.tsx` — update):
- `test_slots_tab_renders_for_co_with_school_access`
- `test_slots_tab_returns_403_for_co_without_school_access`
- `test_slots_tab_renders_for_cho_with_school_access`
- `test_slots_tab_empty_state_for_school_with_no_slots`

**Manual verification:**
- [ ] CO opens a school → Slots tab is clickable (no "Coming soon")
- [ ] School with no slots → empty state message renders with "Add Slot" button
- [ ] Calendar tab remains disabled / "Coming soon" (unchanged)

## Implementation Order

**Chunk 1 (only chunk):** Modify `SchoolDetailPage.tsx` to activate the Slots tab. Remove disabled / coming-soon. Render `<SlotListTab schoolId={schoolId} />`.

**Dependency:** F-M3-5 (`SlotListTab`) must exist for the tab to show content. Can land first with a loading skeleton.

## Open Questions

None. All resolved.
