# Feature Plan: F-M8a-4 — Worknode_id Cascade Flows

## Overview

Implements the three sub-flows for worknode_id changes: `worknode_added`, `worknode_updated`, and `worknode_removed`. Each sub-flow handles the cascade of school_volunteer creation/deletion and, where needed, soft-deletion of slot-class assignment rows. Includes the `partial_success` path when a worknode_id is set but no matching `partner_worknode` row (and therefore no school) can be resolved.

This is the most complex feature in M8a. The cascade logic is new code — it is NOT a direct reuse of M3's `delete_slot_class` (which operates on a single slot-class from above, not on a user across all assignments at a school).

---

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| `services/realtime_sync/flows/cascade.py` | New | Replaces F-M8a-3 stub |
| `services/slot_classes/helpers.py` | Read only | Reuses `ensure_school_volunteer` — NOT modified |
| `services/slot_classes/delete.py` | Read only | Pattern reference — NOT modified in F-M8a-4 |
| `SlotClassSectionVolunteer`, `SlotClassSection`, `ClassSectionSubject`, `ChildSubject` | Writes | Soft-deleted by cascade_remove |
| `SchoolVolunteer` | Writes | Created by `ensure_school_volunteer`; soft-deleted by cascade |
| `User.worknode_id` | Writes | Updated after successful cascade |
| `User.last_synced_at` | Writes | Set on every flow |
| Frontend | None | No changes |
| Existing tests | None | No existing code modified |

---

## High-Level Design

```
orchestrator.py → handle_update → handle_worknode_change (cascade.py)
                                           |
                      diff.worknode_action == "added"   → cascade_worknode_added
                      diff.worknode_action == "updated" → cascade_worknode_updated
                      diff.worknode_action == "removed" → cascade_worknode_removed
```

All three sub-flows share one utility: `_resolve_school_for_worknode(worknode_id) → Partner | None`.

If `_resolve_school_for_worknode` returns None:
- Apply common fields only
- Do NOT update `user.worknode_id` (leave at old value)
- Return `FlowResult(status="partial_success", action_taken="no_school_found_for_worknode", deferred_operations={...})`

All cascade writes happen inside the orchestrator's `transaction.atomic()`.

---

## Low-Level Design

### School resolver: `services/realtime_sync/flows/cascade.py`

```python
from sessionops.models import PartnerWorknode, Partner

def _resolve_school_for_worknode(worknode_id: int) -> Partner | None:
    """
    Returns the Partner (school) that this worknode_id maps to, or None.
    """
    try:
        pw = PartnerWorknode.objects.select_related("partner").get(
            worknode_id=worknode_id,
            is_active=True,
        )
        return pw.partner if pw.partner else None
    except PartnerWorknode.DoesNotExist:
        return None
```

**Note:** Verify PartnerWorknode field names on Day 1. The field may be `partner` (FK) or `partner_id` (int). Adjust accordingly.

---

### Cascade remove utility

```python
from django.utils import timezone
from sessionops.models import (
    SlotClassSectionVolunteer, SlotClassSection,
    ClassSectionSubject, ChildSubject, SchoolVolunteer
)

def _cascade_remove_user_from_school(
    user,
    school: Partner,
    now,
    cascaded_changes: list,
) -> None:
    """
    Soft-deletes all slot-class assignment rows for this user at this school,
    cascading up through SlotClassSection → ClassSectionSubject → ChildSubject.
    Then soft-deletes the SchoolVolunteer row.
    
    Operates inside the caller's transaction.atomic().
    """
    scsv_rows = SlotClassSectionVolunteer.objects.filter(
        volunteer_user=user,
        slot_class_section__slot__school=school,
        is_active=True,
        removed=False,
    ).select_related(
        "slot_class_section__class_section_subject"
    )

    processed_scs_ids = set()

    for scsv in scsv_rows:
        scsv.is_active = False
        scsv.removed = True
        scsv.deleted_at = now
        scsv.save(update_fields=["is_active", "removed", "deleted_at"])
        cascaded_changes.append({"table": "slot_class_section_volunteer", "id": scsv.pk, "action": "soft_deleted"})

        scs = scsv.slot_class_section
        if scs.pk in processed_scs_ids:
            continue
        processed_scs_ids.add(scs.pk)

        remaining_scsv = SlotClassSectionVolunteer.objects.filter(
            slot_class_section=scs,
            is_active=True,
            removed=False,
        ).exists()

        if not remaining_scsv:
            scs.is_active = False
            scs.removed = True
            scs.deleted_at = now
            scs.save(update_fields=["is_active", "removed", "deleted_at"])
            cascaded_changes.append({"table": "slot_class_section", "id": scs.pk, "action": "soft_deleted"})

            css = scs.class_section_subject
            remaining_scs = SlotClassSection.objects.filter(
                class_section_subject=css,
                is_active=True,
                removed=False,
            ).exists()

            if not remaining_scs:
                css.is_active = False
                css.removed = True
                css.deleted_at = now
                css.save(update_fields=["is_active", "removed", "deleted_at"])
                cascaded_changes.append({"table": "class_section_subject", "id": css.pk, "action": "soft_deleted"})

                child_count = ChildSubject.objects.filter(
                    class_section_subject=css,
                    is_active=True,
                    removed=False,
                ).update(is_active=False, removed=True, deleted_at=now)
                if child_count:
                    cascaded_changes.append({
                        "table": "child_subject",
                        "parent_css_id": css.pk,
                        "count": child_count,
                        "action": "soft_deleted",
                    })

    # Soft-delete SchoolVolunteer
    sv_count = SchoolVolunteer.objects.filter(
        school=school,
        volunteer_user=user,
        is_active=True,
    ).update(is_active=False, removed=True, deleted_at=now)
    if sv_count:
        cascaded_changes.append({"table": "school_volunteer", "school_id": school.pk, "action": "soft_deleted"})
```

