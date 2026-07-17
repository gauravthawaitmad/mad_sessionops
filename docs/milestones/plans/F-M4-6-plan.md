# Feature Plan: F-M4-6 — Paginated Incremental Sync

## Overview

Replaces the M1 blanket sync (all users + partners every 6 hours) with a per-entity incremental sync. Each entity (`user`, `partner`, `partner_worknode`) gets its own `SyncRun` row per cron cycle. `user` and `partner` use a cursor (max `updated_datetime` in the local DB) to fetch only records updated since the last run. `partner_worknode` is always full-synced (no cursor, small table). Failures in one entity do not block or reset the other entities. The cron schedule changes from one 6-hour run to six daily runs at 8/10/12/14/16/18 Asia/Kolkata.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | SyncRun fields already added in F-M4-4 |
| Backend services | New | `services/sync/incremental.py` (replaces/wraps `services/sync.py`) |
| Backend services | Modified | `services/hasura/client.py` — add `fetch_users_updated_after`, `fetch_partners_updated_after` |
| Backend API endpoints | None | No new endpoints (cron-triggered only) |
| Backend schemas | None | |
| Frontend pages | None | Dashboard built in F-M4-4 |
| Frontend components | None | Runs appear automatically in the dashboard |
| Database migrations | No | Schema work done in F-M4-4 |
| Celery tasks | No | Cron-based, no Celery |
| Existing tests | Modified | Tests for `sync.py` / existing management commands need updating |
| Cron config | Modified | EC2 crontab updated on deploy |
| Documentation | No | |

## High-Level Design (HLD)

**Before (M1):** One management command (`sync_hasura`) calls one `run_sync()` that fetches all users + partners from Hasura and upserts them. Runs every 6 hours. One SyncRun row per run.

**After (M4):** Same management command entry point, but calls `run_incremental_sync()`. For each of 3 entity types:
- `user`: read cursor = `max(User.updated_datetime)`, fetch Hasura with `?updated_after=cursor`, upsert, write SyncRun
- `partner`: same pattern
- `partner_worknode`: full fetch all rows, upsert, write SyncRun (no cursor)

Each entity gets its own SyncRun row. If one entity fails, the others continue independently — the failing entity's SyncRun is marked `failed`, the others proceed.

**Cursor mechanics:**
- Cursor is derived dynamically from the DB (max `updated_datetime`) — no persistent cursor table needed
- First run (empty DB or null max): cursor = None → Hasura returns all records (treats null as "no filter" or beginning of time — confirm with Hasura endpoint behavior)
- After upsert: the new max `updated_datetime` in DB becomes the cursor for the next run automatically
- Idempotent: if cursor doesn't advance (no new records), next run fetches 0 records — still creates a SyncRun with `records_fetched=0`

**Cron change:**
- Old: `0 */6 * * *` (every 6 hours)
- New: `0 8,10,12,14,16,18 * * *` (6 specific times, Asia/Kolkata)
- New: `0 * * * *` for `check_sync_health` heartbeat (F-M4-8)

## Low-Level Design (LLD)

### Backend

#### New service: `sessionops/services/sync/incremental.py`

This is the new orchestrator, replacing/wrapping the logic in `services/sync.py`.

```python
def run_incremental_sync(sync_type: str = "auto", triggered_by=None) -> dict:
    """
    Runs sync for all 3 entities. Returns {entity_type: SyncRun | None}.
    Does NOT use @transaction.atomic at the top level — each entity has its own transaction.
    Concurrent check for manual runs only.
    """
    if sync_type == "manual":
        if SyncRun.objects.filter(status="running").exists():
            raise ConflictError("Another sync is already in progress.")

    results = {}
    for entity_type in ("user", "partner", "partner_worknode"):
        try:
            if entity_type == "partner_worknode":
                results[entity_type] = _sync_partner_worknode_full(sync_type, triggered_by)
            else:
                results[entity_type] = _sync_entity_incremental(entity_type, sync_type, triggered_by)
        except Exception:
            results[entity_type] = None  # failure logged inside helper; continue
    return results
```

