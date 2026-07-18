# F-M7-1 + F-M7-2 Execution Progress

Plan: `docs/milestones/plans/F-M7-1-plan.md`

**Status: all 4 milestones complete. 20/20 tables wired. 38 tests passing. Zero regressions.**

## Pre-flight decisions (resolved before coding)

- [x] Open Question #1 (migration bot user): **superseded by user correction** — no bot user, no new migration. Uses the existing real user `user_id=1924616` (`gaurav.thwait@makeadiff.in`) directly for `created_by`/`updated_by` on every migration-mode write (`services/migration/system_user.py::get_migration_actor()`).
- [x] Open Questions #2/#3/#4 adopted as the plan's own stated recommendations: no per-row business-rule warnings (defer to F-M7-10), 401-equivalent shape is `{"status": "error", "error": "..."}`, `action` field attached by the router not baked into `TableConfig`.
- [x] Fixed a stale reference in the plan itself: Milestone 2 named `program, subject, academic_year` as the first 3 table configs, but `subject` is out of scope. Corrected to `program, academic_year, class`.

## Milestone 1: Auth plumbing — DONE
- [x] `sessionops/services/migration/__init__.py`
- [x] `sessionops/services/migration/auth.py` — `validate_migration_token()`
- [x] `sessionops/services/migration/system_user.py` — `get_migration_actor()` (uncached — see note below)
- [x] `sessionops/api/migration_api.py` — router + auth + response handling
- [x] `sessionops/routes.py` — registered at `/api/internal/migrate/`
- [x] `.env.development.example` + `.env.development` — `MIGRATION_SERVICE_TOKEN` added
- [x] No migration needed (real user used directly, not seeded)

## Milestone 2: Generic upsert engine + first 3 table configs — DONE
- [x] `sessionops/services/migration/registry.py` — `FkCheck`, `TableConfig`, `TABLE_CONFIGS`
- [x] `sessionops/services/migration/generic.py` — `migrate_row()`, `_fk_exists()`, `_attname()`, `MigrationResult`
- [x] `sessionops/schemas/migration.py` — schemas for `program`, `academic_year`, `class`
- [x] 3 endpoints verified end-to-end via Django test client (manual smoke test) before writing pytest
- [x] `sessionops/tests/migration/test_generic_engine.py` + `test_migration_endpoints.py`

**Two real bugs found and fixed during this milestone, before they could spread to 20 tables:**
1. **Django FK `.name` vs `.attname` mismatch.** This codebase declares FK fields with a `name` that already matches the DB column (e.g. `program_id = ForeignKey(...)`), which differs from Django's `attname` (`program_id_id`) needed to assign a raw integer PK directly — verified empirically (`Class(program_id=1)` raises `ValueError: must be a "Program" instance`). The plan's own illustrative code (`Child.objects.create(**payload)`) would have hit this on every FK field. Fixed via `generic.py::_attname()`, applied uniformly to every payload key.
2. **Ninja doesn't treat a bare `dict` type-hint as "the request body"** — it parses it as a query parameter. Switched to parsing `request.body` manually, which also gave full control over the exact 400/422 response shapes the milestone spec wants (rather than Ninja's own request-validation exception handler, which only produces 422).

Also: Ninja rejects any `(status_code, data)` tuple whose status isn't declared via `response=` on the route — added a shared `_RESPONSE_SPEC` for all 20 routes.

## Milestone 3: Remaining 17 table configs — DONE
- [x] All 20 tables in `registry.py` (Layer 0 → 3)
- [x] All 20 Pydantic schemas in `schemas/migration.py`
- [x] All 20 routes registered — via a loop over `TABLE_CONFIGS`/`_SCHEMAS`, not 17 hand-written near-duplicate functions (same "config not code" reasoning the plan applies to the service layer)
- [x] Full test suite: 38 tests passing (unit + integration + a parametrized registry-wiring test that auto-covers all 20)

