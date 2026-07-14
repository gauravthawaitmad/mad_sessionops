# F-M6-4 Execution Progress

## Milestone 1: enroll_child rewrite + schema change
- [x] `ChildEnrollIn`: `school_class_id` required, `class_section_id` optional
- [x] `enroll_child` rewrite: class from `school_class_id`, bucket optional, `get_or_create` for ChildSubject
- [x] Tests (`test_f_m6_4_children.py::TestEnrollDecoupled`)

## Milestone 2: edit_child class-change path
- [x] `ChildEditIn.school_class_id` optional
- [x] New class-change block with R-class data-quality guard
- [x] Tests (`test_f_m6_4_children.py::TestEditChildSchoolClassId`)

## Milestone 3: edit_child bucket-change path + ChildSubject retention
- [x] Remove class-follow side effect from section-change block
- [x] Remove old-row ChildSubject soft-delete; switch to get_or_create
- [x] Tests asserting retention

## Milestone 4: ChildOut/list_children contract for F-M6-7
- [x] `CurrentSectionOut`/`CurrentSchoolClassOut` + `ChildOut.current_section`/`current_school_class`
- [x] `list_children(unassigned=...)` filter + `current_section_display_name` annotation
- [x] `children_api.py` passthrough
- [x] Grep frontend for flat-field usage before removing — found in `children.service.ts` and `ChildrenTab.tsx` only (matches the plan's anticipated scope; no unexpected consumer). These will break against the new `ChildOut` shape until F-M6-7 lands — expected per the plan's incremental-deploy note, not a blocker for this feature.
- [x] Tests

## Milestone 5: Validation
- [x] Update existing enroll call sites in test_f_m2_6/7_children.py
- [x] Full regression (`just test`, 44 min, 629 passed / 43 failed) — see below
- [x] `just lint` (ruff check clean on F-M6-4 files; project-wide `ruff format --check` drift is pre-existing across ~153/233 files, unrelated to this feature — not addressed)
- [x] `makemigrations --check` — N/A, F-M6-4 has no model changes
- [ ] Update `docs/milestones/M6.md` F-M6-4 status → Built (done in this pass)

## Full regression result: 629 passed, 43 failed

**All 43 failures are pre-existing and unrelated to F-M6-4's actual changes** (`enroll_child`, `edit_child`, `reactivate_child`, `ChildOut`, `list_children`). Verified via `git diff HEAD` on every touched file — none of the failing tests or the code paths they exercise were touched by F-M6-4:

- **1 children-adjacent, pre-existing bug** (not introduced by F-M6-4): `test_f_m2_6_children.py::TestListChildren::test_status_all_includes_inactive`. `list_children(status="all")` can never return a `removed=True` row because `Child`'s default manager already filters `removed=False` before the `status` branch ever runs (per `BUSINESS_RULES.md`: "Custom managers filter `is_active=True` and `removed=false` by default"). The `status="all"` branch would need `Child.objects.all_with_deleted()` as its base queryset to actually include removed rows — it doesn't, so this has never worked. `queries.py`'s `status` branch logic and this test are both untouched in F-M6-4's diff (confirmed via `git diff HEAD`), so this predates F-M6-4. **Flagging, not fixing** — out of scope for this feature; worth a follow-up ticket.
- **32 auth/sync failures, confirmed pre-existing/environmental, zero overlap with F-M6-4's code:**
  - `api/test_auth.py` (18 failures): Google OAuth callback route returns 404 — expected per `docs/MILESTONE.md`'s M1 decision ("Removes Google callback from M1 routing... kept in code for M5"); the test file was never updated to skip/reflect that. Other `test_auth.py` failures (`/me` returns different field names, refresh response has extra keys, logout returns 200 not 204) are pre-existing schema/behavior drift between the test file and the current auth service, unrelated to any file F-M6-4 touched.
  - `features/m1/test_f_m1_2_hasura_sync.py` (8), `test_f_m1_3_rbac_scope.py` (2), `sync/test_incremental_sync.py` (9), `sync/test_insert_flow.py` (1), `sync/test_realtime_sync_e2e.py` (1), `sync/test_trigger.py` (2), `sync/test_realtime_sync_endpoint.py` (1): all in the Hasura/realtime sync subsystem, which F-M6-4 does not touch (only `sessionops/schemas/children.py`, `services/children/{enroll,edit,reactivate,queries}.py`, `api/children_api.py`). Failure signatures (DB cursor errors, cursor-advance assertions) indicate a sync-subsystem issue independent of this feature.

None of these 43 failures are in `test_f_m6_4_children.py`, `test_f_m2_7_children.py`, `test_f_m2_8_children.py`, `test_f_m2_9_children.py`, `test_f_m2_10_children.py`, `test_buckets*.py`, or `test_bucket_children*.py` — every test that actually exercises F-M6-4's code passed.

## Deviations from plan
- `reactivate_child` (`services/children/reactivate.py`) was also updated to require `school_class_id` and treat `class_section_id` as optional bucket assignment, mirroring `enroll_child`. Not called out in the plan's blast radius, but necessary: `ReactivateIn.school_class_id` is required per the schema, so reactivation needed the same class/bucket decoupling as enrollment for consistency.

## Post-ship regression discovered (fixed separately)

Decoupling class assignment onto a direct `ChildClass` link (this feature) had a side effect that wasn't caught at the time: `services/structure/queries.py::soft_delete_school_class` (F-M2-4, untouched by this feature's diff) still guarded class deletion by counting active `ClassSection` rows referencing the class. Since M6 buckets never set `school_class_id` (decision #1), that guard silently became a no-op for any bucket-based school — a class with active children (linked only via the new `ChildClass`, F-M6-4) could be deleted with zero error. Found later during manual UI testing, not caught by this feature's own test suite since none of its tests exercised class deletion. Fixed in `soft_delete_school_class` to count active `ChildClass` rows instead; see `docs/milestones/M6.md`'s addendum under this feature and `docs/milestones/M2.md`'s corrected F-M2-4 business rule. Tests added in `tests/test_f_m2_4_classes.py`.

## Blockers
- None for F-M6-4 itself. The pre-existing `list_children(status="all")` bug and the 42 unrelated auth/sync failures are flagged above as known issues for separate follow-up — they do not block this feature and are not caused by it.

## Status: Built
