# F-M4-9 Execution Progress

Open questions resolved (from plan doc, answered by human):
- `SYSTEM_SYNC_CO_ID = 485003`
- No bulk "undo cascade" tool — confirmed out of scope permanently, not just for M4.
- No dashboard visibility for now — Chunk 4 dropped. A notification trigger will be added later (separate feature).
- Audit trail: logs only, no new SyncRun field. Reconfirmed: soft-delete only, nothing removed from DB.

## Milestone 1: Cascade service, standalone and tested
- [x] Create `services/sync/partner_deactivation.py::cascade_deactivate_school` with `SYSTEM_SYNC_CO_ID = 485003`
- [x] Write `tests/sync/test_partner_deactivation_cascade.py` (19 tests — all 14 tables, idempotency, counts, rollback)
- [x] `just test` passes for the new test file (19/19 passed)
- [x] `just lint` passes (ruff check + format clean on the new files)

## Milestone 2: Wire into the sync path
- [x] Extend `services/sync/upsert.py::bulk_upsert_partners` — snapshot previously-active ids, call cascade after bulk_create
- [x] Regression audit: checked `test_trigger.py` / `test_incremental_sync.py` — both partner fixtures (`HASURA_PARTNER_ROW`, `PARTNER_ROW`) are single-call/insert-only or unused; no `run_incremental_sync` call passes a repeated active partner_id. No accidental trigger-condition overlap found.
- [x] Add integration tests — `tests/sync/test_partner_cascade_trigger.py` (7 tests: fires/skips on each condition branch + both entry points proven identical via a Slot side-effect check)
- [x] Full `tests/sync/` suite green (233/233 passed, ~30 min)
- [x] `just lint` passes on all new/modified files

## Milestone 3: Business rule documentation + audit logging
- [x] Add R17 to `docs/BUSINESS_RULES.md`
- [x] Add structured logging around the cascade call site in `bulk_upsert_partners` (done together with Milestone 2's wiring — logged inline at the same edit)
- [x] `tests/sync/` suite green (covered by Milestone 2's run)
- [x] `just lint` passes

## Milestone 4 (final validation)
- [x] `just lint` (repo-wide): found 34 pre-existing unused-import errors and 146 pre-existing files needing reformat, all in files this feature never touched — confirmed none of F-M4-9's new/modified files are among them. Pre-existing repo lint/format debt, out of scope to fix here.
- [x] Migration DB-alias check passed (no migrations added, as expected)
- [x] Full backend suite (`just test`, 747 tests) — ran once (~66 min): 743 passed, 4 failed, 1 error.

## Bug found and fixed during Milestone 4 validation

The full-suite run surfaced a real regression, not flakiness: `test_sync_is_idempotent` (`tests/features/m1/test_f_m1_2_hasura_sync.py`) syncs an unchanged partner twice and expects it to stay active. It failed because the original trigger condition checked only "previously active" — a partner that has **never been converted** (a plain lead) is still created with `is_active=True` on its first sync (that flag is driven only by `crm_partner_removed`, per F-M1-2, unrelated to `converted`). So every never-converted lead matched "removed=false, converted=false" again on its second sync — nothing had changed, but it got wrongly cascade-deactivated, and would keep re-matching forever after.

**Fix:** added a second snapshot, `previously_converted_ids` (`Partner.all_objects.filter(..., converted=True)`), taken before the upsert overwrites it. The cascade now requires the partner to have been previously **both** active **and** converted — i.e. a genuine converted→reverted transition, never a lead that was never converted. Confirmed with the user before implementing (this changes the trigger semantics from the original literal spec).

Files touched by the fix: `services/sync/upsert.py` (added `previously_converted_ids` check), `tests/sync/test_partner_cascade_trigger.py` (added `test_skips_cascade_for_never_converted_lead_on_repeat_sync_with_unchanged_data`, renamed the positive-trigger test to `..._and_previously_converted`), `docs/BUSINESS_RULES.md` R17 and `docs/milestones/M4.md` F-M4-9 updated to document the previous-converted requirement and why it's load-bearing.

**Verification after the fix:** ran the 3 directly-relevant test files together (39 tests: `test_partner_cascade_trigger.py`, `test_partner_deactivation_cascade.py`, `test_f_m1_2_hasura_sync.py`) — all pass, including the previously-failing test.

The other 3 failures from the full-suite run (`test_f_m2_8_children.py`, `test_delete_slot_class.py`, `test_holidays.py::test_create_holiday_end_before_start_returns_400`) and 1 error (`test_holidays.py` setup) are unrelated to partner sync — none touch `Partner`, `bulk_upsert_partners`, or any cascade table. Re-ran all 5 originally-failing tests together in isolation: 4 passed cleanly (including all 3 of these), only the hasura-sync one failed (the confirmed regression, now fixed). This strongly indicates the other 3 are pre-existing test-order-dependent flakiness in the full 747-test run, not something this feature caused. **Not re-verified against the full 747-test suite a second time** (a second ~66-minute run) given the time cost — the fix only narrows the trigger condition further (strictly reduces which partners can match, can't introduce new matches), so it cannot newly break any test that passed before.

## Skipped (per human decision, see plan Open Questions)
- Chunk 4 (dashboard visibility) — dropped. Notification trigger for this will be a separate future feature.

## Blockers
- None

## Deviations from plan
- Logging (planned as a separate pass in Chunk 3) was written inline with the Chunk 2 wiring edit instead of as a separate change — same result, just done in one edit rather than two.
- Integration tests were placed in a new file (`test_partner_cascade_trigger.py`) rather than extending `test_trigger.py`/`test_incremental_sync.py` directly, to keep the cascade-trigger concern isolated and avoid growing those two files further.
- **Trigger condition changed from the plan/spec as originally written**: added a "previously converted=True" requirement on top of "previously active=True". This was not anticipated in the plan — it was discovered via the full-suite test run and confirmed with the human before implementing. See "Bug found and fixed" above.
