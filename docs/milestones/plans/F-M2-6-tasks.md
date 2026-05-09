# F-M2-6 Execution Progress

## Chunk 1 — Models
- [x] All 6 child models already exist in `child.py` (from M2 migration work)
- [x] Models exported in `models/__init__.py`
- [x] `children_api.py` stub exists in `api/`
- [x] `children.service.ts` already complete (list + enroll functions)

## Chunk 2 — Backend Services + API
- [x] Create `schemas/children.py` — ChildEnrollIn, ChildOut
- [x] Create `services/children/__init__.py`
- [x] Create `services/children/queries.py` — list_children with annotations
- [x] Create `services/children/enroll.py` — atomic 5-table insert
- [x] Flesh out `api/children_api.py` — GET list + POST enroll
- [x] Write `tests/test_f_m2_6_children.py` — 11 tests (1 extra: school cap enforcement)
- [x] Backend tests pass (11/11 green)
- [x] Lint passes

## Chunk 3 — Frontend
- [x] Flesh out `components/schools/children/ChildrenTab.tsx`
- [x] Create `components/schools/children/EnrollChildModal.tsx`
- [x] TypeScript build passes (tsc --noEmit clean)
- [x] Frontend tests pass (15/15 green)

## Deviations from Plan
- Backend test count: 11 tests written (plan said 10); extra test covers school `confirmed_child_count` hard cap
- DB schema drift discovered post-migration 0009 rewrite: child/batch_child/child_removal_log tables had wrong columns. Fixed via corrective migration `0012_fix_child_schema_drift.py` using `SeparateDatabaseAndState`
- `SchoolClassOut.resolve_sections()` always returns `[]` by design — frontend sections loader calls `fetchSections(schoolId, schoolClassId)` directly instead of reading from class object
- Gender picker: replaced MUI `ButtonGroup` (caused CSS border artifacts with mixed variants) with custom `Box` flex layout

## Blockers
- None
