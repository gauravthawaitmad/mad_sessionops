# Feature Plan: F-M8a-1 — Sync Log Foundation

## Overview

Creates the `realtime_sync_log` table — the append-only audit log that every subsequent M8a feature writes to. No other M8a feature can be built until this migration is clean. The model is self-contained; no API or frontend changes in this feature.

---

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | New | `RealtimeSyncLog` in `sessionops/models/realtime_sync_log.py` |
| Backend migrations | New | `0022_realtime_sync_log.py` |
| `models/__init__.py` | Modified | Export new model |
| Backend services | None | No service code in F-M8a-1 |
| Backend API | None | No endpoints |
| Frontend | None | No changes |
| Existing tests | None | No existing code touched |

---

## High-Level Design

`RealtimeSyncLog` is an append-only table. All M8a service code writes rows; no row is ever updated after `status` is set to its final value (except the single update from `running` → final state during processing). The model stores both structured fields (status, action_taken, event_type) and JSON blobs for audit detail (pre_snapshot, incoming_payload, field_changes, cascaded_changes).

`user_id_from_source` is NOT a FK to the local `User` table — Hasura's user_id may arrive before the local row is created (INSERT events). The FK to `triggered_by` (local User) is nullable for future automated calls.

---

## Low-Level Design

### Model: `sessionops/models/realtime_sync_log.py`

```python
from django.db import models
from django.utils import timezone

SYNC_TYPES = [
    ("manual_admin", "Manual trigger by admin"),
    ("realtime_webhook", "Realtime via n8n / webhook"),
    ("cron_fallback", "Cron-based fallback sync"),
]

EVENT_TYPES = [
    ("insert", "User created"),
    ("update", "User updated"),
    ("deactivate", "User deactivated"),
]

SYNC_STATUSES = [
    ("success", "Success"),
    ("partial_success", "Partial — common fields only, worknode cascade skipped"),
    ("failed", "Failed"),
    ("skipped_role_not_allowed", "Skipped — role not in allowlist"),
    ("skipped_no_change", "Skipped — no meaningful changes"),
    ("skipped_stale", "Skipped — incoming data older than stored"),
]

ACTIONS_TAKEN = [
    ("user_created", "New user inserted"),
    ("common_fields_updated", "Common field update only"),
    ("worknode_added", "Worknode_id added with cascade"),
    ("worknode_updated", "Worknode_id updated with cascade"),
    ("worknode_removed", "Worknode_id removed with cascade"),
    ("user_deactivated", "User deactivated with cascade"),
    ("no_change", "No action — same as before"),
    ("no_school_found_for_worknode", "Common fields updated, worknode cascade skipped"),
    ("failed", "Failed mid-processing"),
]


class RealtimeSyncLog(models.Model):
    realtime_sync_log_id = models.BigAutoField(primary_key=True)

    user_id_from_source  = models.IntegerField(db_index=True)
    sync_type            = models.CharField(max_length=30, choices=SYNC_TYPES)
    event_type           = models.CharField(max_length=20, choices=EVENT_TYPES)
    triggered_by         = models.ForeignKey(
        "User", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    external_event_id    = models.CharField(max_length=200, null=True, blank=True, db_index=True)

    received_at          = models.DateTimeField(auto_now_add=True, db_index=True)
    processed_at         = models.DateTimeField(null=True, blank=True)

    status               = models.CharField(max_length=30, choices=SYNC_STATUSES)
    action_taken         = models.CharField(max_length=40, choices=ACTIONS_TAKEN)
    error_details        = models.TextField(null=True, blank=True)

    pre_snapshot         = models.JSONField(null=True, blank=True)
    incoming_payload     = models.JSONField(null=True, blank=True)
    field_changes        = models.JSONField(null=True, blank=True)
    cascaded_changes     = models.JSONField(null=True, blank=True)
    rules_fired          = models.JSONField(null=True, blank=True)
    deferred_operations  = models.JSONField(null=True, blank=True)

    created_at           = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "realtime_sync_log"
        indexes = [
            models.Index(fields=["user_id_from_source", "received_at"]),
            models.Index(fields=["status", "received_at"]),
            models.Index(fields=["sync_type", "received_at"]),
            models.Index(fields=["external_event_id"]),
        ]
```

**FK note:** `triggered_by` uses string reference `"User"` (avoids circular import). Django resolves this at migration time.

### `models/__init__.py` — add export

```python
from sessionops.models.realtime_sync_log import RealtimeSyncLog, SYNC_TYPES, EVENT_TYPES, SYNC_STATUSES, ACTIONS_TAKEN
```

### Migration: `0022_realtime_sync_log.py`

Generated via `python manage.py makemigrations sessionops --name realtime_sync_log`.

Verify migration file:
- Creates `realtime_sync_log` table
- Adds all 4 composite and single-column indexes
- `triggered_by_id` column is nullable (FK to `sessionops_user.user_id`)
- All JSONField columns nullable
- `received_at` and `created_at` use `auto_now_add=True` (not manually set)

### `User.last_synced_at` — Pre-check (Day 1)

M8a-2 depends on `User.last_synced_at` for stale-event detection. Check on Day 1:

```bash
python manage.py shell -c "from sessionops.models import User; print([f.name for f in User._meta.get_fields()])"
```

If `last_synced_at` does not exist, add it in this migration:
```python
migrations.AddField(
    model_name="user",
    name="last_synced_at",
    field=models.DateTimeField(null=True, blank=True),
),
```
And add to User model class in `models/user.py`.

---

## Business Rules Enforced

None directly — this is schema creation. Business rules are enforced in service code written in F-M8a-2+.

---

## Security Review

- No API endpoints, no auth concerns in F-M8a-1.
- `external_event_id` is stored as-is; no code execution from this field.
- JSONField blobs are stored, not executed.

---

## Testing Strategy

### Backend unit tests: `tests/sync/test_realtime_sync_log_model.py`

```python
def test_realtime_sync_log_migration_applies():
    # If migration ran cleanly, table exists — verify via DB inspection or
    # just try inserting a row.

def test_realtime_sync_log_insert_with_minimal_fields():
    # Create log row with only required fields (status, action_taken, etc.)

def test_realtime_sync_log_insert_with_all_fields():
    # Create log row with all JSON fields populated

def test_realtime_sync_log_query_by_user_id():
    # Insert two rows with different user_id_from_source, filter, assert correct

def test_realtime_sync_log_query_by_status():
    # Insert rows with different statuses, filter by status

def test_realtime_sync_log_jsonfield_serialization():
    # Store dict in field_changes, retrieve, assert round-trip equality
    # Specifically test nested dicts and None values

def test_realtime_sync_log_triggered_by_nullable():
    # Insert with triggered_by=None (no FK error)

def test_realtime_sync_log_no_delete():
    # Confirm no soft-delete fields (is_active, removed) — this is append-only
```

### Manual verification

```bash
python manage.py migrate
python manage.py dbshell
\d realtime_sync_log   # confirm schema + indexes
```

---

## Implementation Order

1. Create `sessionops/models/realtime_sync_log.py`
2. Check User model for `last_synced_at`; add to user.py + include in migration if missing
3. Update `models/__init__.py`
4. Run `makemigrations`, inspect migration file
5. Run `migrate`
6. Write and run tests

---

## Open Questions

1. **`last_synced_at` on User** — verify Day 1 whether field exists. If missing, include in this migration.
2. **Migration number** — verify the next available migration is `0022`. Run `ls migrations/` to confirm. Adjust if M4 branch added additional migrations that haven't been accounted for.
