# Feature Plan: F-M8a-3 — User Create + Common Field Update Flows

## Overview

Implements the two simplest flow handlers that the F-M8a-2 orchestrator dispatches to: `handle_insert` (new user or re-activation) and `handle_update` for the common-fields-only case (no worknode_id change). After this feature, the endpoint is end-to-end testable for the most common case: a user's profile fields change, and the diff gets recorded.

---

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| `services/realtime_sync/flows/insert.py` | New | INSERT + re-activation flow |
| `services/realtime_sync/flows/update.py` | New | UPDATE (common-fields-only, worknode unchanged) |
| `services/realtime_sync/flows/__init__.py` | New | Exports `handle_insert`, `handle_update`, `handle_deactivate` (deactivate stub) |
| `User.synced_at` | Requires | Must exist before F-M8a-3 (confirmed present from F-M8a-1) |
| Backend models | Read + write | `User`, `RealtimeSyncLog` |
| Backend migrations | None | No new model fields (assuming F-M8a-1 added `last_synced_at`) |
| Frontend | None | No frontend in F-M8a-3 |
| Existing tests | None | No existing code modified |

---

## High-Level Design

```
orchestrator.py calls handle_insert or handle_update
        |
[Flow handler]
  1. Update User row fields in DB
  2. Set User.last_synced_at = now()
  3. Return FlowResult(status, action_taken, field_changes, cascaded_changes=[])
        |
orchestrator.py writes RealtimeSyncLog row
```

Both flows are inside the same `transaction.atomic()` opened by the orchestrator. Flow handlers do NOT open their own transactions — they rely on the orchestrator's transaction context.

Re-activation (existing user with `is_active=False`) is handled by `handle_insert` — it updates the existing row instead of creating a new one.

---

## Low-Level Design

### `FlowResult` dataclass (defined once, used by all flows)

Add to `services/realtime_sync/orchestrator.py` or a new `services/realtime_sync/types.py`:

```python
from dataclasses import dataclass, field

@dataclass
class FlowResult:
    status: str                           # from SYNC_STATUSES
    action_taken: str                     # from ACTIONS_TAKEN
    cascaded_changes: list = field(default_factory=list)
    rules_fired: list = field(default_factory=list)
    deferred_operations: dict | None = None
    error_details: str | None = None
```

---

### Common fields helper

Define once in `services/realtime_sync/utils.py`:

```python
def apply_common_fields(user: User, payload: RealtimeSyncUserPayload, now) -> None:
    """
    Write all non-worknode user fields from payload to the local user row.
    Does NOT save — caller calls user.save() after.
    """
    user.user_login        = payload.user_login
    user.user_display_name = payload.user_display_name
    user.email             = payload.user_email       # User.email ↔ payload.user_email
    user.contact           = payload.user_phone       # User.contact ↔ payload.user_phone
    user.user_role         = payload.user_role
    user.is_active         = True
    user.synced_at         = now                      # User.synced_at (not last_synced_at)

    # Location / org hierarchy
    user.city                         = payload.city
    user.center                       = payload.center
    user.state                        = payload.state
    user.reporting_manager_user_login = payload.reporting_manager_user_login
    user.reporting_manager_role_code  = payload.reporting_manager_role_code
    user.reporting_manager_user_id    = payload.reporting_manager_user_id
```

**Note:** `worknode_id` is NOT set here. Worknode changes are applied only by the F-M8a-4 flow handlers. This prevents common-field updates from accidentally overwriting worknode_id state.

---

### INSERT flow: `services/realtime_sync/flows/insert.py`

```python
from django.utils import timezone
from sessionops.models import User
from sessionops.services.realtime_sync.flows import FlowResult
from sessionops.services.realtime_sync.utils import apply_common_fields

def handle_insert(
    local_user: User | None,
    payload: RealtimeSyncUserPayload,
    diff: UserDiff,
    user_id: int,           # from URL path — not in payload body
) -> FlowResult:
    now = timezone.now()

    if local_user is None:
        # True INSERT — create new user row
        user = User(user_id=user_id)
        apply_common_fields(user, payload, now)
        user.worknode_id = payload.worknode_id  # set worknode_id on creation
        user.save()
    else:
        # Re-activation — update existing row
        apply_common_fields(local_user, payload, now)
        local_user.worknode_id = payload.worknode_id
        local_user.save()

    return FlowResult(
        status="success",
        action_taken="user_created",
    )
```