**Model field name notes:**
- `SlotClassSectionVolunteer.slot_class_section` — FK to SlotClassSection (verify field name)
- `SlotClassSection.slot` — FK to Slot (verify field name)
- `Slot.school` — FK to Partner (verify field name; may be `school_id` not `school`)
- `SlotClassSection.class_section_subject` — FK to ClassSectionSubject (verify field name)
- `ChildSubject.class_section_subject` — FK to ClassSectionSubject (verify)
- `SchoolVolunteer.school` — FK to Partner (verify; may be `partner_id` or `school_id`)

Verify all FK field names on Day 1 using `python manage.py shell -c "from sessionops.models import SlotClassSectionVolunteer; print([f.name for f in SlotClassSectionVolunteer._meta.get_fields()])"`.

---

### _cleanup_other_school_assignments

```python
def _cleanup_other_school_assignments(
    user,
    current_school: Partner,
    now,
    cascaded_changes: list,
) -> None:
    """
    Defensive: soft-delete any active SchoolVolunteer rows (and their cascade)
    at schools OTHER than current_school. Per R4 only one school is expected,
    but drift is possible and must be cleaned up safely.
    """
    other_svs = SchoolVolunteer.objects.filter(
        volunteer_user=user,
        is_active=True,
        removed=False,
    ).exclude(school=current_school).select_related("school")

    for sv in other_svs:
        _cascade_remove_user_from_school(user, sv.school, now, cascaded_changes)
```

---

### worknode_added

```python
def cascade_worknode_added(local_user, payload, diff, now, cascaded_changes, rules_fired) -> FlowResult:
    new_school = _resolve_school_for_worknode(payload.worknode_id)
    if new_school is None:
        # Partial success — apply common fields, skip worknode
        apply_common_fields(local_user, payload, now)
        local_user.save()   # worknode_id NOT updated
        return FlowResult(
            status="partial_success",
            action_taken="no_school_found_for_worknode",
            deferred_operations={
                "reason": "no_partner_worknode_mapping",
                "worknode_id": payload.worknode_id,
                "skipped_actions": ["ensure_school_volunteer", "set_worknode_id_on_user"],
            },
        )

    # Defensive: clean up any active school_volunteer rows at schools OTHER than new_school.
    # If the user already has an active assignment at new_school, it is preserved — only
    # other-school records are removed. Per R4 these shouldn't exist, but handle drift safely.
    _cleanup_other_school_assignments(local_user, new_school, now, cascaded_changes)
    rules_fired.append("cleanup_other_school_assignments:worknode_added")

    # Ensure SchoolVolunteer exists at new school (skips creation if already active there)
    from sessionops.services.slot_classes.helpers import ensure_school_volunteer
    sv, created = ensure_school_volunteer(
        school_id=new_school.pk,
        say=None,        # slot assignment not applicable here
        volunteer=local_user,
        created_by=None,
    )
    if created:
        cascaded_changes.append({"table": "school_volunteer", "school_id": new_school.pk, "action": "created"})
    rules_fired.append("ensure_school_volunteer:worknode_added")

    # Apply all fields including new worknode_id
    apply_common_fields(local_user, payload, now)
    local_user.worknode_id = payload.worknode_id
    local_user.save()

    return FlowResult(status="success", action_taken="worknode_added", cascaded_changes=cascaded_changes, rules_fired=rules_fired)
```

**Note on `ensure_school_volunteer` signature:** Check actual signature in `helpers.py`. The `say` parameter (slot assignment year?) may be required. If it is, this flow must pass the school's active SAY. Need to confirm on Day 1.

