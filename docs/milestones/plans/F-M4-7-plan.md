# Feature Plan: F-M4-7 — Manual Sync Trigger UI

## Overview

Wires the "Sync now" button on the Data Sync tab to trigger all 3 entity syncs with `run_type="manual"`. Because sync duration is unknown (Hasura call time varies), the trigger is **async**: the endpoint pre-creates 3 `SyncRun(status=running)` rows in the HTTP request thread, fires a `threading.Thread` for the actual Hasura work, and returns immediately with the 3 run IDs. The frontend switches from 30s to 3s adaptive polling — the run list shows live `running → success/failed` transitions as each entity finishes. No Celery, no SSE, no ASGI changes — fully within the existing Django WSGI + Gunicorn stack.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | SyncRun fields already in place from F-M4-4 |
| Backend services | New | `services/sync/trigger.py` — pre-create runs + background thread |
| Backend API endpoints | Modified | Add `POST /sync/trigger/` to `admin_sync_api.py` |
| Backend schemas | Modified | Add `SyncTriggerOut` to `schemas/sync_admin.py` |
| Frontend services | Modified | Add `triggerManualSync()` to `syncAdmin.service.ts` |
| Frontend components | Modified | `DataSyncTab.tsx` — wire button, `isSyncing` state, adaptive poll |
| Database migrations | No | |
| Celery tasks | No | `threading.Thread` used (Celery dropped from M4 scope) |
| Existing tests | None | |

## High-Level Design (HLD)

### Data flow

```
Admin clicks "Sync now"
  ↓
POST /api/admin/sync/trigger/
  → Check: any SyncRun status=running? → 409 ConflictError if yes
  → Create user_run   (status=running, run_type=manual, entity_type=user)          ← HTTP request thread
  → Create partner_run (status=running, run_type=manual, entity_type=partner)
  → Create pw_run      (status=running, run_type=manual, entity_type=partner_worknode)
  → threading.Thread(target=_background, daemon=True).start()
  → return 200 { user_run_id, partner_run_id, partner_worknode_run_id }            ← immediate return

Background thread:
  → get user cursor → fetch Hasura users → bulk upsert → update user_run (success/failed)
  → get partner cursor → fetch Hasura partners → bulk upsert → update partner_run
  → fetch chapter_mapping → upsert PWs → delete removed → update pw_run
  → connection.close()

Frontend after 200:
  → setTriggerPending(true)  [button disabled + spinner immediately on click]
  → API returns → setTriggerPending(false), call load() immediately
  → load() finds 3 status=running rows (already in DB) → hasRunningSync=true
  → isSyncing = triggerPending || hasRunningSync → true → button stays disabled
  → fast poll (3s) kicks in, updates run list every 3s
  → as entity runs settle to success/failed → badges update
  → when hasRunningSync = false → isSyncing = false → button re-enables, slow poll (30s) resumes
  → on 409: toast "Another sync is in progress. Try again in a moment."
```

### Why pre-create SyncRun rows in the HTTP request thread

If the thread creates the rows (as `run_incremental_sync` normally does), there is a ~100ms race between endpoint return and thread first DB write. If `load()` fires in that gap, it finds zero running rows — `isSyncing` briefly drops to false, button flickers. Pre-creating the 3 rows before spawning the thread eliminates this entirely: the rows are in the DB before the endpoint returns, so `load()` always finds them.

### Why polling over SSE for this stack

The backend is Django + Ninja on WSGI (Gunicorn). SSE keeps an HTTP connection open for the duration of the sync, holding one Gunicorn worker thread hostage the whole time. Two simultaneous SSE connections from two admins tie up two workers. For a feature used a few times per day, the ≤3s polling lag is imperceptible on a 30–120s sync. SSE would require ASGI (Daphne/Uvicorn) migration — not warranted here.

### Threading + Django DB connections

Django connections are per-thread (thread-local). The background thread gets its own connection on first DB access. `django_connection.close()` in the `finally` block releases it. The upsert loop inside the sync helpers already calls `close_old_connections()` between batches.

## Low-Level Design (LLD)

### Backend

#### New service: `sessionops/services/sync/trigger.py`

