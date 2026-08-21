from django.db import transaction

from sessionops.exceptions import ConflictError, NotFound, PermissionDenied, ValidationError
from sessionops.models import (
    ChildClassSection,
    ChildSubject,
    ClassSection,
    ClassSectionSubject,
    Slot,
    SlotClassSection,
    SlotClassSectionVolunteer,
    User,
)
from sessionops.services.academic_year.queries import get_or_create_school_academic_year
from sessionops.services.rbac.scope import can_modify_school, get_school_or_403
from sessionops.services.slot_classes.helpers import (
    check_r_bucket_capacity,
    ensure_school_volunteer,
    get_foundation_subject,
    resolve_volunteer_list,
)


@transaction.atomic
def create_slot_class(slot_id: int, payload, user: User) -> SlotClassSection:
    """
    5-table atomic insert: ClassSectionSubject, ChildSubject × N,
    SlotClassSection, SlotClassSectionVolunteer × 1-5, SchoolVolunteer × 1-5.

    Business rules enforced: R2 (1-5), R3, R4, R5, R6, R-bucket, worknode match, section/school match.
    """
    # 1. Lock slot row — prevents concurrent slot-class creation races
    try:
        slot = Slot.objects.select_for_update().get(slot_id=slot_id, is_active=True, removed=False)
    except Slot.DoesNotExist:
        raise NotFound(f"Slot {slot_id} not found.")

    # 2. RBAC
    partner = get_school_or_403(user, slot.school_id)
    if not can_modify_school(user, partner):
        raise PermissionDenied()

    # 3. Resolve SAY
    say = get_or_create_school_academic_year(slot.school_id, user)

    # 4. Validate section belongs to this school
    try:
        section = ClassSection.objects.get(
            class_section_id=payload.class_section_id,
            is_active=True,
            removed=False,
        )
    except ClassSection.DoesNotExist:
        raise NotFound(f"Section {payload.class_section_id} not found.")
    if section.school_id != slot.school_id:
        raise ValidationError("Section does not belong to this school.")

    # 5. Resolve Foundation subject (server-controlled — client no longer sends subject_id)
    subject = get_foundation_subject()

    # 6. R-bucket: volunteer count vs active children in the bucket
    check_r_bucket_capacity(section.class_section_id, len(payload.volunteer_ids))

    # 7. Resolve + validate each volunteer (worknode match, R6, R4). R3 (uniqueness)
    # is already enforced by the schema validator.
    volunteers = resolve_volunteer_list(payload.volunteer_ids, slot.school_id)

    # 8. R5: section not already in this slot
    if SlotClassSection.objects.filter(
        slot_id=slot.slot_id,
        class_section_id=section,
        is_active=True,
        removed=False,
    ).exists():
        raise ConflictError(f"Section '{section.section_name}' is already assigned to this slot.")

    # 9. Insert 1: ClassSectionSubject
    css = ClassSectionSubject.objects.create(
        class_section_id=section,
        subject_id=subject,
        created_by=user,
    )

    # 10. Insert 2: ChildSubject × N (one per active child in section)
    active_ccs = list(
        ChildClassSection.objects.filter(
            class_section_id=section,
            is_active=True,
            removed=False,
        ).select_related("child_id")
    )
    if active_ccs:
        ChildSubject.objects.bulk_create(
            [
                ChildSubject(
                    child_id=ccs.child_id,
                    class_section_subject_id=css,
                    created_by=user,
                )
                for ccs in active_ccs
            ]
        )

    # 11. Insert 3: SlotClassSection
    scs = SlotClassSection.objects.create(
        slot_id=slot,
        class_section_id=section,
        class_section_subject_id=css,
        created_by=user,
    )

    # 12. Insert 4: SlotClassSectionVolunteer × 1-5
    for vol in volunteers:
        SlotClassSectionVolunteer.objects.create(
            slot_class_section_id=scs,
            volunteer_id=vol,
            created_by=user,
        )

    # 13. Insert 5: SchoolVolunteer (idempotent — skips if already active at this school)
    for vol in volunteers:
        ensure_school_volunteer(slot.school_id, say, vol, user)

    return scs


def list_slot_classes(slot_id: int, user: User) -> list[SlotClassSection]:
    """Return active slot-classes for a slot, with prefetched volunteers."""
    try:
        slot = Slot.objects.get(slot_id=slot_id, is_active=True, removed=False)
    except Slot.DoesNotExist:
        raise NotFound(f"Slot {slot_id} not found.")

    get_school_or_403(user, slot.school_id)

    return list(
        SlotClassSection.objects.filter(slot_id=slot.slot_id, is_active=True, removed=False)
        .select_related("class_section_id", "class_section_subject_id__subject_id")
        .prefetch_related("slotclasssectionvolunteer_set")
        .order_by("created_at")
    )
