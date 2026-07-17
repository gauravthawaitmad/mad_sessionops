# Feature Plan: F-M4-4 — Sync Admin Dashboard

## Overview

Builds the admin-only `/admin` page with a "Data Sync" tab. The tab shows: entity stats cards (user/partner/partner_worknode counts + last successful sync), a cron health badge, a master list of recent sync runs (last 50), and a detail panel for the selected run. The `SyncRun` model is extended with new fields to support per-entity tracking, run types, and cursor audit. A "Sync now" button and "Sync user by login" button are positioned in the tab header (their actions are implemented in F-M4-5 and F-M4-7 respectively). Admins also get a notification bell in the app header (notification data from F-M4-8).

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | Modified | `SyncRun` — add `sync_type`, `entity_type`, `updated_after`, `target_identifier`, `user_logins`, `partner_ids` fields |
| Backend services | New | `services/sync/dashboard.py` |
| Backend API endpoints | New | 3 endpoints under `/api/v1/admin/sync/` |
| Backend schemas | New | `schemas/sync_admin.py` |
| Frontend pages | New | `app/admin/page.tsx` |
| Frontend components | New | `AdminPage`, `DataSyncTab`, `SyncRunList`, `SyncRunDetail`, `EntityStatsCard`, `CronHealthBadge`, `NotificationBell` (shell) |
| Frontend components | Modified | App header — add "Admin" link in profile menu (admin-only); add notification bell shell |
| Database migrations | Yes | ALTER `sync_run` table; backfill `sync_type='auto'` on existing rows |
| Celery tasks | No | |
| Existing tests | Update | Any test that creates `SyncRun` rows will need the new required fields |
| Documentation | No | |

## High-Level Design (HLD)

**Admin page entry:** Header profile menu gains an "Admin" link visible only to admin-role users. Navigates to `/admin`. The page has a left tab nav (mirrors `SchoolDetailPage` layout). First tab: "Data Sync".

**Data Sync tab layout (top → bottom):**
1. Entity stats row — 3 cards (user / partner / partner_worknode), each with active/inactive/removed counts and last successful sync time
2. Cron health badge — inferred from `SyncRun` history (most recent auto success ≤ 2h ago = healthy)
3. "Sync now" button + "Sync user by login" button (actions wired in F-M4-7 and F-M4-5)
4. Master+detail panel — list of last 50 runs on left, selected run detail on right

**SyncRun extension:** New fields are nullable (or have defaults) so existing M1 rows remain valid. A data migration backfills `sync_type='auto'` and sets `entity_type` appropriately on M1 rows.

**Notification bell:** Shell is built here (bell icon in header, admin-only). The actual notification data and unread count are wired in F-M4-8. In F-M4-4, the bell renders with a zero count or empty state.

## Low-Level Design (LLD)

### Backend

#### Modified model: `sessionops/models/sync_run.py`

New fields to add:

```python
SYNC_TYPES = [
    ("auto", "Automatic (cron)"),
    ("manual", "Manual trigger"),
    ("manual_single_user", "Single user sync"),
]

ENTITY_TYPES = [
    ("user", "User data"),
    ("partner", "Partner data"),
    ("partner_worknode", "Partner Worknode"),
]

SYNC_STATUSES = [
    ("running", "Running"),
    ("success", "Success"),
    ("failed", "Failed"),
]

# New fields on existing SyncRun model:
sync_type         = models.CharField(max_length=30, choices=SYNC_TYPES, null=True, blank=True)
entity_type       = models.CharField(max_length=30, choices=ENTITY_TYPES, null=True, blank=True)
updated_after     = models.DateTimeField(null=True, blank=True)
target_identifier = models.CharField(max_length=200, null=True, blank=True)
status            = models.CharField(max_length=20, choices=SYNC_STATUSES, default="success")
# Note: started_at may already exist as a timestamp field; confirm and alias if needed
triggered_by      = models.ForeignKey("User", on_delete=models.PROTECT, null=True, related_name="+")
user_logins       = models.JSONField(null=True, blank=True)
partner_ids       = models.JSONField(null=True, blank=True)
```