---

### worknode_removed

```python
def cascade_worknode_removed(local_user, payload, diff, now, cascaded_changes, rules_fired) -> FlowResult:
    old_worknode_id = local_user.worknode_id
    old_school = _resolve_school_for_worknode(old_worknode_id) if old_worknode_id else None

    if old_school:
        _cascade_remove_user_from_school(local_user, old_school, now, cascaded_changes)
        rules_fired.append("cascade_remove_user_from_school:worknode_removed")

    apply_common_fields(local_user, payload, now)
    local_user.worknode_id = None
    local_user.save()

    return FlowResult(status="success", action_taken="worknode_removed", cascaded_changes=cascaded_changes, rules_fired=rules_fired)
```

---

### worknode_updated (school A → school B)

```python
def cascade_worknode_updated(local_user, payload, diff, now, cascaded_changes, rules_fired) -> FlowResult:
    old_worknode_id = local_user.worknode_id
    old_school = _resolve_school_for_worknode(old_worknode_id) if old_worknode_id else None
    new_school = _resolve_school_for_worknode(payload.worknode_id)

    if new_school is None:
        # New school not resolvable — partial success; don't cascade old school either
        apply_common_fields(local_user, payload, now)
        local_user.save()   # worknode_id NOT updated
        return FlowResult(
            status="partial_success",
            action_taken="no_school_found_for_worknode",
            deferred_operations={
                "reason": "no_partner_worknode_mapping",
                "new_worknode_id": payload.worknode_id,
                "old_worknode_id": old_worknode_id,
                "skipped_actions": ["cascade_remove_from_old_school", "ensure_school_volunteer", "set_worknode_id_on_user"],
            },
        )

    # Remove from old school
    if old_school:
        _cascade_remove_user_from_school(local_user, old_school, now, cascaded_changes)
        rules_fired.append("cascade_remove_user_from_school:worknode_updated_old")

    # Ensure SchoolVolunteer at new school
    from sessionops.services.slot_classes.helpers import ensure_school_volunteer
    sv, created = ensure_school_volunteer(
        school_id=new_school.pk,
        say=None,
        volunteer=local_user,
        created_by=None,
    )
    if created:
        cascaded_changes.append({"table": "school_volunteer", "school_id": new_school.pk, "action": "created"})
    rules_fired.append("ensure_school_volunteer:worknode_updated_new")

    apply_common_fields(local_user, payload, now)
    local_user.worknode_id = payload.worknode_id
    local_user.save()

    return FlowResult(status="success", action_taken="worknode_updated", cascaded_changes=cascaded_changes, rules_fired=rules_fired)
```

---

### Main dispatcher: `handle_worknode_change`

```python
def handle_worknode_change(local_user, payload, diff, now) -> FlowResult:
    cascaded_changes = []
    rules_fired = []

    if diff.worknode_action == "added":
        return cascade_worknode_added(local_user, payload, diff, now, cascaded_changes, rules_fired)
    elif diff.worknode_action == "removed":
        return cascade_worknode_removed(local_user, payload, diff, now, cascaded_changes, rules_fired)
    elif diff.worknode_action == "updated":
        return cascade_worknode_updated(local_user, payload, diff, now, cascaded_changes, rules_fired)
    else:
        raise ValueError(f"handle_worknode_change called with unexpected worknode_action={diff.worknode_action}")
```

---

## Business Rules Enforced

- **R4 (one volunteer per school):** The `ensure_school_volunteer` call enforces this indirectly — if the user already has an active SchoolVolunteer at a different school, the upstream slot-class create checks R4. In M8a, we're not adding users to slot classes directly; we're just managing SchoolVolunteer. Ensure R4 isn't double-enforced awkwardly. If user moves schools (worknode_updated), old school cascade runs first, then new school SchoolVolunteer created — at no point does the user have two active SchoolVolunteer rows.
- **Missing school → partial_success:** worknode_id is NOT written to user row. This preserves the invariant: `user.worknode_id` is only set if the corresponding school is resolvable locally. Prevents orphaned SchoolVolunteer state.
- **Cascade atomicity:** All cascade writes happen in the orchestrator's `transaction.atomic()`. If any step fails, the entire sync is rolled back; log row written with `status=failed`.
- **select_for_update on User row:** Handled by orchestrator (F-M8a-2). Flow handlers receive a locked user row.

---

## Security Review

- Flow handlers are internal; no external input parsing here.
- `_resolve_school_for_worknode` uses an int FK lookup — no string interpolation.
- `ChildSubject.objects.filter(...).update(...)` bulk update is safe — no user-controlled data in the filter.

---

## Testing Strategy

### `tests/sync/test_cascade_flows.py`