```python
import logging
import threading
from django.db import connection as django_connection, close_old_connections
from django.utils import timezone as dj_timezone

from sessionops.exceptions import ConflictError
from sessionops.models import SyncRun, User
from sessionops.services.hasura.client import (
    fetch_chapter_mapping, fetch_users_updated_after, fetch_partners_updated_after,
)
from sessionops.services.sync.incremental import _get_user_cursor, _get_partner_cursor
from sessionops.services.sync.upsert import (
    BATCH_SIZE, bulk_upsert_users, bulk_upsert_partners, upsert_partner_worknode_row,
)

logger = logging.getLogger(__name__)


def trigger_manual_sync(triggered_by: User) -> dict:
    """
    Pre-creates 3 SyncRun(status=running) rows, fires a background daemon thread,
    returns {user_run_id, partner_run_id, partner_worknode_run_id} immediately.
    Raises ConflictError(409) if any sync is already running.
    """
    if SyncRun.objects.filter(status=SyncRun.STATUS_RUNNING).exists():
        raise ConflictError("Another sync is already in progress. Try again in a moment.")

    common = dict(
        run_type=SyncRun.RUN_TYPE_MANUAL,
        status=SyncRun.STATUS_RUNNING,
        triggered_by=triggered_by,
    )
    user_run = SyncRun.objects.create(
        entity_type=SyncRun.ENTITY_TYPE_USER,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_USERS,
        **common,
    )
    partner_run = SyncRun.objects.create(
        entity_type=SyncRun.ENTITY_TYPE_PARTNER,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_PARTNERS,
        **common,
    )
    pw_run = SyncRun.objects.create(
        entity_type=SyncRun.ENTITY_TYPE_PARTNER_WORKNODE,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_PARTNER_WORKNODE,
        **common,
    )

    def _background():
        close_old_connections()  # discard stale parent-thread connections
        try:
            _execute_user_sync(user_run)
            _execute_partner_sync(partner_run)
            _execute_partner_worknode_sync(pw_run)
        except Exception as exc:
            # Belt-and-suspenders: mark any still-running runs as failed
            for r in (user_run, partner_run, pw_run):
                r.refresh_from_db()
                if r.status == SyncRun.STATUS_RUNNING:
                    r.status = SyncRun.STATUS_FAILED
                    r.error_message = f"Thread error: {exc}"
                    r.completed_at = dj_timezone.now()
                    r.save(update_fields=["status", "error_message", "completed_at"])
            logger.error("trigger_manual_sync: background thread failed — %s", exc)
        finally:
            django_connection.close()

    threading.Thread(target=_background, daemon=True).start()

    return {
        "user_run_id":             user_run.id,
        "partner_run_id":          partner_run.id,
        "partner_worknode_run_id": pw_run.id,
    }
```

**`_execute_user_sync(run: SyncRun)`** — fetches, upserts, updates the pre-created run:
```python
def _execute_user_sync(run: SyncRun) -> None:
    try:
        cursor = _get_user_cursor()
        run.updated_after = cursor
        run.save(update_fields=["updated_after"])

        rows = fetch_users_updated_after(cursor)
        total = len(rows)
        total_created = total_updated = 0
        now = dj_timezone.now()

        for batch_start in range(0, max(total, 1), BATCH_SIZE):
            close_old_connections()
            batch = rows[batch_start:batch_start + BATCH_SIZE]
            if not batch:
                break
            c, u = bulk_upsert_users(batch, now)
            total_created += c
            total_updated += u

        run.status = SyncRun.STATUS_SUCCESS
        run.users_fetched = total
        run.users_created = total_created
        run.users_updated = total_updated
        run.completed_at = dj_timezone.now()
        run.save(update_fields=[
            "status", "users_fetched", "users_created", "users_updated", "completed_at",
        ])
    except Exception as exc:
        run.status = SyncRun.STATUS_FAILED
        run.error_message = str(exc)
        run.completed_at = dj_timezone.now()
        run.save(update_fields=["status", "error_message", "completed_at"])
        logger.error("trigger: user sync failed — %s", exc)
        # Does NOT re-raise — partner and pw_sync still run
```

**`_execute_partner_sync(run: SyncRun)`** — same pattern, `_get_partner_cursor()`, `fetch_partners_updated_after`, `bulk_upsert_partners`, updates `partners_fetched/created/updated`.

**`_execute_partner_worknode_sync(run: SyncRun)`** — full sync, no cursor:
- `fetch_chapter_mapping()` → upsert each via `upsert_partner_worknode_row` → delete removed rows → update run.

All 3 helpers fail independently — a failure in user sync does not stop partner or pw sync.

#### New schema: add to `sessionops/schemas/sync_admin.py`

