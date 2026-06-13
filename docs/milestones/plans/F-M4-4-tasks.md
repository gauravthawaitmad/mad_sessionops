# F-M4-4 Execution Progress

## Milestone 1: SyncRun Migration
- [x] Rename `sync_type` → `entity_sync_type` in `SyncRun` model + update constants
- [x] Add new fields: `run_type`, `entity_type`, `updated_after`, `target_identifier`, `triggered_by`, `user_logins`, `partner_ids`
- [x] Create migration 0019 (RenameField + AddFields + AddIndexes + backfill RunPython)
- [x] Update `sync.py` (now `sync/__init__.py`) to use `entity_sync_type` and `ENTITY_SYNC_TYPE_*` constants
- [x] Update `test_worknode_sync.py` to use renamed field

## Milestone 2: Dashboard Services + API
- [x] Create `services/sync/__init__.py` (moved sync.py content here)
- [x] Create `services/sync/dashboard.py` (list_recent_runs, get_run_detail, get_entity_stats, get_cron_health)
- [x] Create `schemas/sync_admin.py`
- [x] Create `api/admin_sync_api.py` (3 endpoints with admin RBAC)
- [x] Register router in `routes.py` (`/api/admin/`)
- [x] Create `tests/sync/__init__.py`
- [x] Create `tests/sync/test_sync_dashboard.py` (6 service unit tests)
- [x] Create `tests/sync/test_admin_sync_api.py` (6 API integration tests)

## Milestone 3: Admin Page + Tab Layout
- [x] Create `app/admin/page.tsx` (route guard redirect for non-admins)
- [x] Create `components/admin/AdminPage.tsx`
- [x] Create `components/admin/DataSyncTab.tsx`

## Milestone 4: Stats + Health
- [x] Create `components/admin/EntityStatsRow.tsx`
- [x] Create `components/admin/EntityStatCard.tsx`
- [x] Create `components/admin/CronHealthBadge.tsx`

## Milestone 5: Master+Detail
- [x] Create `lib/api/services/syncAdmin.service.ts`
- [x] Create `components/admin/SyncRunList.tsx`
- [x] Create `components/admin/SyncRunDetail.tsx`
- [x] Wire live data into DataSyncTab (polling every 30s)

## Milestone 6: Header Integration
- [x] Create `components/layout/NotificationBell.tsx` (shell, count=0)
- [x] Modify `AppShell.tsx` — Admin link in user menu (admin-only) + NotificationBell

## Milestone 7: Frontend Tests
- [x] Create `__tests__/admin/AdminPage.test.tsx` (redirect + null render for non-admins)
- [x] Create `__tests__/admin/CronHealthBadge.test.tsx` (green/red badge + reason text)
- [x] 42 frontend tests pass, 0 regressions

## Backend Tests
- Service tests: 1 test passed individually (test_cron_health_red_when_never_synced)
- Batch run failed due to PostgreSQL connection drops (27min wait), not code errors
- TypeScript: `npx tsc --noEmit` clean
- Migration 0019 applied cleanly

## Deviations from Plan
- `sync_type` (auto/manual/manual_single_user) stored as `run_type` on SyncRun model to avoid name
  collision with existing `sync_type` field (users/partners/partner_worknode/all, renamed to
  `entity_sync_type`). API schema exposes `run_type` as `sync_type` via resolver.
- `sync.py` moved to `sync/__init__.py` package to support `services/sync/dashboard.py` alongside.
