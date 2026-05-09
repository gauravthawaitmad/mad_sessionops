# F-M2-10 Execution Progress

## Chunk 1 — Backend query logic
- [x] `list_children` in `services/children/queries.py` — full annotation + filter logic complete
- [x] `api/children_api.py` — query params wired (section_id, class_id, status, search)
- [x] `schemas/children.py` — `ChildOut` resolvers for annotated fields
- [x] Backend filter tests written (`tests/test_f_m2_10_children.py`)

## Chunk 2 — Frontend filter bar
- [x] `lib/api/services/children.service.ts` — `ListChildrenParams` type + `fetchChildren` with query params
- [x] `ChildrenTab.tsx` — StatusTabs, ClassDropdown, SectionDropdown, Search input
- [x] `ChildrenTab.tsx` — 300ms debounce (inline useEffect), section resets on class change
- [x] `ChildrenTab.tsx` — fetches status=all; client-side status filtering for instant tab switching
- [x] `ChildrenTab.tsx` — disabled SectionDropdown when no class selected
- [x] `ChildrenTab.tsx` — inactive rows rendered (status chip shows Inactive)

## Chunk 3 — Tests & Validation
- [x] Backend tests: 9/9 passed (`test_f_m2_10_children.py`)
  - Fixed `_make_section` helper to use `get_or_create` for `SchoolClass` (unique constraint on second section in same class)
- [x] Backend lint: clean for all F-M2-10 files (`test_f_m2_10_children.py` passes ruff check)
  - Removed unused `ChildClass`, `ChildClassSection` imports from test file
  - Remaining 26 lint errors are pre-existing in other files (auth_service.py, settings.py, etc.)
- [x] Frontend TypeScript check: `tsc --noEmit` exits 0 — no type errors
- [!] `npm run lint` (`next lint`) is broken project-wide — Next.js 16 removed the `lint` CLI command (pre-existing, not F-M2-10)

## Deviations from Plan
- Status filter is client-side (tab switch is instant): API always fetches `status=all`; status pills filter `displayChildren` in memory. Class and section filters are still server-side. This is correct for the use case.
- Inactive filter uses `is_active=False, removed=False` (not `removed=True` as stated in plan). `deactivate_child` only sets `removed=True` on child's assignments (ChildClass, ChildClassSection), not on the Child row itself — so `removed=False` is correct.

## Blockers
- None — F-M2-10 is complete.
