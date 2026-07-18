from django.db import transaction
from django.utils import timezone

from sessionops.exceptions import ConflictError, NotFound, PermissionDenied
from sessionops.models import Slot, SlotClassSection
from sessionops.services.rbac.scope import can_modify_school, get_school_or_403


@transaction.atomic
def soft_delete_slot(slot_id: int, user) -> Slot:
    try:
        slot = Slot.objects.select_for_update().get(slot_id=slot_id, removed=False)
    except Slot.DoesNotExist:
        raise NotFound("Slot not found.")

    partner = get_school_or_403(user, slot.school_id)
    if not can_modify_school(user, partner):
        raise PermissionDenied()

    active_count = SlotClassSection.objects.filter(
        slot_id=slot.slot_id, is_active=True, removed=False
    ).count()
    if active_count > 0:
        raise ConflictError(
            f"Cannot delete this slot. Remove the {active_count} class "
            f"assignment{'s' if active_count != 1 else ''} first."
        )

    slot.is_active = False
    slot.removed = True
    slot.deleted_at = timezone.now()
    slot.updated_by = user
    slot.save()
    return slot
