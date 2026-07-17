# Feature Plan: F-M8a-2 — Internal Sync Endpoint + Diff Engine + Dispatcher

## Overview

Builds the single internal endpoint that all M8a flows route through. Includes the security layer (admin JWT OR service token), request schema, diff engine that detects what actually changed, role allowlist gate, and dispatcher that routes to the correct flow handler. The endpoint is the contract surface for M8b (automated callers) and already works as-is for M8a's admin-triggered manual sync.

---

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | Read only | Uses `User`, `RealtimeSyncLog` from F-M8a-1 |
| Backend services | New | `services/realtime_sync/` package (diff, allowlist, orchestrator) |
| Backend API | New | `api/realtime_sync_api.py` |
| `routes.py` | Modified | Register new internal router under env-var path |
| Backend migrations | None | No new schema in F-M8a-2 |
| `User.last_synced_at` | May add | If not added in F-M8a-1, add migration here |
| Frontend | None | No frontend in F-M8a-2 |
| Existing tests | None | No existing code modified |

---

## High-Level Design

```
Admin UI / future n8n
        |
        | POST /api/internal/sync-user-{TOKEN}/
        v
[Auth layer]
  admin JWT  OR  service token (M8b)
        |
[Request schema validation]
  RealtimeSyncPayload (Pydantic v2)
        |
[Orchestrator]
  1. select_for_update on User row (serializes concurrent events for same user)
  2. Build pre_snapshot
  3. Diff engine → computed diff, action type
  4. Role allowlist gate (first gate before any writes)
  5. Stale event check
  6. Dispatch to flow handler (F-M8a-3, -4, -5)
  7. Write RealtimeSyncLog row
        |
[RealtimeSyncLog written]
        |
[HTTP 200 response]
  {log_id, status, action_taken, field_changes}
```

The endpoint URL segment is stored in env var `INTERNAL_SYNC_ENDPOINT_PATH` (e.g. `/sync-user-abc123`). `routes.py` reads this at startup to register the router at the correct path.

---

## Low-Level Design

### Directory: `services/realtime_sync/`

```
services/realtime_sync/
    __init__.py
    auth.py          # service token validation
    schema.py        # RealtimeSyncPayload Pydantic model
    diff.py          # diff engine
    allowlist.py     # role allowlist gate
    orchestrator.py  # main flow; dispatches to F-M8a-3/4/5 flows
```

Flow handlers (added in F-M8a-3/4/5) will be in:
```
services/realtime_sync/flows/
    __init__.py
    insert.py        # F-M8a-3
    update.py        # F-M8a-3 + F-M8a-4
    deactivate.py    # F-M8a-5
```

---

### Schema: `services/realtime_sync/schema.py`

```python
from pydantic import BaseModel
from typing import Optional

class RealtimeSyncUserPayload(BaseModel):
    # Hasura source identity
    user_id: int                       # Hasura user_id
    user_login: str
    user_display_name: Optional[str] = None
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    user_role: Optional[str] = None
    worknode_id: Optional[int] = None
    is_active: bool = True

    # Sync metadata
    event_type: str                    # "insert" | "update" | "deactivate"
    x_modified_timestamp: Optional[str] = None   # ISO8601 from Hasura updated_at
    external_event_id: Optional[str] = None      # M8b dedup key
    sync_type: str = "manual_admin"    # "manual_admin" | "realtime_webhook"

    # Caller identity
    triggered_by_user_id: Optional[int] = None   # local user_id of admin who triggered
```

**Field name convention note:** Pydantic v2's `model_config = ConfigDict(populate_by_name=True)` + `alias_generator` can map camelCase if the caller sends camelCase. Confirm caller format on Day 1 — if n8n sends snake_case, no aliasing needed.

---

### Auth: `services/realtime_sync/auth.py`

```python
import os
from sessionops.exceptions import AuthenticationError

INTERNAL_SERVICE_TOKEN = os.getenv("INTERNAL_SYNC_SERVICE_TOKEN", "")

def validate_service_token(authorization_header: str) -> bool:
    if not INTERNAL_SERVICE_TOKEN:
        return False
    expected = f"Bearer {INTERNAL_SERVICE_TOKEN}"
    return authorization_header == expected
```