```python
# Setup helpers
def make_user_with_worknode(worknode_id): ...
def make_partner_worknode_mapping(worknode_id, school): ...
def make_slot_class_assignment(user, school): ...  # creates full SCSV → SCS → CSS chain

# worknode_added tests
def test_worknode_added_creates_school_volunteer():
    # User with worknode_id=None; payload sets worknode_id=5 (mapped to school A)
    # Assert SchoolVolunteer created for user at school A

def test_worknode_added_no_school_returns_partial_success():
    # worknode_id=99 has no PartnerWorknode mapping
    # Assert status=partial_success, action_taken=no_school_found_for_worknode
    # Assert user.worknode_id still None (not updated)

def test_worknode_added_does_not_set_worknode_id_on_partial():
    # Same as above — confirm worknode_id not written

# worknode_removed tests
def test_worknode_removed_soft_deletes_school_volunteer():
    # User at school A; payload sets worknode_id=None
    # Assert SchoolVolunteer.is_active=False

def test_worknode_removed_cascades_slot_class_assignments():
    # User has active SCSV at school A
    # payload sets worknode_id=None
    # Assert SCSV soft-deleted
    # Assert SlotClassSection soft-deleted (no remaining volunteers)
    # Assert ClassSectionSubject soft-deleted (no remaining sections)
    # Assert ChildSubject soft-deleted

def test_worknode_removed_does_not_cascade_if_other_volunteers():
    # User A and User B share a SlotClassSection at school A
    # User A removes worknode; User B still has worknode
    # Assert: User A's SCSV soft-deleted, SlotClassSection NOT soft-deleted

def test_worknode_removed_no_old_school_no_cascade():
    # User with worknode_id=None receives worknode_removed diff (edge case)
    # Assert no DB errors, cascaded_changes empty

# worknode_updated tests
def test_worknode_updated_removes_from_old_school_and_adds_to_new():
    # User at school A; payload changes worknode_id to school B
    # Assert SchoolVolunteer at A soft-deleted
    # Assert SchoolVolunteer at B created
    # Assert user.worknode_id = new worknode

def test_worknode_updated_new_school_not_resolvable_partial_success():
    # new worknode_id has no mapping
    # Assert status=partial_success, user.worknode_id NOT updated
    # Old school cascade NOT run (don't cascade if new school unknown)

def test_worknode_updated_cascades_log_entries():
    # Verify cascaded_changes JSON contains all soft-deleted rows

# Log row tests
def test_cascade_log_entries_persisted_in_realtime_sync_log():
    # cascaded_changes written to log row

def test_partial_success_writes_deferred_operations():
    # partial_success log row has deferred_operations.reason=no_partner_worknode_mapping
```

### Manual verification

1. Trigger `worknode_added` for a user via admin endpoint → check SchoolVolunteer row
2. Trigger `worknode_removed` for a user with active slot-class assignments → verify cascaded deletes
3. Trigger `worknode_updated` for a user moving schools → verify old school cascade + new SchoolVolunteer
4. Trigger with unmapped worknode_id → verify `partial_success` log, worknode_id unchanged on user

---

## Implementation Order

1. Replace `services/realtime_sync/flows/cascade.py` stub with real implementation
2. Implement `_resolve_school_for_worknode` — verify PartnerWorknode field names first
3. Implement `_cascade_remove_user_from_school` — verify SlotClassSectionVolunteer FK names first
4. Implement `cascade_worknode_added`
5. Implement `cascade_worknode_removed`
6. Implement `cascade_worknode_updated`
7. Implement `handle_worknode_change` dispatcher
8. Wire into `handle_update` in `flows/update.py`
9. Write and run tests

---

## Open Questions

1. **`ensure_school_volunteer` signature** — confirm exact parameters. In M3 helpers.py it takes `school_id, say, volunteer, created_by`. For M8a, `say` (slot assignment year?) may or may not be required. If required, what SAY should M8a use — the school's active SAY? Or can `say` be None for realtime sync?
2. **PartnerWorknode FK field name** — confirm `worknode_id` is the Hasura numeric ID, not the Django PK. Verify the actual field used to look up PartnerWorknode: `worknode_id=int_value` or `hasura_worknode_id=int_value`.
3. **SlotClassSectionVolunteer school filter** — confirm the join path: `SCSV.slot_class_section.slot.school` or `SCSV.slot_class_section.slot.partner_id`. May need to use `slot_class_section__slot__partner=school` depending on FK names.
4. **What is `SchoolVolunteer.school` FK field name** — `school` or `partner`? (M3 codebase may use `partner_id` for the school FK.)
5. **Partial_success for worknode_updated: cascade old school?** Current plan says NO — if new school is unknown, don't cascade old school either (to avoid limbo state). Confirm this is acceptable.
