# F-M8a-4 Execution Progress

## Milestone 1: Migration — SchoolVolunteer nullable fields
- [x] Make `school_academic_year_id` and `created_by` nullable on SchoolVolunteer (model + migration 0023)

## Milestone 2: cascade.py — real implementation
- [x] `_resolve_school_for_worknode` — PartnerWorknode lookup, return int school_id or None
- [x] `_cascade_remove_user_from_school` — soft-delete SCSV → SCS → CSS → ChildSubject → SchoolVolunteer
- [x] `_ensure_school_volunteer` — create SchoolVolunteer if not already active
- [x] `_cleanup_other_school_assignments` — remove other-school drift, preserve current school
- [x] `cascade_worknode_added` — resolver → cleanup_other → ensure_sv → save worknode_id
- [x] `cascade_worknode_removed` — resolver → cascade_remove → null worknode_id
- [x] `cascade_worknode_updated` — resolver → cascade_old → cleanup_other → ensure_sv → save
- [x] `handle_worknode_change` — dispatcher (added/removed/updated)

## Milestone 3: Fix test_update_flow.py
- [x] Update 3 tests that previously asserted NotImplementedError — now assert partial_success / success

## Milestone 4: Write test_cascade_flows.py
- [x] worknode_added: creates SV, partial_success when no mapping, worknode_id not set on partial
- [x] worknode_added: preserves existing SV at same school, cleans up drift at other schools
- [x] worknode_removed: soft-deletes SV, sets worknode_id null, full cascade chain, shared SCS preserved
- [x] worknode_removed: no old school → no cascade (edge case)
- [x] worknode_updated: removes from old school, adds to new, partial_success when new mapping missing
- [x] cascaded_changes log correctness, deferred_operations on partial_success

## Milestone 5: Run tests and lint
- [x] F-M8a-4 tests (34/34) — all passing
- [x] lint — clean (F-M8a-4 files only; pre-existing failures in auth/slot_classes not in scope)

## Blockers
- None