The API endpoint accepts admin JWT (existing `CustomJwtAuthMiddleware`) OR service token. Pattern:
```python
@router.post("", auth=None)   # disable default JWT auth
def sync_user(request, payload: RealtimeSyncUserPayload):
    user = _resolve_auth(request)   # raises AuthenticationError if neither auth passes
    ...
```

`_resolve_auth`:
1. Try JWT — if valid admin JWT, return User
2. Try service token — if valid service token, return None (system actor)
3. Raise `AuthenticationError`

---

### Diff engine: `services/realtime_sync/diff.py`

```python
TRACKED_FIELDS = [
    "user_login", "user_display_name", "user_email", "user_phone",
    "user_role", "worknode_id", "is_active",
]

class UserDiff:
    user_exists_locally: bool
    is_reactivation: bool          # exists but is_active=False
    worknode_action: str           # "none" | "added" | "updated" | "removed"
    common_fields_changed: list    # list of {field, old, new}
    role_changed: bool
    incoming_role: str | None
    pre_snapshot: dict
    is_stale: bool                 # incoming older than stored

def compute_diff(local_user: User | None, payload: RealtimeSyncUserPayload) -> UserDiff:
    if local_user is None:
        return UserDiff(user_exists_locally=False, ...)
    
    pre_snapshot = {f: getattr(local_user, f, None) for f in TRACKED_FIELDS}
    pre_snapshot["last_synced_at"] = local_user.last_synced_at
    
    # Stale check
    if payload.x_modified_timestamp and local_user.last_synced_at:
        incoming_ts = parse_timestamp(payload.x_modified_timestamp)
        if incoming_ts < local_user.last_synced_at:
            return UserDiff(..., is_stale=True)
    
    # Compute field changes
    changes = []
    for field in TRACKED_FIELDS:
        old_val = getattr(local_user, field, None)
        new_val = getattr(payload, field_to_payload_key(field), None)
        if old_val != new_val:
            changes.append({"field": field, "old": old_val, "new": new_val})
    
    # Worknode action
    old_wn = local_user.worknode_id
    new_wn = payload.worknode_id
    if old_wn is None and new_wn is not None:
        worknode_action = "added"
    elif old_wn is not None and new_wn is None:
        worknode_action = "removed"
    elif old_wn != new_wn:
        worknode_action = "updated"
    else:
        worknode_action = "none"
    
    return UserDiff(
        user_exists_locally=True,
        is_reactivation=(not local_user.is_active),
        worknode_action=worknode_action,
        common_fields_changed=changes,
        incoming_role=payload.user_role,
        pre_snapshot=pre_snapshot,
        is_stale=False,
    )
```

---

### Allowlist: `services/realtime_sync/allowlist.py`

```python
# Roles that trigger active user processing (insert + update flows)
ACTIVE_ROLES = {
    "Youth", "Wingman", "Project Associate", "Fellow", "CHO",
    "CO Part Time", "Function Lead", "CO Full Time", "Academic Support",
    "Admin", "Project Lead",
}

# Roles (or None) that trigger deactivation
DEACTIVATE_ROLES = {"Alumni", None}

def classify_event(event_type: str, incoming_role: str | None) -> str:
    """
    Returns: "insert" | "update" | "deactivate" | "skipped"
    
    event_type from payload is a hint; role allowlist takes precedence.
    """
    if incoming_role in DEACTIVATE_ROLES:
        return "deactivate"
    if incoming_role in ACTIVE_ROLES:
        if event_type == "insert":
            return "insert"
        return "update"
    return "skipped"  # role not in any allowlist
```

---

### Orchestrator: `services/realtime_sync/orchestrator.py`

