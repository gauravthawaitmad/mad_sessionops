# F-M8a-2 Execution Progress

## Discoveries (pre-code checks)

- **User model field deviations** (from F-M8a-1 tasks):
  - `email` not `user_email` → diff TRACKED_FIELDS uses `email`; mapped to `user_email` in payload
  - `contact` not `user_phone` → diff TRACKED_FIELDS uses `contact`; mapped to `user_phone` in payload
  - `synced_at` not `last_synced_at` → stale-event check uses `user.synced_at`
- **Auth pattern**: `user_has_admin_access()` from `role_helpers` is the established check; plan's literal `"Admin" in user_role` is not used — ADMIN_ROLES has Function Lead / Project Associate / Project Lead
- **Route path**: `api.add_router(_internal_sync_path, router)` + `@router.post("")` → URL = `_internal_sync_path`
- **auth=None on route**: disables CustomJwtAuthMiddleware for that route; _resolve_auth handles auth manually

## Milestone 1: Service package — schema, auth, diff, allowlist

- [x] Create `services/realtime_sync/__init__.py`
- [x] Create `services/realtime_sync/schema.py` — RealtimeSyncUserPayload
- [x] Create `services/realtime_sync/auth.py` — service token validation
- [x] Create `services/realtime_sync/diff.py` — compute_diff + UserDiff + TRACKED_FIELDS
- [x] Create `services/realtime_sync/allowlist.py` — classify_event + role sets

## Milestone 2: Flow stubs + orchestrator

- [x] Create `services/realtime_sync/flows/__init__.py` — FlowResult dataclass + stub handlers
- [x] Create `services/realtime_sync/orchestrator.py` — process_sync_event + _write_log

## Milestone 3: API endpoint + route registration

- [x] Create `api/realtime_sync_api.py` — router + sync_user_endpoint + _resolve_auth
- [x] Modify `routes.py` — import router, register under env-var path

## Milestone 4: Tests

- [x] Create `tests/sync/test_diff_engine.py`
- [x] Create `tests/sync/test_allowlist.py`
- [x] Create `tests/sync/test_realtime_sync_endpoint.py`
- [x] Run test_diff_engine.py — 17/17 pass
- [x] Run test_allowlist.py — 33/33 pass
- [x] Run test_realtime_sync_endpoint.py — 15/15 pass
- [x] `just lint` (ruff check) — all checks passed
- [x] `ruff format` — 8 files reformatted cleanly

## Bugs found and fixed

- **`pre_snapshot["synced_at"]` not JSON-serializable** — Django's `JSONField` uses
  standard `json.JSONEncoder` by default (not `DjangoJSONEncoder`), so `datetime`
  objects in the pre_snapshot dict caused a 500. Fixed by serialising `synced_at` to
  ISO string in `diff.py` before storing in the snapshot dict.

## Blockers
- None

## Done

F-M8a-2 complete. 65/65 tests pass. All lint clean.