**`_sync_entity_incremental(entity_type, sync_type, triggered_by)`** (wrapped in its own `transaction.atomic`):
1. `cursor = _get_cursor(entity_type)` — `Max("updated_datetime")` from User/Partner
2. Create `SyncRun(entity_type, sync_type, updated_after=cursor, status="running", triggered_by=triggered_by)`
3. Fetch from Hasura: `fetch_users_updated_after(cursor)` or `fetch_partners_updated_after(cursor)`
4. For each record: call `_upsert_user(record)` or `_upsert_partner(record)` (reuse M1 logic)
5. Build `user_logins` or `partner_ids` list
6. Update run: `status="success"`, `records_fetched=len(records)`, metadata, `completed_at=now`
7. On exception: update run `status="failed"`, `error_details=str(e)`, `completed_at=now`, re-raise

**`_sync_partner_worknode_full(sync_type, triggered_by)`** (wrapped in `transaction.atomic`):
1. Create `SyncRun(entity_type="partner_worknode", sync_type, updated_after=None, status="running")`
2. `fetch_all_partner_worknode()` — existing M3 endpoint
3. For each: `_upsert_partner_worknode(record)` — existing M3 logic
4. Update run success/failure

**`_get_cursor(entity_type)`**:
```python
from django.db.models import Max
def _get_cursor(entity_type: str):
    if entity_type == "user":
        return User.objects.aggregate(max_ts=Max("updated_datetime"))["max_ts"]
    if entity_type == "partner":
        return Partner.objects.aggregate(max_ts=Max("updated_datetime"))["max_ts"]
    return None
```

#### Modified service: `sessionops/services/hasura/client.py`

```python
def fetch_users_updated_after(timestamp=None) -> list:
    """Incremental user fetch. If timestamp is None, fetches all (first run)."""
    params = {}
    if timestamp:
        params["updated_after"] = timestamp.isoformat()
    response = requests.get(
        f"{settings.HASURA_API_BASE_URL}/api/rest/getusersupdatedafter",
        params=params,
        headers={"x-hasura-jwt": settings.HASURA_API_JWT},
        timeout=30,
    )
    response.raise_for_status()
    return response.json().get("user_data", [])

def fetch_partners_updated_after(timestamp=None) -> list:
    """Incremental partner fetch. If timestamp is None, fetches all."""
    params = {}
    if timestamp:
        params["updated_after"] = timestamp.isoformat()
    response = requests.get(
        f"{settings.HASURA_API_BASE_URL}/api/rest/partner_data",
        params=params,
        headers={"x-hasura-jwt": settings.HASURA_API_JWT},
        timeout=30,
    )
    response.raise_for_status()
    return response.json().get("partner_data", [])
```

**Existing functions to preserve:** `fetch_all_partner_worknode()` (used for `partner_worknode` full-sync) remains unchanged.

#### Modified: `sessionops/management/commands/sync_hasura.py`

```python
from sessionops.services.sync.incremental import run_incremental_sync

class Command(BaseCommand):
    help = "Run incremental Hasura sync for all entities"

    def handle(self, *args, **options):
        try:
            results = run_incremental_sync(sync_type="auto", triggered_by=None)
            for entity, run in results.items():
                if run:
                    self.stdout.write(f"{entity}: {run.status} ({run.records_fetched} records)")
                else:
                    self.stdout.write(f"{entity}: FAILED (see sync_run table)")
        except Exception as e:
            self.stderr.write(f"Sync failed: {e}")
            raise SystemExit(1)
```

#### Upsert helpers (existing M1 logic)

The upsert functions for `User` and `Partner` already exist in `services/sync.py` (likely `_upsert_user` or similar). Extract them into:
- `sessionops/services/sync/upsert.py::upsert_user_from_hasura(record: dict) -> User`
- `sessionops/services/sync/upsert.py::upsert_partner_from_hasura(record: dict) -> Partner`
- `sessionops/services/sync/upsert.py::upsert_partner_worknode_from_hasura(record: dict) -> PartnerWorknode`

This extraction makes the logic reusable across `incremental.py` and `single_user.py` (F-M4-5).

#### Cron schedule (production deploy step)

Update `/etc/cron.d/sessionops-sync` on EC2:

```
# M4 incremental sync — 6 runs/day aligned 1h after upstream pipeline
0 8,10,12,14,16,18 * * * /path/to/venv/bin/python /path/to/manage.py sync_hasura >> /var/log/sessionops-sync.log 2>&1

# Hourly health check (F-M4-8)
0 * * * * /path/to/venv/bin/python /path/to/manage.py check_sync_health >> /var/log/sessionops-health.log 2>&1
```