```python
from django.db import transaction
from django.utils import timezone
from sessionops.models import User, RealtimeSyncLog

def process_sync_event(
    payload: RealtimeSyncUserPayload,
    triggered_by: User | None,
) -> RealtimeSyncLog:
    
    with transaction.atomic():
        # 1. Lock the user row (serialize concurrent events for same user)
        try:
            local_user = User.objects.select_for_update().get(
                user_id=payload.user_id
            )
        except User.DoesNotExist:
            local_user = None
        
        # 2. Compute diff
        diff = compute_diff(local_user, payload)
        
        # 3. Stale check
        if diff.is_stale:
            return _write_log(payload, triggered_by, "skipped_stale", "no_change",
                              pre_snapshot=diff.pre_snapshot,
                              incoming_payload=payload.model_dump())
        
        # 4. Role allowlist gate
        classified_event = classify_event(payload.event_type, payload.user_role)
        if classified_event == "skipped":
            return _write_log(payload, triggered_by, "skipped_role_not_allowed", "no_change",
                              pre_snapshot=diff.pre_snapshot,
                              incoming_payload=payload.model_dump())
        
        # 5. No-change check (after gates)
        if (diff.user_exists_locally 
                and not diff.common_fields_changed
                and diff.worknode_action == "none"
                and classified_event != "deactivate"):
            return _write_log(payload, triggered_by, "skipped_no_change", "no_change",
                              pre_snapshot=diff.pre_snapshot)
        
        # 6. Dispatch to flow handler
        # Flow handlers imported here to avoid circular import at module level
        from sessionops.services.realtime_sync.flows import (
            handle_insert, handle_update, handle_deactivate
        )
        
        if classified_event == "insert" or diff.is_reactivation:
            result = handle_insert(local_user, payload, diff)
        elif classified_event == "deactivate":
            result = handle_deactivate(local_user, payload, diff)
        else:
            result = handle_update(local_user, payload, diff)
        
        # 7. Write log
        now = timezone.now()
        log = RealtimeSyncLog(
            user_id_from_source=payload.user_id,
            sync_type=payload.sync_type,
            event_type=payload.event_type,
            triggered_by=triggered_by,
            external_event_id=payload.external_event_id,
            processed_at=now,
            status=result.status,
            action_taken=result.action_taken,
            pre_snapshot=diff.pre_snapshot,
            incoming_payload=payload.model_dump(),
            field_changes=diff.common_fields_changed,
            cascaded_changes=result.cascaded_changes,
            rules_fired=result.rules_fired,
            deferred_operations=result.deferred_operations,
            error_details=result.error_details,
        )
        log.save()
        return log
```

---

### API endpoint: `api/realtime_sync_api.py`

```python
import os
from ninja import Router
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload
from sessionops.services.realtime_sync.auth import validate_service_token
from sessionops.services.realtime_sync.orchestrator import process_sync_event
from sessionops.exceptions import AuthenticationError
from sessionops.models import User

router = Router(tags=["internal-sync"])

@router.post("", auth=None)
def sync_user_endpoint(request, payload: RealtimeSyncUserPayload):
    triggered_by = _resolve_auth(request)
    log = process_sync_event(payload, triggered_by=triggered_by)
    return {
        "log_id": log.realtime_sync_log_id,
        "status": log.status,
        "action_taken": log.action_taken,
        "field_changes": log.field_changes,
        "cascaded_changes": log.cascaded_changes,
        "deferred_operations": log.deferred_operations,
    }

def _resolve_auth(request) -> User | None:
    auth_header = request.headers.get("Authorization", "")
    
    # Try service token first (M8b path)
    if validate_service_token(auth_header):
        return None  # system actor
    
    # Try admin JWT (M8a manual path)
    from sessionops.services.auth.middleware import get_request_user
    user = get_request_user(request)
    if user and "Admin" in user.user_role:
        return user
    
    raise AuthenticationError("Valid admin JWT or service token required")
```

---

### Route registration: `routes.py`

```python
import os
from sessionops.api.realtime_sync_api import router as realtime_sync_router

# Read endpoint path segment from env (non-obvious URL as security layer)
_internal_sync_path = os.getenv("INTERNAL_SYNC_ENDPOINT_PATH", "/sync-user-internal")

api.add_router(_internal_sync_path, realtime_sync_router)
```

**Startup assertion:** If `INTERNAL_SYNC_ENDPOINT_PATH` is not set in env, log a warning but don't crash. The route will be registered at the default fallback path, which is acceptable for dev.

---

## Business Rules Enforced

- **Role allowlist gate:** Only allowed roles can trigger active user flows. Others are skipped with logged reason.
- **Stale event skip:** Incoming data older than `last_synced_at` is silently skipped; no partial overwrites.
- **Admin-only access:** Endpoint requires admin JWT or service token. No CO/CHO access.
- **select_for_update serialization:** Two concurrent events for the same user_id cannot interleave.

---

## Security Review

