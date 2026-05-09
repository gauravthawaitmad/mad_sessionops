# F-M2-7 Execution Progress

## Chunk 1 — Schema + Service (backend)
- [x] Add `ChildEditIn` to `schemas/children.py`
- [x] Extend `ChildOut` with `date_of_enrollment`, `mad_joining_date`, `current_section_id`, `current_class_id`
- [x] Create `services/children/edit.py`

## Chunk 2 — API
- [x] Add PATCH endpoint to `api/children_api.py`
- [x] Write `tests/test_f_m2_7_children.py` (10 tests)
- [x] Backend tests pass (10/10 green)
- [x] Lint passes (no errors in new files)

## Chunk 3 — Frontend
- [x] Extend `ChildItem` + `mapChild` in `children.service.ts`
- [x] Add `updateChild` to `children.service.ts`
- [x] Create `components/schools/children/EditChildDrawer.tsx`
- [x] Wire Edit button into `ChildrenTab.tsx`
- [x] TypeScript build passes (tsc --noEmit clean)
- [x] Frontend tests pass (15/15 green)

## Deviations from Plan
- `ChildOut` extended (date_of_enrollment, mad_joining_date, current_section_id, current_class_id) — needed for drawer pre-fill
- Capacity check moved inside "section actually changed" guard to prevent false 409 when CO saves without changing section

## Blockers
- None
