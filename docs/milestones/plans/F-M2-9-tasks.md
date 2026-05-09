# F-M2-9 Execution Progress

## Chunk 1 — Schema + Service (backend)
- [x] Fix `list_children` inactive filter bug (`removed=True` → `removed=False`)
- [x] Add `ReactivateIn` to `schemas/children.py`
- [x] Create `services/children/reactivate.py`

## Chunk 2 — API + Tests
- [x] Add POST reactivate endpoint to `api/children_api.py`
- [x] Write `tests/test_f_m2_9_children.py` (10 tests)
- [x] Backend tests pass (10/10 green)
- [x] Lint passes (no errors in new files)

## Chunk 3 — Frontend
- [x] Add `reactivateChild` to `children.service.ts`
- [x] Create `components/schools/children/ReactivateChildModal.tsx`
- [x] Wire Reactivate button into `ChildrenTab.tsx`
- [x] TypeScript build passes (tsc --noEmit clean)
- [x] Frontend tests pass (15/15 green)

## Deviations from Plan
- 10 tests written (plan called for 8) — added an extra school-cap scenario for clarity
- Discovered and fixed a bug in `list_children`: inactive filter used `removed=True` (soft-delete state) instead of `removed=False` (deactivated state) — deactivated children were never appearing in the Inactive tab
- `ReactivateChildModal` uses green color theme (vs blue for enroll, red for deactivate) — no form validation needed since section is picked from a live card UI, not a typed field

## Blockers
- None