Additional indexes:
```python
models.Index(fields=["sync_type", "entity_type", "status"]),
models.Index(fields=["status"]),  # for "is anything running?" check
```

#### Migration: extend `sync_run` + backfill

```python
# In migrations/XXXX_extend_sync_run.py
operations = [
    migrations.AddField("SyncRun", "sync_type", ...nullable...),
    migrations.AddField("SyncRun", "entity_type", ...nullable...),
    migrations.AddField("SyncRun", "updated_after", ...),
    migrations.AddField("SyncRun", "target_identifier", ...),
    migrations.AddField("SyncRun", "status", default="success"),
    migrations.AddField("SyncRun", "triggered_by", ...nullable FK...),
    migrations.AddField("SyncRun", "user_logins", ...JSONField...),
    migrations.AddField("SyncRun", "partner_ids", ...JSONField...),
    migrations.AddIndex(...),
    migrations.AddIndex(...),
    migrations.RunPython(backfill_m1_rows),  # sets sync_type='auto' on existing rows
]

def backfill_m1_rows(apps, schema_editor):
    SyncRun = apps.get_model("sessionops", "SyncRun")
    SyncRun.objects.filter(sync_type__isnull=True).update(sync_type="auto")
```

#### New service: `sessionops/services/sync/dashboard.py`

```python
def list_recent_runs(limit: int = 50) -> QuerySet:
    return SyncRun.objects.select_related("triggered_by").order_by("-started_at")[:limit]

def get_run_detail(sync_run_id: int) -> SyncRun:
    return SyncRun.objects.select_related("triggered_by").get(sync_run_id=sync_run_id)

def get_entity_stats() -> dict:
    # Returns counts for user, partner, partner_worknode + last_successful_sync per entity

def get_cron_health() -> dict:
    # Returns: healthy (bool), last_successful_sync_at, hours_since, next_expected_run
    # healthy = hours_since_last_auto_success <= 2
    # next_expected_run = next occurrence of 8/10/12/14/16/18 Asia/Kolkata after now
```

`get_cron_health` must only read auto-type runs for cron health assessment.

#### New schemas: `sessionops/schemas/sync_admin.py`

```python
class SyncRunListItemOut(Schema):
    sync_run_id: int
    sync_type: str | None
    entity_type: str | None
    status: str
    started_at: datetime
    completed_at: datetime | None
    records_fetched: int

class SyncRunDetailOut(Schema):
    sync_run_id: int
    sync_type: str | None
    entity_type: str | None
    updated_after: datetime | None
    target_identifier: str | None
    status: str
    started_at: datetime
    completed_at: datetime | None
    records_fetched: int
    error_details: str | None
    triggered_by_name: str | None  # triggered_by.user_name if set
    user_logins: list | None
    partner_ids: list | None

class EntityStatOut(Schema):
    total: int
    active: int
    inactive: int
    removed: int
    last_successful_sync: datetime | None

class EntityStatsOut(Schema):
    user: EntityStatOut
    partner: EntityStatOut
    partner_worknode: EntityStatOut

class CronHealthOut(Schema):
    healthy: bool
    last_successful_sync_at: datetime | None
    hours_since_last_success: float | None
    next_expected_run: datetime | None
    reason: str | None  # "no_successful_sync_ever" if never synced

class AdminStatsOut(Schema):
    entity_stats: EntityStatsOut
    cron_health: CronHealthOut
```

#### New API: `sessionops/api/admin_sync_api.py`