This is a **deploy-day step** — coordinate with backend infra access to EC2 crontab.

### Frontend

No frontend changes — runs appear automatically in the Data Sync dashboard (F-M4-4) as new `SyncRun` rows are created.

## Business Rules Enforced

- **R16 (sync idempotency):** Upsert logic is keyed on Hasura IDs — running with the same cursor twice is safe
- **No deletion handling (M4 design decision):** If a record disappears from Hasura, it stays in Session-Ops as-is
- **Concurrent sync (auto):** Auto cron runs do NOT check the running flag (only manual does). If a cron run is still in progress when the next fires, both run concurrently — this is acceptable for M4 given the short expected run time. Review if run times exceed 2 hours in production.
- **Per-entity cursor independence:** Failure of `user` sync does not affect the `partner` cursor and vice versa

## Security Review

- No new HTTP endpoints in this feature
- Hasura credentials (`HASURA_API_JWT`) are already in environment — no new secrets
- `updated_after` is a datetime value from the local DB — not user-supplied input
- Timeout of 30s on Hasura calls to prevent hung sync runs

## Testing Strategy

**Backend unit tests (`tests/services/test_incremental_sync.py`):**
- `test_first_sync_run_with_null_cursor_does_full_fetch`
- `test_subsequent_runs_use_cursor_from_max_updated_datetime`
- `test_cursor_advances_to_new_max_after_upsert`
- `test_partner_worknode_always_full_sync_null_cursor_in_run`
- `test_failure_in_user_does_not_affect_partner_entity`
- `test_incremental_sync_is_idempotent_when_cursor_unchanged`
- `test_concurrent_sync_blocked_for_manual_type`
- `test_auto_sync_not_blocked_by_running_status`
- `test_sync_handles_empty_hasura_response`
- `test_sync_handles_hasura_500_error_marks_run_failed`
- `test_sync_creates_3_sync_run_rows_per_cycle`

**Backend integration tests:**
- `test_management_command_sync_hasura_runs_successfully` (mock Hasura calls)

**Manual verification (production):**
- After deploy, confirm cursor is null → first run fetches all records
- Check `sync_run` table: 3 rows with `sync_type='auto'` after first cron execution
- Check `records_fetched` is accurate (matches count of user/partner rows)
- Second run: cursor is now set → `records_fetched` should be 0 if nothing changed in Hasura

## Milestones (implementation order)

1. **Extract upsert helpers** — Move existing upsert logic from `sync.py` to `sync/upsert.py`. Ensure M1 sync still works (regression test). (2 hr)
2. **`fetch_users_updated_after` + `fetch_partners_updated_after`** — Add to `hasura/client.py`. Manual test against Hasura. (1 hr)
3. **`incremental.py` orchestrator** — `run_incremental_sync`, `_sync_entity_incremental`, `_sync_partner_worknode_full`, `_get_cursor`. Unit tests (mock Hasura). (4 hr)
4. **Update management command** — `sync_hasura` calls `run_incremental_sync`. Smoke test locally. (1 hr)
5. **Tests** — Full unit test suite for incremental sync. (2 hr)
6. **Cron update doc** — Update deploy instructions with new crontab. (30 min)

## Open Questions

- **Existing `sync.py` structure:** Read `sessionops/services/sync.py` carefully before refactoring. Understand what the existing `run_sync()` does (is it one function or multiple? Does it already create SyncRun rows?). The upsert extraction must not break existing behavior.
- **M1 SyncRun shape:** The existing `sync_hasura` command likely creates SyncRun rows with M1 fields. After F-M4-4's migration, these rows get the new fields defaulted. Confirm the old `run_sync()` is fully replaced (not called alongside the new one).
- **`updated_after` null behavior on Hasura:** Confirm that calling `GET /getusersupdatedafter` with no `updated_after` param returns all records (not an error). Test this manually against the Hasura endpoint before implementing.
- **Hasura pagination:** Do the Hasura endpoints paginate? If they return a `limit` worth of records and there are more, the cursor approach will miss records on first run. Confirm max records returned or implement pagination loop if needed.
- **`partner_worknode` full-sync size:** Confirm the approximate row count for `partner_worknode` in production to validate "table is small enough for full-sync" assumption.
