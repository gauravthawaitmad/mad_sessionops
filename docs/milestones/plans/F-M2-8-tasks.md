# F-M2-8 Execution Progress

## Chunk 1 — Schema + Service (backend)
- [x] Add `DeactivateIn` to `schemas/children.py`
- [x] Create `services/children/deactivate.py`

## Chunk 2 — API + Tests
- [x] Add POST deactivate endpoint to `api/children_api.py`
- [x] Write `tests/test_f_m2_8_children.py` (11 tests)
- [x] Backend tests pass (11/11 green)
- [x] Lint passes (no errors in new files)

## Chunk 3 — Frontend
- [x] Add `deactivateChild` to `children.service.ts`
- [x] Create `components/schools/children/DeactivateChildModal.tsx`
- [x] Wire Deactivate button into `ChildrenTab.tsx`
- [x] TypeScript build passes (tsc --noEmit clean)
- [x] Frontend tests pass (15/15 green)

## Deviations from Plan
- 11 tests written (plan called for 7) — split into more granular classes for readability
- `required_error` param removed from `z.enum` (Zod v4 uses `message` param, not `required_error`)

## Blockers
- None
