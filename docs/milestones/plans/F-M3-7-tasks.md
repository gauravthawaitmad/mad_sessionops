# F-M3-7 Execution Progress

## Chunk 1 — Models + Migration B

- [x] Create `models/class_section_subject.py`
- [x] Create `models/child_subject.py`
- [x] Create `models/slot_class_section.py`
- [x] Create `models/slot_class_section_volunteer.py`
- [x] Register all 4 in `models/__init__.py`
- [x] Run `just makemigrations` + `just migrate` (migration 0015)

## Chunk 2 — Create service

- [x] Create `services/slot_classes/__init__.py`
- [x] Create `services/slot_classes/create.py` (5-table atomic + helpers)
- [x] Write `tests/slot_classes/test_create_slot_class.py` (13 tests, all pass)
- [x] Run tests

## Chunk 3 — Edit + Delete services

- [x] Create `services/slot_classes/edit.py`
- [x] Create `services/slot_classes/delete.py`
- [x] Wire SlotClassSection count check in `services/slots/delete.py`
- [x] Write `tests/slot_classes/test_delete_slot_class.py` (13 tests, all pass)
- [x] Run tests

## Chunk 4 — M2 extensions

- [x] Extend `services/children/enroll.py` (ChildSubject on enroll)
- [x] Extend `services/children/edit.py` (ChildSubject on section change)
- [x] Extend `services/structure/sections.py` (block delete if slot-classes exist)
- [x] `tests/test_f_m2_5_sections.py`: added `test_section_delete_blocked_when_slot_classes_exist`

## Chunk 5 — API + Frontend

- [x] Write `api/slot_classes_api.py` (CRUD + GET /subjects/)
- [x] Register in `routes.py`
- [x] Update `_slot_to_schema` to populate `slot_class_count`
- [x] Build `lib/api/services/slot_classes.service.ts` (+ `fetchSubjects`)
- [x] Build `SlotDetail.tsx` (expandable slot-class rows with delete)
- [x] Build `AddSlotClassModal.tsx` (section/subject/vol dropdowns)
- [x] Wire `SlotDetail` into `SlotListTab.tsx` (click to expand)
- [x] TypeScript check: 0 errors

## Deviations from plan
- `SlotCard` click-to-expand handled in `SlotListTab` (wrapper Box) rather than inside `SlotCard` itself — keeps `SlotCard` stateless and avoids event bubbling conflicts with the three-dot menu
- Subjects endpoint at `/api/schools/subjects/` (under slot_classes_router) — unconventional path but functional; acceptable for M3

## Blockers
- None
