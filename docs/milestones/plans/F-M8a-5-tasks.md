# F-M8a-5 Execution Progress

## Milestone 1: Deactivation flow
- [x] Create `services/realtime_sync/flows/deactivate.py`
- [x] Update `flows/__init__.py` — replace stub with real import

## Milestone 2: Slot-class CRUD cleanup
- [x] Update `check_r4_volunteer` in helpers.py to also check SCSV (open question 2 answer)
- [x] Delete `reconcile_school_volunteer` from `helpers.py`
- [x] Update `create.py` — remove step 17 `ensure_school_volunteer` loop
- [x] Update `delete.py` — remove `reconcile_school_volunteer` call
- [x] Update `edit.py` — remove two `reconcile_school_volunteer` calls

## Milestone 3: Tests
- [x] Write `tests/sync/test_deactivate_flow.py`
- [x] Update `tests/slot_classes/test_create_slot_class.py` — remove/rewrite SchoolVolunteer assertions
- [x] Update `tests/slot_classes/test_delete_slot_class.py` — remove/rewrite SchoolVolunteer assertions

## Milestone 4: Validation
- [x] All 61 F-M8a-5 tests pass (slot_classes + deactivate + cascade)
- [x] Lint clean on all modified/new service and test files
- [ ] Full suite: 12 pre-existing failures unrelated to F-M8a-5 (test_incremental_sync, test_trigger, test_concurrent_events_serialize — all pre-date this feature)

## Blockers
- None