**Note on re-activation:** The spec classifies re-activation under INSERT because `diff.is_reactivation=True` (user exists but `is_active=False`). Re-activation sets `is_active=True`, writes all common fields, and resets worknode_id. Whether to also cascade worknode changes on re-activation is out of scope — treat it as a simple field write.

---

### UPDATE (common fields) flow: `services/realtime_sync/flows/update.py`

This file handles two cases:
1. Common fields changed, worknode_id unchanged → `common_fields_updated`
2. Worknode changed → delegates to worknode flow handlers (added in F-M8a-4)

In F-M8a-3, only case 1 is implemented. Case 2 is a placeholder stub.

```python
from django.utils import timezone
from sessionops.services.realtime_sync.flows import FlowResult
from sessionops.services.realtime_sync.utils import apply_common_fields

def handle_update(
    local_user: User,
    payload: RealtimeSyncUserPayload,
    diff: UserDiff,
    user_id: int,           # from URL path — not in payload body
) -> FlowResult:
    now = timezone.now()

    if diff.worknode_action != "none":
        # F-M8a-4 will implement these — raise until then
        # (orchestrator should not dispatch here with worknode change until F-M8a-4 is done)
        from sessionops.services.realtime_sync.flows.cascade import handle_worknode_change
        return handle_worknode_change(local_user, payload, diff, now)

    # Common fields only
    apply_common_fields(local_user, payload, now)
    local_user.save()

    return FlowResult(
        status="success",
        action_taken="common_fields_updated",
    )
```

**Stub for worknode change (replaced in F-M8a-4):**

```python
# services/realtime_sync/flows/cascade.py — created as stub in F-M8a-3
def handle_worknode_change(local_user, payload, diff, now) -> FlowResult:
    raise NotImplementedError("Worknode cascade flows not yet implemented (F-M8a-4)")
```

This stub ensures the codebase is importable before F-M8a-4 is written.

---

### `services/realtime_sync/flows/__init__.py`

This file already exists from F-M8a-2 with `FlowResult` dataclass and stubs. F-M8a-3 replaces the stub implementations with real imports:

```python
from dataclasses import dataclass, field
from typing import Optional

@dataclass
class FlowResult:
    status: str
    action_taken: str
    cascaded_changes: list = field(default_factory=list)
    rules_fired: list = field(default_factory=list)
    deferred_operations: Optional[dict] = None
    error_details: Optional[str] = None


def handle_insert(local_user, payload, diff, user_id):
    from sessionops.services.realtime_sync.flows.insert import handle_insert as _real
    return _real(local_user, payload, diff, user_id)

def handle_update(local_user, payload, diff, user_id):
    from sessionops.services.realtime_sync.flows.update import handle_update as _real
    return _real(local_user, payload, diff, user_id)

def handle_deactivate(local_user, payload, diff, user_id):
    # Stub — filled in F-M8a-5
    return FlowResult(status="success", action_taken="user_deactivated")
```

Alternatively, import directly from the submodules and update the orchestrator call sites to pass `user_id`. Either approach is fine — pick one and be consistent.

---

## Business Rules Enforced

- **`synced_at` always updated on write.** Ensures stale-event detection stays accurate for future events. Field name is `synced_at` on the User model (not `last_synced_at`).
- **`worknode_id` not modified in common-field update.** Only F-M8a-4 writes `worknode_id` to the user row. This prevents a common-field sync from silently clearing worknode state.
- **Re-activation treated as INSERT.** Reactivating a soft-deleted user resets all fields including worknode_id from the payload (fresh state).
- **All writes happen inside orchestrator's `transaction.atomic()`.** Flow handler failures roll back user update and prevent partial log writes.

---

## Security Review

- Flow handlers have no auth logic — that's done in the endpoint layer (F-M8a-2). Flows are internal service functions.
- `user_id` from payload is used directly to query/create local User. The payload is validated by Pydantic before reaching the flow.
- No user-controlled data is passed to shell commands or raw SQL.

---

## Testing Strategy

### `tests/sync/test_insert_flow.py`

