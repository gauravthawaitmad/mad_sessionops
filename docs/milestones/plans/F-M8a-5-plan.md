# Feature Plan: F-M8a-5 — User Deactivation Flow + Slot-Class Create Modification

## Overview

Two coupled changes shipped together:

1. **Deactivation flow:** When a user's role changes to `Alumni` or `null`, soft-delete their slot-class assignments at their school (cascade identical to `worknode_removed`) and soft-delete the user row.

2. **Slot-class create modification:** Remove the `ensure_school_volunteer` call from `services/slot_classes/create.py`. The `school_volunteer` table is now managed exclusively by realtime sync flows.

3. **Slot-class delete modification:** Remove the `reconcile_school_volunteer` call from `services/slot_classes/delete.py`. Helper function `reconcile_school_volunteer` in `helpers.py` is deleted.

These three changes are coupled: if deactivation works correctly, school_volunteer lifecycle no longer needs to be managed by slot-class CRUD operations.

---

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| `services/realtime_sync/flows/deactivate.py` | New | DEACTIVATE flow handler |
| `services/realtime_sync/flows/__init__.py` | Modified | Replace `handle_deactivate` stub with real import |
| `services/slot_classes/create.py` | Modified | Remove `ensure_school_volunteer` call (step 14) |
| `services/slot_classes/delete.py` | Modified | Remove `reconcile_school_volunteer` call |
| `services/slot_classes/helpers.py` | Modified | Delete `reconcile_school_volunteer` function |
| Existing M3 tests for slot-class create | Updated | Remove assertions about `school_volunteer` creation |
| Existing M3 tests for slot-class delete | Updated | Remove assertions about `school_volunteer` reconciliation |
| Frontend | None | No changes |
| Backend migrations | None | No new schema |

---

## High-Level Design

```
orchestrator.py → handle_deactivate
                         |
         1. Resolve user's current school via worknode_id
         2. If school found: cascade_remove_user_from_school (F-M8a-4 utility)
         3. Soft-delete User row
         4. Return FlowResult(status=success, action_taken=user_deactivated)
```

The deactivation flow reuses `_cascade_remove_user_from_school` from F-M8a-4 — no new cascade logic.

---

## Low-Level Design

### Deactivation flow: `services/realtime_sync/flows/deactivate.py`

```python
from django.utils import timezone
from sessionops.models import User
from sessionops.services.realtime_sync.flows.cascade import (
    _resolve_school_for_worknode,
    _cascade_remove_user_from_school,
)
from sessionops.services.realtime_sync.types import FlowResult
from sessionops.services.realtime_sync.utils import apply_common_fields

def handle_deactivate(
    local_user: User | None,
    payload,
    diff,
) -> FlowResult:
    if local_user is None:
        # User doesn't exist locally — nothing to deactivate
        return FlowResult(status="skipped_no_change", action_taken="no_change")

    if not local_user.is_active:
        # Already deactivated
        return FlowResult(status="skipped_no_change", action_taken="no_change")

    now = timezone.now()
    cascaded_changes = []
    rules_fired = []

    # Cascade slot-class assignments if user has a school
    if local_user.worknode_id:
        school = _resolve_school_for_worknode(local_user.worknode_id)
        if school:
            _cascade_remove_user_from_school(local_user, school, now, cascaded_changes)
            rules_fired.append("cascade_remove_user_from_school:deactivation")

    # Soft-delete user
    local_user.is_active = False
    local_user.deleted_at = now
    local_user.last_synced_at = now
    local_user.user_role = payload.user_role  # capture final role (Alumni/null)
    local_user.save(update_fields=["is_active", "deleted_at", "last_synced_at", "user_role"])
    cascaded_changes.append({"table": "user", "id": local_user.pk, "action": "soft_deleted"})
    rules_fired.append("deactivate_user")

    return FlowResult(
        status="success",
        action_taken="user_deactivated",
        cascaded_changes=cascaded_changes,
        rules_fired=rules_fired,
    )
```

**Note on `deleted_by`:** The User model has a `deleted_by` field. For deactivation triggered by realtime sync, `deleted_by` should be set to the `triggered_by` user (admin who triggered the sync) or None if automated. Pass `triggered_by` into the flow if this matters. For M8a, either leave it None or set it to the admin. Confirm with team.

---

### Update `flows/__init__.py`

```python
from sessionops.services.realtime_sync.flows.insert import handle_insert
from sessionops.services.realtime_sync.flows.update import handle_update
from sessionops.services.realtime_sync.flows.deactivate import handle_deactivate

__all__ = ["handle_insert", "handle_update", "handle_deactivate"]
```

---

### Modify `services/slot_classes/create.py`

Remove the `ensure_school_volunteer` step from the slot-class create transaction. The exact step number will vary — find the call in the `create_slot_class` function:

```python
# BEFORE (M3):
# Step 14: ensure school_volunteer for each assigned volunteer
for volunteer_user in volunteers:
    ensure_school_volunteer(
        school_id=school.pk,
        say=say,
        volunteer=volunteer_user,
        created_by=created_by,
    )
```

Remove the entire loop/call. The function's surrounding atomic block does NOT need to change.

**Important:** After this removal, slot-class create no longer creates SchoolVolunteer rows. A volunteer can be added to a slot class even if they don't have a SchoolVolunteer row at that school. This is intentional — SchoolVolunteer is now maintained by realtime sync. However, the R4 check (`check_r4_volunteer`) may still reference SchoolVolunteer to detect multi-school conflicts — verify this still behaves correctly.