```python
router = Router(tags=["admin-sync"])

@router.get("/admin/sync/runs/", response={200: list[SyncRunListItemOut]}, auth=jwt_auth)
def list_sync_runs(request, limit: int = 50):
    if not request.auth.is_admin:
        raise PermissionDenied()
    return 200, list_recent_runs(limit)

@router.get("/admin/sync/runs/{sync_run_id}/", response={200: SyncRunDetailOut}, auth=jwt_auth)
def get_sync_run(request, sync_run_id: int):
    if not request.auth.is_admin:
        raise PermissionDenied()
    return 200, get_run_detail(sync_run_id)

@router.get("/admin/sync/stats/", response={200: AdminStatsOut}, auth=jwt_auth)
def get_sync_stats(request):
    if not request.auth.is_admin:
        raise PermissionDenied()
    return 200, {"entity_stats": get_entity_stats(), "cron_health": get_cron_health()}
```

Register in `urls.py`.

**RBAC note:** All admin endpoints check `request.auth.is_admin` (or equivalent role helper) — raise PermissionDenied (403) for CO/CHO.

### Frontend

#### New page: `app/admin/page.tsx`

- Server/client component that renders `<AdminPage />`
- Route guard: redirect to home if `user.role` is not admin

#### New components

- `components/admin/AdminPage.tsx`
  - Left tab nav: ["Data Sync"] (extensible for future tabs)
  - Right content: `<DataSyncTab />`
  - Header back link: navigates to `/home` or `/schools`

- `components/admin/DataSyncTab.tsx`
  - Top section: `<EntityStatsRow />` + `<CronHealthBadge />`
  - Action row: "Sync now" button (wired in F-M4-7) + "Sync user by login" button (wired in F-M4-5) — disabled/placeholder in F-M4-4
  - Master+detail: `<SyncRunList />` on left, `<SyncRunDetail />` on right
  - State: `selectedRunId` (local useState)

- `components/admin/EntityStatsRow.tsx`
  - 3 `<EntityStatCard />` for user / partner / partner_worknode

- `components/admin/EntityStatCard.tsx`
  - Shows entity name, active/inactive/removed counts, last successful sync time
  - Props: `stat: EntityStatOut, label: string`

- `components/admin/CronHealthBadge.tsx`
  - Green badge "Cron healthy" or red badge "Cron silent"
  - Shows last success timestamp + next expected run time
  - Data from `GET /admin/sync/stats/`

- `components/admin/SyncRunList.tsx`
  - Scrollable list of last 50 runs
  - Each row: timestamp, entity_type icon, sync_type badge, status badge
  - Selected row highlighted
  - Click → `onSelectRun(id)` callback

- `components/admin/SyncRunDetail.tsx`
  - Shows all fields from `SyncRunDetailOut`
  - Empty state: "Select a sync run to view details"
  - Duration computed from `started_at` and `completed_at`

#### Modified: App header

- `components/layout/Header.tsx` (or equivalent)
  - Profile dropdown: add "Admin" link only if `user.role === 'admin'` (or similar role check)
  - Add `<NotificationBell />` to header (admin-only)

- `components/layout/NotificationBell.tsx` (shell, wired fully in F-M4-8)
  - Bell icon with badge count = 0 (placeholder until F-M4-8)
  - Click opens empty dropdown for now

#### API integration: `lib/api/syncAdmin.ts`

```ts
export const listSyncRuns = (limit = 50) =>
  apiClient.get<SyncRunListItemOut[]>(`/admin/sync/runs/`, { params: { limit } });

export const getSyncRun = (runId: number) =>
  apiClient.get<SyncRunDetailOut>(`/admin/sync/runs/${runId}/`);

export const getSyncStats = () =>
  apiClient.get<AdminStatsOut>(`/admin/sync/stats/`);
```

#### State management

No Redux slice needed for dashboard data. Local state in `DataSyncTab`:
- `runs: SyncRunListItemOut[]`
- `selectedRunId: number | null`
- `selectedRunDetail: SyncRunDetailOut | null`
- `stats: AdminStatsOut | null`

Auto-refresh: poll `GET /admin/sync/runs/` every 30s while tab is visible (simple `setInterval` + cleanup on unmount).

## Business Rules Enforced