- Endpoint URL is non-guessable (token in env). One layer of obscurity.
- Admin JWT is the auth gate for M8a. Service token is reserved for M8b but checked.
- Endpoint is NOT behind `CustomJwtAuthMiddleware` — uses custom `auth=None` with manual `_resolve_auth`. Verify that `auth=None` on a Django Ninja `@router.post` disables the router-level middleware for this endpoint (test this explicitly).
- JSON payload is deserialized by Pydantic v2 with type validation — no raw SQL or shell execution.
- `external_event_id` is stored, not evaluated.
- Service token from env is never logged (log only "service token auth succeeded", not the token value).
- `INTERNAL_SYNC_ENDPOINT_PATH` and `INTERNAL_SYNC_SERVICE_TOKEN` must NOT appear in any log statement.

---

## Testing Strategy

### `tests/sync/test_realtime_sync_endpoint.py`

```python
def test_endpoint_rejects_unauthenticated():
    # POST without auth header → 401

def test_endpoint_rejects_non_admin_jwt():
    # POST with CO/CHO JWT → 403 or 401

def test_endpoint_accepts_admin_jwt():
    # POST with admin JWT + valid payload → 200

def test_endpoint_accepts_service_token():
    # POST with correct INTERNAL_SYNC_SERVICE_TOKEN → 200

def test_endpoint_rejects_wrong_service_token():
    # POST with wrong token → 401

def test_role_allowlist_skips_unknown_role():
    # Payload with user_role="SomeOtherRole" → 200, status=skipped_role_not_allowed

def test_role_allowlist_allows_youth():
    # Payload with user_role="Youth" → 200, status=success or skipped_no_change

def test_role_allowlist_deactivate_on_alumni():
    # Payload with user_role="Alumni" → classified_event=deactivate

def test_stale_event_skipped():
    # User has last_synced_at=T2; payload has x_modified_timestamp=T1 (earlier) → skipped_stale

def test_no_change_skipped():
    # Payload identical to current user state → skipped_no_change

def test_log_row_written_for_every_call():
    # Call endpoint 3 times; assert 3 RealtimeSyncLog rows exist

def test_concurrent_events_serialize():
    # Two threads POST for same user_id; assert both complete, final state is deterministic
    # (integration test — may need threading.Thread + small sleep)
```

### `tests/sync/test_diff_engine.py`

```python
def test_diff_user_does_not_exist():
def test_diff_no_changes():
def test_diff_common_field_changed():
def test_diff_worknode_added():
def test_diff_worknode_removed():
def test_diff_worknode_updated():
def test_diff_is_stale_when_incoming_timestamp_older():
def test_diff_not_stale_when_no_local_timestamp():
```

### `tests/sync/test_allowlist.py`

```python
def test_all_active_roles_classified_as_update():
def test_alumni_classified_as_deactivate():
def test_null_role_classified_as_deactivate():
def test_unknown_role_classified_as_skipped():
def test_insert_event_type_with_active_role_classified_as_insert():
```

---

## Implementation Order

1. Create `services/realtime_sync/` package + stub `flows/` subpackage
2. Write `schema.py` — verify payload field names against actual Hasura sample (Day 1 task)
3. Write `auth.py` — service token validation
4. Write `diff.py` — compute_diff + TRACKED_FIELDS
5. Write `allowlist.py` — classify_event + role sets
6. Write `orchestrator.py` — main flow (flow handlers return `FlowResult(status, action_taken, ...)`)
7. Write `api/realtime_sync_api.py`
8. Register route in `routes.py`
9. Write tests
10. Manual test: POST valid payload with admin JWT → verify log row created

---

## Open Questions

1. **Payload field names from Hasura** — Day 1: fetch an actual enriched response from Hasura to confirm `x_modified_timestamp` field name and user field names (camelCase vs snake_case).
2. **`auth=None` on Django Ninja endpoint** — verify that setting `auth=None` on a `@router.post` does NOT bypass the main `api` middleware but DOES bypass any router-level auth. Check Django Ninja docs or test in isolation.
3. **`get_request_user` helper location** — the JWT token extraction from `request.auth` may be done differently; check `middleware.py` or `auth_helpers.py` for the correct import.
4. **Env var absent in prod** — if `INTERNAL_SYNC_ENDPOINT_PATH` is not set, the endpoint falls back to a default path. Decide: fail-loud (exception at startup) or fail-soft (use default)?
