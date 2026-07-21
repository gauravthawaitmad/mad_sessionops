from django.db import transaction
from django.utils import timezone

from sessionops.exceptions import NotFound, PermissionDenied
from sessionops.models import ClassSectionSubject, SlotClassSection, SlotClassSectionVolunteer, User
from sessionops.services.rbac.scope import can_modify_school, get_school_or_403
from sessionops.services.slot_classes.helpers import reconcile_school_volunteer


@transaction.atomic
def delete_slot_class(scs_id: int, user: User) -> None:
    """
    Soft-delete all rows in order:
      1. SlotClassSectionVolunteer rows
      2. ClassSectionSubject row
      3. SlotClassSection row
    Then reconcile SchoolVolunteer for all affected volunteers.
    """
    try:
        scs = (
            SlotClassSection.objects.select_for_update()
            .select_related("slot_id")
            .get(slot_class_section_id=scs_id, is_active=True, removed=False)
        )
    except SlotClassSection.DoesNotExist:
        raise NotFound(f"Slot-class {scs_id} not found.")

    partner = get_school_or_403(user, scs.slot_id.school_id)
    if not can_modify_school(user, partner):
        raise PermissionDenied()

    now = timezone.now()

    # 1. Collect volunteer IDs before soft-deleting
    volunteer_ids = list(
        SlotClassSectionVolunteer.objects.filter(
            slot_class_section_id=scs, is_active=True, removed=False
        ).values_list("volunteer_id_id", flat=True)
    )

    # 2. Soft-delete SlotClassSectionVolunteer rows
    SlotClassSectionVolunteer.objects.filter(
        slot_class_section_id=scs,
        is_active=True,
        removed=False,
    ).update(is_active=False, removed=True, deleted_at=now, updated_at=now)

    # 3. Soft-delete the ClassSectionSubject row
    ClassSectionSubject.objects.filter(
        class_section_subject_id=scs.class_section_subject_id_id,
        is_active=True,
        removed=False,
    ).update(is_active=False, removed=True, deleted_at=now, updated_at=now)

    # 4. Soft-delete the SlotClassSection row
    scs.is_active = False
    scs.removed = True
    scs.deleted_at = now
    scs.save(update_fields=["is_active", "removed", "deleted_at", "updated_at"])

    # 5. Reconcile SchoolVolunteer for all affected volunteers
    school_id = scs.slot_id.school_id
    for vol_id in volunteer_ids:
        reconcile_school_volunteer(school_id, vol_id)