```python
def test_handle_insert_creates_new_user():
    # Call handle_insert(local_user=None, payload, diff, user_id=uid)
    # Assert User.objects.get(user_id=uid) exists
    # Assert is_active=True
    # Assert synced_at is set

def test_handle_insert_sets_worknode_id():
    # Payload has worknode_id=5; assert user.worknode_id=5 after insert

def test_handle_insert_sets_new_location_fields():
    # Payload has city="Mumbai", center="Dharavi", state="Maharashtra"
    # Assert user.city/center/state written correctly

def test_handle_insert_reactivates_soft_deleted_user():
    # Existing user with is_active=False
    # Call handle_insert with local_user = that user, user_id=uid
    # Assert is_active=True, fields updated

def test_handle_insert_returns_correct_status():
    # FlowResult.status == "success", action_taken == "user_created"
```

### `tests/sync/test_update_flow.py`

```python
def test_handle_update_common_fields_only():
    # User exists; payload changes user_display_name
    # diff.worknode_action="none"
    # Assert user.user_display_name updated in DB
    # Assert synced_at updated
    # FlowResult.action_taken == "common_fields_updated"

def test_handle_update_maps_email_and_contact_correctly():
    # Payload has user_email/user_phone; assert User.email / User.contact updated

def test_handle_update_common_fields_does_not_touch_worknode_id():
    # User has worknode_id=5; payload has same worknode_id (no change)
    # diff.worknode_action="none"
    # Confirm worknode_id still 5 after update

def test_handle_update_dispatches_to_stub_when_worknode_changed():
    # diff.worknode_action="added"
    # Assert NotImplementedError raised (stub in F-M8a-3, replaced in F-M8a-4)

def test_handle_update_sets_synced_at():
    # Verify synced_at is set to timezone.now() equivalent
```

### End-to-end test (via endpoint): `tests/sync/test_realtime_sync_e2e.py`

```python
def test_full_insert_flow_via_endpoint():
    # POST valid INSERT payload for new user
    # Assert 200, status="success", action_taken="user_created"
    # Assert User row exists
    # Assert RealtimeSyncLog row exists with correct status

def test_full_update_common_fields_via_endpoint():
    # Create user, then POST UPDATE payload with changed display_name
    # Assert 200, action_taken="common_fields_updated"
    # Assert user.user_display_name updated

def test_full_no_change_via_endpoint():
    # POST UPDATE payload identical to current user state
    # Assert status="skipped_no_change"

def test_full_role_not_allowed_via_endpoint():
    # POST with user_role not in allowlist
    # Assert status="skipped_role_not_allowed"
```

---

## Implementation Order

1. Create `services/realtime_sync/utils.py` (`apply_common_fields`) — use corrected field names
2. Create `services/realtime_sync/flows/insert.py` — `handle_insert(local_user, payload, diff, user_id)`
3. Create `services/realtime_sync/flows/update.py` — `handle_update(local_user, payload, diff, user_id)` (with NotImplementedError stub for worknode change)
4. Create `services/realtime_sync/flows/cascade.py` (stub only — NotImplementedError)
5. Update `services/realtime_sync/flows/__init__.py` — replace stubs with real imports; add `user_id` param to all three handlers
6. Update `services/realtime_sync/orchestrator.py` call sites — pass `user_id` to `handle_insert`, `handle_update`, `handle_deactivate`
7. Write and run tests
8. Manual end-to-end test: POST INSERT payload → verify user created + log written

> **Note:** `FlowResult` dataclass and `flows/__init__.py` already exist from F-M8a-2 — do not recreate from scratch. Step 5 updates the existing file.

---

## Open Questions

1. ~~**`User` model field names for profile fields**~~ — **Resolved (F-M8a-2):** `email` (not `user_email`), `contact` (not `user_phone`), `user_display_name` (correct), `synced_at` (not `last_synced_at`). `apply_common_fields` uses these confirmed names.
2. **Worknode_id on INSERT** — when a new user arrives with a worknode_id, should `worknode_added` cascade run immediately on insert? Currently the plan sets worknode_id on the user row but does NOT run the school_volunteer cascade. If the user needs an active slot assignment, the cascade would be needed. For M8a-3, assume: set worknode_id, no cascade; cascade runs if a subsequent UPDATE event has `worknode_action=added`. Confirm with the team.
3. **Re-activation worknode cascade** — same question as above but for re-activation. Currently: set worknode_id from payload, no cascade. Confirm.