- **Admin-only access:** All 3 endpoints return 403 for CO/CHO. Frontend route redirects non-admins.
- **R9 (soft-delete):** `SyncRun` rows are never deleted — read-only dashboard view.
- **Cron health threshold:** ≤ 2h since last auto success = healthy. Hardcoded in `get_cron_health`.

## Security Review

| Endpoint | Auth | RBAC |
|----------|------|------|
| `GET /admin/sync/runs/` | JWT required | Admin only (403 for others) |
| `GET /admin/sync/runs/{id}/` | JWT required | Admin only |
| `GET /admin/sync/stats/` | JWT required | Admin only |

- `sync_run_id` is typed int — Ninja rejects non-integer
- `limit` query param: cap at 200 to prevent oversized queries (add `limit = min(limit, 200)` in service)
- `user_logins` and `partner_ids` JSON fields are stored by the sync service — no user input in this feature

## Testing Strategy

**Backend unit tests (`tests/services/test_sync_dashboard.py`):**
- `test_list_recent_runs_returns_last_50_descending`
- `test_entity_stats_counts_correctly`
- `test_cron_health_green_when_recent_auto_success`
- `test_cron_health_red_when_last_success_over_2h_ago`
- `test_cron_health_red_when_never_synced`

**Backend integration tests (`tests/api/test_admin_sync_api.py`):**
- `test_admin_dashboard_returns_200_for_admin`
- `test_admin_dashboard_returns_403_for_co`
- `test_admin_dashboard_returns_403_for_cho`
- `test_get_run_detail_returns_full_row`
- `test_list_runs_empty_state`

**Migration tests:**
- `test_m1_rows_backfilled_with_auto_sync_type` (run migration in test DB, verify existing rows)

**Frontend component tests:**
- `AdminPage` redirects non-admins
- `DataSyncTab` renders stats cards and run list
- Clicking a run in list renders detail panel
- `CronHealthBadge` shows green/red based on stats response

**Manual verification:**
- Log in as admin → header shows "Admin" link in profile menu
- Navigate to `/admin` → Data Sync tab loads, entity cards show counts
- Cron health badge shows correct state
- Click a run in the list → right panel shows full detail

## Milestones (implementation order)

1. **SyncRun migration** — Add new fields to `SyncRun`, write data migration for backfill. (2 hr)
2. **Dashboard services + API** — `list_recent_runs`, `get_run_detail`, `get_entity_stats`, `get_cron_health`. Schemas. 3 endpoints. Tests. (4 hr)
3. **Admin page + tab layout** — `/admin` route, `AdminPage`, `DataSyncTab` skeleton with placeholder content. (2 hr)
4. **Stats + health** — `EntityStatsRow`, `EntityStatCard`, `CronHealthBadge` with live data. (2 hr)
5. **Master+detail** — `SyncRunList` + `SyncRunDetail` with live data and selection. (3 hr)
6. **Header integration** — Admin link in profile menu; `NotificationBell` shell. (1 hr)
7. **Tests** — Backend + frontend tests. (2 hr)

## Open Questions

- **`SyncRun` existing fields:** Confirm the exact field names on the current `SyncRun` model (e.g. is the timestamp field `started_at` or `created_at`?). Read `sessionops/models/sync_run.py` before writing the migration.
- **Admin role check:** Confirm the exact property/method to check admin status on the `User` model (e.g. `user.is_admin`, `user.user_role == 'admin'`, or a role helper in `services/auth/role_helpers.py`).
- **`is_admin` helper:** The existing `role_helpers.py` likely has this. Confirm before writing the endpoint guards.
- **`next_expected_run` computation:** Computing the next 8/10/12/14/16/18 Asia/Kolkata slot requires timezone-aware datetime math. Use `pytz` or `zoneinfo` — confirm which is available in the project's `requirements.txt`.
- **Frontend route guard pattern:** Look at how other admin-only pages (if any) guard the route — is there a middleware, a HOC, or a redirect in the component? Use the same pattern.
