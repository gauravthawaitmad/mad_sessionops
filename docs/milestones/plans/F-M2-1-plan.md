# Feature Plan: F-M2-1 — Activate Structure Tab

## Overview

The Structure tab on the school detail page was disabled in M1 with a "Coming soon" placeholder. This feature removes that placeholder and wires the tab to the real `StructureTab` component backed by the class/section API endpoints built in F-M2-4 and F-M2-5. F-M2-1 is a frontend-only activation gate; the data and API belong to F-M2-4/F-M2-5.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | No model changes |
| Backend services | None | No service changes |
| Backend API endpoints | None | Endpoints built in F-M2-4/F-M2-5 |
| Frontend pages | Modified | `SchoolDetailPage.tsx` — tab enabled |
| Frontend components | New (reference) | `StructureTab.tsx` wired in |
| Database migrations | No | — |
| Celery tasks | No | — |
| Existing tests | Update | `SchoolDetailPage.test.tsx` — tab was disabled |
| Documentation | None | — |

## High-Level Design

### Data flow

```
User clicks "Structure" tab
  → SchoolDetailPage renders active StructureTab component
  → StructureTab fetches GET /api/schools/{schoolId}/classes/
  → Renders class cards (or empty state if no classes)
```

### Integration points

- `SchoolDetailPage.tsx` — currently has the Structure tab rendered as disabled/coming-soon; replace with `<StructureTab schoolId={schoolId} />`
- `StructureTab.tsx` — new component (built in F-M2-4 plan); this feature simply activates it

## Low-Level Design

### Frontend

**`components/schools/SchoolDetailPage.tsx`** (modify)

Find the Structure tab definition. It currently has one of:
- `disabled={true}` prop
- A "Coming soon" banner rendered conditionally
- The tab body rendering `<ComingSoon />` or similar

Replace with: render `<StructureTab schoolId={schoolId} />` when the Structure tab is active. Remove any `disabled` prop or "Coming soon" conditional.

**Empty state** — `StructureTab.tsx` must handle the case where the school has no classes yet:
- Show: "No classes added yet. Click 'Add Class' to get started."
- "Add Class" button visible even in empty state

**Tab clickability** — tab must be clickable for both CO (own schools) and Admin (all schools). No role-gating on the tab itself; RBAC is enforced on the API.

### State management

Local state only in `StructureTab`. No new Redux slices.

### Form validation

None for this feature — activation only.

## Business Rules Enforced

None directly. The structure data fetched by this tab enforces rules in F-M2-4/F-M2-5.

## Security Review

- Tab visibility is not role-gated at the UI level; RBAC is enforced server-side on `/api/schools/{id}/classes/`
- CO accessing another school's detail page already gets 403 from M1's school detail endpoint; Structure tab data will also 403

## Testing Strategy

**Frontend tests** (`SchoolDetailPage.test.tsx` — update):
- `test_structure_tab_renders_for_co` — tab is clickable, renders StructureTab component
- `test_structure_tab_empty_state_when_no_classes` — empty state message shown
- `test_structure_tab_returns_403_for_co_without_school_access` — confirmed at API level (not tab level)

**Manual verification:**
- [ ] CO opens a school → Structure tab is clickable (no "Coming soon")
- [ ] School with no classes → empty state message renders
- [ ] Click "Add Class" from empty state → Add Class modal opens (F-M2-4)

## Implementation Order

**Chunk 1 (only chunk):** Modify `SchoolDetailPage.tsx` to activate the tab. Remove disabled/coming-soon treatment. Render `<StructureTab schoolId={schoolId} />`.

Dependency: F-M2-4 (StructureTab component) must exist. If building in order, do F-M2-4 first.

## Open Questions

None. All spec requirements are clear.
