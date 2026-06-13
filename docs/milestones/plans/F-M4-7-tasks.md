# F-M4-7 Execution Progress

## Milestone 1: Backend Service + Endpoint
- [x] Create `services/sync/trigger.py`
- [x] Add `SyncTriggerOut` to `schemas/sync_admin.py`
- [x] Add `POST /sync/trigger/` to `api/admin_sync_api.py`
- [x] Create `tests/sync/test_trigger.py` (8 unit tests)
- [x] Add 3 API integration tests to `tests/sync/test_admin_sync_api.py`
- [x] Backend test confirmed passing (test_trigger_returns_409_when_any_sync_running)

## Milestone 2: Frontend Wiring
- [x] Add `triggerManualSync()` + `SyncTriggerOut` to `lib/api/services/syncAdmin.service.ts`
- [x] Update `DataSyncTab.tsx`:
  - [x] `triggerPending` state + `isSyncing`/`hasRunningSync` derived values
  - [x] `handleSyncNow` callback (trigger → immediate load → fast poll takes over)
  - [x] Adaptive poll: POLL_SLOW=30s always, POLL_FAST=3s layered while isSyncing
  - [x] "Sync now" button: disabled+spinner+label when isSyncing
  - [x] "Sync user by login" button: disabled while hasRunningSync
- [x] Create `__tests__/admin/DataSyncTab.test.tsx` (5 component tests)
- [x] 51/51 frontend tests pass, 0 regressions
- [x] TypeScript: `npx tsc --noEmit` clean
- [x] No new migrations (model unchanged)

## Blockers
- None

## Deviations from Plan
- None — implemented exactly as planned.