---

### Modify `services/slot_classes/delete.py`

Remove the `reconcile_school_volunteer` call. Find in `delete_slot_class` function:

```python
# BEFORE (M3):
# After soft-deleting SCSV/SCS/CSS:
reconcile_school_volunteer(school_id=school.pk, volunteer_user_id=volunteer.pk)
```

Remove this call. The function's surrounding atomic block does NOT need to change.

---

### Modify `services/slot_classes/helpers.py`

Delete the `reconcile_school_volunteer` function entirely.

Check for any other callers before deleting:
```bash
grep -r "reconcile_school_volunteer" --include="*.py" .
```

If any other files call it (beyond delete.py, which we just patched), update those callers too.

**Keep:** `ensure_school_volunteer` — this function is still used by F-M8a-4's cascade flows.

---

## Business Rules Enforced

- **Deactivation is a soft-delete.** User row gets `is_active=False, deleted_at=now`. No hard delete.
- **Already-deactivated user skips deactivation flow.** Returns `skipped_no_change` — prevents double-deactivation.
- **User with no local record skips gracefully.** Returns `skipped_no_change` — not an error.
- **Slot-class cascade on deactivation.** Same cascade as worknode_removed: if a deactivated user has slot-class assignments at their school, those rows are soft-deleted.
- **R4 check behavior after slot-class create modification:** R4 (`check_r4_volunteer`) in slot-class create checks whether a volunteer has an active SchoolVolunteer at a different school. After this change, SchoolVolunteer only exists if realtime sync has run for that user. Verify: if a volunteer has no SchoolVolunteer anywhere, R4 passes (user has no active school assignment). This is the intended behavior.

---

## Security Review

- No new endpoint or auth surface in F-M8a-5.
- `deleted_at` and `is_active` are set programmatically — no user-controlled input.
- Removal of `reconcile_school_volunteer` from delete.py does not introduce a security issue; it only changes when SchoolVolunteer cleanup occurs.

---

## Testing Strategy

### `tests/sync/test_deactivate_flow.py`

```python
def test_deactivate_user_soft_deletes_user_row():
    # User exists, is_active=True
    # Call handle_deactivate with Alumni role
    # Assert user.is_active=False, user.deleted_at set

def test_deactivate_user_cascades_slot_class_assignments():
    # User has active SCSV at their school
    # Assert SCSV soft-deleted (and cascaded rows)
    # Assert SchoolVolunteer soft-deleted

def test_deactivate_user_with_no_worknode_no_cascade():
    # User has worknode_id=None
    # Assert only user row soft-deleted; no cascade errors

def test_deactivate_user_already_deactivated_returns_no_change():
    # User is_active=False
    # Assert status=skipped_no_change, action_taken=no_change

def test_deactivate_nonexistent_user_returns_no_change():
    # local_user=None passed in
    # Assert status=skipped_no_change

def test_deactivate_updates_last_synced_at():
    # Verify last_synced_at is set on deactivated user row
```

### Updated M3 slot-class tests: `tests/test_slot_class_create.py` and `tests/test_slot_class_delete.py`

Remove assertions that check `SchoolVolunteer` creation/reconciliation. Tests must still pass; they just no longer assert on school_volunteer side effects.

```python
# In test_slot_class_create.py — REMOVE assertions like:
# assert SchoolVolunteer.objects.filter(volunteer_user=volunteer).exists()

# In test_slot_class_delete.py — REMOVE assertions like:
# assert not SchoolVolunteer.objects.filter(volunteer_user=volunteer, is_active=True).exists()
```

All other assertions (SCSV creation, R4 enforcement, transaction rollback, etc.) remain unchanged.

### Regression: R4 check still works

```python
def test_r4_still_enforced_after_school_volunteer_removal():
    # Scenario: volunteer has active SchoolVolunteer at school A (set by realtime sync)
    # Attempt to add to slot at school B → should fail R4
    # This verifies R4 check still reads SchoolVolunteer correctly
```

---

## Implementation Order

1. Implement `services/realtime_sync/flows/deactivate.py`
2. Update `flows/__init__.py` to export real `handle_deactivate`
3. Write and run deactivation flow tests
4. Run grep for `reconcile_school_volunteer` callers
5. Modify `delete.py` — remove reconcile call
6. Delete `reconcile_school_volunteer` from `helpers.py`
7. Modify `create.py` — remove `ensure_school_volunteer` call
8. Update affected M3 tests (remove SchoolVolunteer assertions)
9. Run full test suite — confirm M3 tests still pass
10. Manual regression: create a slot class, delete it — verify no errors without reconcile logic

---

## Open Questions

1. **`deleted_by` on deactivated User** — should `deleted_by` be set to the admin who triggered the manual sync? Requires passing `triggered_by` into the flow handler. Or leave null for realtime-triggered deactivations. Confirm with team.
ans - put something like realtime sync backend flow related.
2. **R4 check behavior after create.py change** — confirm: if a volunteer has no SchoolVolunteer anywhere (realtime sync hasn't run for them), R4 allows them to be added to any school's slot. Is this acceptable? Or should R4 still gate on SchoolVolunteer presence?
ans - you have to still check and go to the other table like slot_class_section, scsv scss, cs
