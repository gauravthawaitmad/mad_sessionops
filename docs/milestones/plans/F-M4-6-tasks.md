# F-M4-6 Execution Progress

## Milestone 1: Extract Upsert Helpers
- [x] Create `services/sync/upsert.py` (parsing helpers + bulk upsert functions)
- [x] Update `services/sync/__init__.py` to import from `upsert.py`; keep M1 `run_sync()` for compat
- [x] Update `services/sync/single_user.py` to import directly from `upsert.py`

## Milestone 2: Hasura Client Additions
- [x] Add `fetch_users_updated_after(timestamp=None)` → `GET /api/rest/getusersupdatedafter`
- [x] Add `fetch_partners_updated_after(timestamp=None)` → `GET /api/rest/partner_data` (no fallback date)

## Milestone 3: Incremental Orchestrator
- [x] Create `services/sync/incremental.py`
  - [x] `_get_user_cursor()` — Max("synced_at") from User
  - [x] `_get_partner_cursor()` — Max("synced_at") from Partner.all_objects
  - [x] `_sync_users(run_type, triggered_by)` — cursor-based, per-entity SyncRun
  - [x] `_sync_partners(run_type, triggered_by)` — cursor-based, per-entity SyncRun
  - [x] `_sync_partner_worknode(run_type, triggered_by)` — full-sync, updated_after=None
  - [x] `run_incremental_sync(run_type, triggered_by)` — orchestrator, failure-isolated per entity

## Milestone 4: Update Management Command
- [x] `management/commands/sync_hasura.py` updated to call `run_incremental_sync`

## Milestone 5: Tests
- [x] Create `tests/sync/test_incremental_sync.py` (11 backend unit tests)
- [x] `test_cursor_is_null_when_no_users` — confirmed passing (3m 15s, DB connection latency)
- [x] 46/46 frontend tests pass, 0 regressions
- [x] All imports verified clean (`python -c "from ... import ..."`)
- [x] `makemigrations --check` clean (no new migrations needed — model changes were in F-M4-4)

## Deviations from Plan
- Cursor field for User: `synced_at` (no `updated_datetime` on User model; `synced_at` is the Hasura-sync timestamp)
- Cursor field for Partner: `synced_at` (consistent approach; `partner_updated_date` can be null on many rows)
- `transaction.atomic` NOT used on entity helpers (SyncRun status=failed must persist on exception)
- `fetch_partners_updated_after` uses same URL as `fetch_partners` but without the hardcoded 2006 fallback; uses `prod_external_apps_partner_data` key (same as existing endpoint)
- `users_fetched`/`partners_fetched` model fields used (no generic `records_fetched` field exists)
- Existing `run_sync()` + `_bulk_upsert_users` + `_run_partner_worknode_phase` kept in `__init__.py` as re-exports for backward compat with M1 tests
