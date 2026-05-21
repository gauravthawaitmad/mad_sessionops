# Feature Plan: F-M3-6 — Slot Edit and Delete

## Overview

CO can edit a slot's name, day of week, start/end times. Edit is always allowed, even when the slot has active slot-class assignments (the slot-classes shift with the slot's time). CO can soft-delete a slot only when it has no active `SlotClassSection` rows — if any exist, delete returns 409 with a count in the message. Inactive-but-not-removed rows do not block deletion.

## Blast Radius

| Surface | Impact | Notes |
|---------|--------|-------|
| Backend models | None | `Slot` already created in F-M3-5 |
| Backend services | 2 NEW | `services/slots/edit.py`, `services/slots/delete.py` |
| Backend API endpoints | 2 NEW routes | `PATCH` + `DELETE /api/schools/{id}/slots/{slot_id}/` |
| Frontend pages | Modified | Edit Slot modal + Delete confirmation on `SlotCard` |
| Frontend components | 2 NEW | `EditSlotModal.tsx`, delete confirmation modal |
| Database migrations | No | — |
| Celery tasks | No | — |
| Existing tests | None | — |
| Documentation | None | — |

## High-Level Design

### Edit flow

```
CO clicks three-dot → Edit
  → EditSlotModal pre-populated with current values
  → PATCH /api/schools/{school_id}/slots/{slot_id}/
  → edit_slot(slot_id, payload, user)
      → can_user_modify_school() check
      → validate times if changed
      → R7 overlap check excluding self
      → update fields, save
  ← updated slot
```

### Delete flow

```
CO clicks three-dot → Delete
  → Frontend checks slot_class_count from slot card data
  → If count > 0: show disabled modal "Remove class assignments first"
  → If count == 0: show confirmation modal "Delete '{slot_name}' on {day}?"
  → DELETE /api/schools/{school_id}/slots/{slot_id}/
  → soft_delete_slot(slot_id, user)
      → select_for_update()
      → can_user_modify_school() check
      → count active SlotClassSection rows
      → if > 0 → ConflictError (race condition guard)
      → soft-delete slot (is_active=False, removed=True, deleted_at=now)
  ← {slot_id, deleted: true}
```

## Low-Level Design

### Backend — Services

#### `services/slots/edit.py`

`edit_slot(slot_id, payload, user) -> Slot`

```python
@transaction.atomic
def edit_slot(slot_id, payload, user):
    slot = get_object_or_404(Slot, slot_id=slot_id, removed=False)

    if not can_user_modify_school(user, slot.school_id):
        raise PermissionDenied()

    new_start = payload.get("start_time", slot.start_time)
    new_end   = payload.get("end_time",   slot.end_time)
    new_day   = payload.get("day_of_week", slot.day_of_week)

    if new_start >= new_end:
        raise ValidationError("start_time must be before end_time")

    # R7: overlap check excluding self
    overlapping = Slot.objects.filter(
        school_id=slot.school_id,
        day_of_week=new_day,
        is_active=True,
        removed=False,
    ).exclude(slot_id=slot_id).filter(
        Q(start_time__lt=new_end) & Q(end_time__gt=new_start)
    ).first()

    if overlapping:
        raise ConflictError(
            f"This time overlaps with existing slot '{overlapping.slot_name}' "
            f"({overlapping.start_time}–{overlapping.end_time})."
        )

    for field, value in payload.items():
        setattr(slot, field, value)
    slot.updated_by = user
    slot.save()
    return slot
```

#### `services/slots/delete.py`

`soft_delete_slot(slot_id, user) -> Slot`

```python
@transaction.atomic
def soft_delete_slot(slot_id, user):
    slot = Slot.objects.select_for_update().get(slot_id=slot_id, removed=False)

    if not can_user_modify_school(user, slot.school_id):
        raise PermissionDenied()

    active_slot_class_count = SlotClassSection.objects.filter(
        slot_id=slot,
        is_active=True,
        removed=False,
    ).count()

    if active_slot_class_count > 0:
        raise ConflictError(
            f"Cannot delete this slot. Remove the {active_slot_class_count} class "
            f"assignment{'s' if active_slot_class_count != 1 else ''} first."
        )

    now = timezone.now()
    slot.is_active = False
    slot.removed = True
    slot.deleted_at = now
    slot.updated_by = user
    slot.save()
    return slot
```