```python
class SyncTriggerOut(Schema):
    user_run_id:             int
    partner_run_id:          int
    partner_worknode_run_id: int
```

#### New endpoint: add to `sessionops/api/admin_sync_api.py`

```python
from sessionops.schemas.sync_admin import SyncTriggerOut
from sessionops.services.sync.trigger import trigger_manual_sync as _trigger_manual_sync

@admin_sync_router.post(
    "/sync/trigger/",
    response={200: SyncTriggerOut, 403: ErrorResponseSchema, 409: ErrorResponseSchema},
)
def trigger_sync(request):
    _require_admin(request.auth)
    result = _trigger_manual_sync(triggered_by=request.auth)
    return 200, result
```

`ConflictError` from `trigger_manual_sync` is handled by the existing Ninja exception handler → 409.
`PermissionDenied` from `_require_admin` → 403.

### Frontend

#### Add to `lib/api/services/syncAdmin.service.ts`

```ts
export interface SyncTriggerOut {
  userRunId:            number;
  partnerRunId:         number;
  partnerWorknodeRunId: number;
}

interface RawSyncTriggerOut {
  user_run_id:             number;
  partner_run_id:          number;
  partner_worknode_run_id: number;
}

export async function triggerManualSync(): Promise<SyncTriggerOut> {
  const raw = await api.post<RawSyncTriggerOut>('/admin/sync/trigger/', {});
  return {
    userRunId:            raw.user_run_id,
    partnerRunId:         raw.partner_run_id,
    partnerWorknodeRunId: raw.partner_worknode_run_id,
  };
}
```

#### Modified: `components/admin/DataSyncTab.tsx`

**New state:**
```ts
const [triggerPending, setTriggerPending] = useState(false);
```

**Derived (no new useState — computed from existing `runs`):**
```ts
const hasRunningSync = runs.some(r => r.status === 'running');
const isSyncing      = triggerPending || hasRunningSync;
```

**Adaptive fast poll — layered on the existing 30s interval:**
```ts
// Added alongside the existing slow-poll useEffect — does NOT replace it.
useEffect(() => {
  if (!isSyncing) return;                       // only active while syncing
  const id = setInterval(load, 3_000);
  return () => clearInterval(id);
}, [isSyncing, load]);
```

The existing 30s `setInterval` in the existing `useEffect` stays unchanged. No restarting of intervals.

**Handler:**
```ts
const handleSyncNow = useCallback(async () => {
  setTriggerPending(true);
  try {
    await triggerManualSync();
    load();   // immediate poll — 3 running rows are already in DB
  } catch (err: any) {
    const status = err?.response?.status ?? err?.status;
    if (status === 409) {
      toast.error('Another sync is in progress. Try again in a moment.');
    } else {
      toast.error('Failed to start sync. Please try again.');
    }
  } finally {
    setTriggerPending(false);
    // hasRunningSync takes over after the immediate load() above
  }
}, [load]);
```

**"Sync now" button (replace existing `disabled` placeholder):**
```tsx
<Button
  variant="outlined"
  size="small"
  startIcon={
    isSyncing
      ? <CircularProgress size={12} color="inherit" />
      : <RefreshCw size={14} />
  }
  onClick={handleSyncNow}
  disabled={isSyncing}
  sx={{ fontSize: '12px' }}
>
  {isSyncing ? 'Syncing…' : 'Sync now'}
</Button>
```

**"Sync user by login" button** — disable while `hasRunningSync` (concurrent sync blocked by 409 guard anyway; disabling gives cleaner UX):
```tsx
disabled={hasRunningSync}
```

#### State flow walkthrough

1. Admin clicks "Sync now" → `triggerPending=true` → button disabled immediately
2. `triggerManualSync()` resolves → `load()` runs immediately
3. `load()` returns 3 `status=running` rows → `hasRunningSync=true`
4. `triggerPending=false` (from `finally`) → `isSyncing = false || true = true` → button stays disabled
5. Fast poll (3s) starts (from the `isSyncing` effect)
6. Each entity finishes → poll returns updated rows → badges update in `SyncRunList`
7. All 3 rows `success/failed` → `hasRunningSync=false` → `isSyncing=false` → button re-enables, fast poll stops

## Business Rules Enforced