**A third real bug found and fixed here, via the child-removal-log tests:**
3. **`optional_fks` handling assumed the underlying column was always nullable.** `child_removal_log.co_id` (the one "warn-only" FK per decision #19) is a documented "loose FK" but is **NOT NULL** in the schema — the original design would null it out on a miss, which is a NOT NULL constraint violation. Also caught: I'd incorrectly put `child_removal_log.school_id` in `optional_fks` too, when it should be required like every other table's `school_id` — only `co_id` gets the special treatment. Fixed by adding `FkCheck.null_on_missing: bool` — `True` for genuinely-nullable optional FKs (e.g. `class_section.school_class_id`), `False` for co_id (warn, keep the original value, don't touch the column).

## Milestone 4: Hardening pass — DONE
- [x] Decision #15 raw-int checks confirmed wired for all 9 tables that need one
- [x] `child_removal_log`'s `co_id` confirmed optional/warn-only via a dedicated test
- [x] Full regression suite run for `children`/`structure`/`slot_classes`/`slots`: **183 passed, 4 failed**
  - The 4 failures are **pre-existing**, unrelated to F-M7-1 — confirmed by reproducing them in complete isolation (zero F-M7-1 code imported in that run). All 4 are Subject/Program seed-data `IntegrityError`s in `test_f_m2_6_children.py` and `test_subject_normalization.py`, matching M6.md's own note that F-M6-8's subject-normalization tests were flagged as "still need to run in an environment with DB access... before fully verified." Not fixed here — out of scope for F-M7-1, and M6's problem to own.
- [x] `just lint` clean (ruff check + format) on all new files
- [x] `just makemigrations sessionops --check` clean — zero model changes, as expected

## Final state
- 20/20 loader endpoints live at `/api/internal/migrate/{table}/`
- 38/38 new tests passing
- 0 regressions in existing suites (4 pre-existing failures unrelated and reproduced in isolation)
- 0 new migrations (no schema change; real user used directly instead of a seeded bot account)

## Post-build fixes from live n8n dry-run testing (2026-07-15/16)

- [x] **401 Unauthorized on n8n's first call.** Diagnosed as an n8n-side header format issue, not a server bug — verified via direct curl with the exact same token succeeding (201) against the live server while n8n's request logged a real 401. Root cause on n8n's end: likely missing `Bearer ` prefix or whitespace in the Header Auth credential value.
- [x] **`academic_year_label_key` unique constraint violation.** Not an upsert-logic bug — the PK lookup correctly found no existing `academic_year_id=2` row and attempted an INSERT, which collided with pre-existing dev/seed data (`academic_year_id=1`, same `label`). This is exactly the risk flagged during planning (see plan's earlier Q&A about truncating tables before dry runs). Fixed by the user truncating `academic_year` before retrying.
- [x] **Real n8n export includes Session-Ops's own audit columns** (`created_at`, `updated_at`, `created_by_id`, `updated_by_id`, `deleted_at`) that the original `extra="forbid"` schemas rejected. Fixed:
  - `schemas/migration.py`'s `MigrationRowBase` now accepts all five on every schema.
  - `created_by_id`/`updated_by_id` are stripped at the router (`migration_api.py`) — always the migration actor, never Bubble's value.
  - `created_at`/`updated_at` are popped out of `generic.py::migrate_row()`'s normal save flow and reapplied via a `.update()` queryset call, bypassing Django's `auto_now_add`/`auto_now` (which otherwise silently stamp "now" regardless of what's assigned — this was actually happening before the fix, confirmed then fixed then reverified against the live server).
  - `created_at` is treated as immutable after first insert (only reapplied on insert, never on update); `updated_at` is reapplied on both insert and update.
  - `deleted_at` needed no special handling — plain nullable field, passes through and is used normally.
  - Re-ran full test suite after each fix: 38/38 passing throughout, lint clean.

## Blockers
- None. Feature complete, live-tested against real n8n traffic, pending your review and manual commit.