Note: `_reconcile_school_volunteer_for_volunteers` is **not** called here. Slot delete is blocked when active slot-classes exist; by the time delete succeeds, no volunteer reconciliation is needed.

### Backend — Schemas

```python
class SlotUpdateSchema(Schema):
    slot_name:   str | None = None
    day_of_week: str | None = None
    start_time:  time | None = None
    end_time:    time | None = None

class SlotDeleteResponseSchema(Schema):
    slot_id: int
    deleted: bool
```

### Backend — Endpoints

Added to `api/slots_api.py` (extending F-M3-5):

| Method | Path | Auth | RBAC | Description |
|---|---|---|---|---|
| PATCH | `/schools/{school_id}/slots/{slot_id}/` | JWT | `can_modify_school` | Edit slot fields |
| DELETE | `/schools/{school_id}/slots/{slot_id}/` | JWT | `can_modify_school` | Soft-delete slot |

PATCH errors: 400 (invalid times), 403 (scope), 404 (not found), 409 (overlap)
DELETE errors: 403 (scope), 404, 409 (`{error: "...", active_slot_class_count: N}`)

### Frontend

**`EditSlotModal.tsx`** (NEW): Same fields as `AddSlotModal`, pre-populated. Client-side start < end validation.

**Delete confirmation — two states in `SlotCard.tsx`:**
- `slot_class_count > 0`: "This slot has {N} active class assignment{s}. Remove them first to delete this slot." Delete button disabled; "View class assignments" link scrolls into slot detail.
- `slot_class_count == 0`: "Delete '{slot_name}' on {day}?" with a red "Delete" button.

On 409 response (race condition): show inline error and refresh slot list.

## Business Rules Enforced

| Rule | Enforcement |
|---|---|
| R7 — No overlapping slots | `edit_slot` re-checks overlap, excluding self |
| Slot delete blocked when active slot-classes exist | `soft_delete_slot` counts active `SlotClassSection` rows |
| Inactive-but-not-removed rows do NOT block delete | Count filters `is_active=True, removed=False` only |
| No cascade on slot delete | Service does NOT soft-delete slot-classes |

## Security Review

- PATCH/DELETE require `can_modify_school()` — CO scoped to own schools, CHO to worknode-mapped schools
- `select_for_update()` on delete prevents race conditions with concurrent slot-class creation
- 409 error message includes slot count (`N`) — not a data leak; CO already has visibility

## Testing Strategy

**Backend unit tests** (`tests/slots/test_edit_delete_slot.py`):
- `test_edit_slot_updates_fields`
- `test_edit_slot_overlap_check_excludes_self`
- `test_edit_slot_creating_overlap_returns_409`
- `test_edit_slot_allowed_with_active_slot_classes`
- `test_delete_slot_with_no_slot_classes_succeeds`
- `test_delete_slot_with_active_slot_classes_returns_409`
- `test_delete_slot_with_only_removed_slot_classes_succeeds`
- `test_delete_slot_with_inactive_but_not_removed_slot_classes_succeeds`
- `test_delete_slot_does_not_cascade`
- `test_delete_slot_error_message_includes_active_count`
- `test_co_cannot_edit_other_school_slot`
- `test_cho_can_edit_slot_within_scope`
- `test_admin_can_edit_any_slot`

**Manual verification:**
- [ ] Edit slot name → change reflected in list
- [ ] Edit slot time to overlap with another slot → 409 with slot name in message
- [ ] Edit slot time on a slot with active slot-classes → succeeds
- [ ] Delete slot with no slot-classes → success
- [ ] Delete slot with active slot-classes → Delete button disabled in UI; API returns 409 if forced

## Implementation Order

**Chunk 1 — Services:**
1. Write `services/slots/edit.py`
2. Write `services/slots/delete.py`
3. Add PATCH + DELETE routes to `api/slots_api.py`
4. Write `test_edit_delete_slot.py`

**Chunk 2 — Frontend:**
1. Build `EditSlotModal.tsx`
2. Wire three-dot menu on `SlotCard` (Edit → `EditSlotModal`, Delete → confirmation modal)
3. Delete confirmation with two states

**Dependency:** F-M3-5 must be complete (Slot model + create flow).

## Open Questions

None. All resolved.