- **Admin-only:** `_require_admin` in endpoint — CO/CHO get 403.
- **Concurrent sync guard (decision 16 in M4 spec):** `SyncRun.objects.filter(status=running).exists()` checked before pre-creating runs. Raises ConflictError → 409. Checked in the HTTP request thread before thread spawn.
- **Manual runs tagged:** `run_type=manual`, `triggered_by=<admin_user>` on all 3 SyncRun rows — visible in dashboard detail.
- **R16 (idempotent upsert):** Reuses `bulk_upsert_users`, `bulk_upsert_partners`, `upsert_partner_worknode_row` from `upsert.py` — all keyed on Hasura IDs.

## Security Review

| Endpoint | Auth | RBAC |
|----------|------|------|
| `POST /admin/sync/trigger/` | JWT required | Admin only — 403 for CO/CHO |

- No request body — zero injection surface.
- Concurrent guard prevents DoS via run-spamming: first request starts a sync; subsequent requests get 409 until sync completes.
- Background thread is `daemon=True`: process shutdown kills it rather than hanging deploy.

## Testing Strategy

**Backend unit tests (`tests/sync/test_trigger.py`):**
- `test_trigger_creates_3_running_sync_runs_before_thread_starts`
  - Mock `threading.Thread.start` to no-op; assert 3 `status=running` rows exist after call
- `test_trigger_returns_correct_run_ids`
- `test_trigger_returns_409_when_any_sync_running`
  - Pre-create a running SyncRun; assert ConflictError raised
- `test_trigger_returns_403_for_non_admin` (via API integration)
- `test_execute_user_sync_marks_run_success`
  - Mock `fetch_users_updated_after` returning 1 row; assert `run.status=success, run.users_fetched=1`
- `test_execute_user_sync_marks_run_failed_on_hasura_error`
  - Mock `fetch_users_updated_after` raising HasuraError; assert `run.status=failed, run.error_message` set
- `test_execute_syncs_are_independent`
  - User sync raises; assert partner_run still reaches success

**Backend integration tests (add to `tests/sync/test_admin_sync_api.py`):**
- `test_post_trigger_returns_200_for_admin` — mock `trigger_manual_sync`
- `test_post_trigger_returns_403_for_co`
- `test_post_trigger_returns_409_when_running`

**Frontend component tests (`__tests__/admin/DataSyncTab.test.tsx`):**
- "Sync now" button calls `triggerManualSync()` on click
- Button shows "Syncing…" + CircularProgress when `isSyncing=true`
- Button re-enables when `runs` contains no `status=running` entries
- Toast `toast.error` shown on 409

**Manual verification:**
- Click "Sync now" → button disables instantly
- Within 3s: run list shows 3 new `running` rows (user / partner / partner_worknode)
- Each row badge flips to `success` / `failed` as sync completes
- All 3 rows have `run_type=manual` in detail panel
- Run detail shows `triggered_by = <admin display name>`
- Click "Sync now" while sync in progress → toast "Another sync is in progress"
- CO/CHO user → no Admin link in menu → cannot reach `/admin`

## Milestones (implementation order)

1. **Backend service + endpoint** — `trigger.py` with `trigger_manual_sync`, the 3 `_execute_*` helpers, `SyncTriggerOut` schema, `POST /sync/trigger/` endpoint. Unit tests + API tests. (~2 hr)
2. **Frontend wiring** — `triggerManualSync()` in service file. `DataSyncTab` adaptive poll, `isSyncing` derived state, `handleSyncNow`, button wiring, "Sync user by login" disable-while-running. Frontend tests. (~1.5 hr)

## Open Questions

- **Stale connections on thread start:** Django docs recommend `close_old_connections()` at the top of any spawned thread so it doesn't inherit a stale connection from the parent. This is already included in the `_background` function above. Confirm this is sufficient or whether `django.db.reset_queries()` is also needed.
- **Running runs stuck on Gunicorn restart:** If Gunicorn does a rolling restart while a background thread is active, `daemon=True` kills the thread mid-sync. The 3 `SyncRun` rows stay `status=running` forever. Consequence: the 409 guard blocks all future manual syncs until someone manually fixes the DB. Mitigation (deploy procedure): a startup hook or `on_starting` Gunicorn hook that sets any `status=running` SyncRun rows to `status=failed` with `error_message="Process restarted"`. Flag as a known deploy risk; document in runbook.
- **`isSyncing` also blocks "Sync user by login":** When a full sync is running, the "Sync user by login" button is disabled in the UI. But the endpoint allows it if the user somehow bypasses the UI — the 409 guard in `single_user.py` will block it server-side. The UI disable is a UX convenience, not a security control.
