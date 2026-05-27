from django.db import transaction

from sessionops.exceptions import NotFound, PermissionDenied, ValidationError, ConflictError
from sessionops.models import (
    Child,
    ChildClassSection,
    ChildSubject,
    ClassSection,
    ClassSectionSubject,
    Slot,
    SlotClassSection,
    SlotClassSectionVolunteer,
    Subject,
    User,
)
from sessionops.services.academic_year.queries import get_or_create_school_academic_year
from sessionops.services.rbac.scope import can_modify_school, get_school_or_403
from sessionops.services.slot_classes.helpers import (
    check_r4_volunteer,
    check_r6_volunteer_in_slot,
    ensure_school_volunteer,
    validate_volunteer_worknode_match,
)


@transaction.atomic
def create_slot_class(slot_id: int, payload, user: User) -> SlotClassSection:
    """
    5-table atomic insert: ClassSectionSubject, ChildSubject × N,
    SlotClassSection, SlotClassSectionVolunteer × 1-2, SchoolVolunteer × 1-2.

    Business rules enforced: R2, R3, R4, R5, R6, worknode match, section/school match.
    """
    # 1. Lock slot row — prevents concurrent slot-class creation races
    try:
        slot = Slot.objects.select_for_update().get(
            slot_id=slot_id, is_active=True, removed=False
        )
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

    # 5. Resolve subject
    try:
        subject = Subject.objects.get(subject_id=payload.subject_id)
    except Subject.DoesNotExist:
        raise NotFound(f"Subject {payload.subject_id} not found.")

    # 6. Resolve volunteer 1
    try:
        vol1 = User.objects.get(user_id=payload.volunteer_1_id, is_active=True)
    except User.DoesNotExist:
        raise NotFound(f"Volunteer {payload.volunteer_1_id} not found.")

    # 7. Resolve volunteer 2 (optional)
    vol2 = None
    if payload.volunteer_2_id:
        try:
            vol2 = User.objects.get(user_id=payload.volunteer_2_id, is_active=True)
        except User.DoesNotExist:
            raise NotFound(f"Volunteer {payload.volunteer_2_id} not found.")

    # 8. R3: vol1 != vol2
    if vol2 and vol1.user_id == vol2.user_id:
        raise ValidationError("Vol1 and Vol2 cannot be the same volunteer.")

    # 9. R5: section not already in this slot
    if SlotClassSection.objects.filter(
        slot_id=slot,
        class_section_id=section,
        is_active=True,
        removed=False,
    ).exists():
        raise ConflictError(
            f"Section '{section.section_name}' is already assigned to this slot."
        )

    # 10. Worknode match validation
    validate_volunteer_worknode_match(slot.school_id, vol1)
    if vol2:
        validate_volunteer_worknode_match(slot.school_id, vol2)

    # 11. R6: volunteer not in two slot-classes in same slot
    check_r6_volunteer_in_slot(slot, vol1)
    if vol2:
        check_r6_volunteer_in_slot(slot, vol2)

    # 12. R4: volunteer not at a different school
    check_r4_volunteer(vol1, slot.school_id)
    if vol2:
        check_r4_volunteer(vol2, slot.school_id)

    # 13. Insert 1: ClassSectionSubject
    css = ClassSectionSubject.objects.create(
        class_section_id=section,
        subject_id=subject,
        created_by=user,
    )

    # 14. Insert 2: ChildSubject × N (one per active child in section)
    active_ccs = list(
        ChildClassSection.objects.filter(
            class_section_id=section,
            is_active=True,
            removed=False,
        ).select_related("child_id")
    )
    if active_ccs:
        ChildSubject.objects.bulk_create([
            ChildSubject(
                child_id=ccs.child_id,
                class_section_subject_id=css,
                created_by=user,
            )
            for ccs in active_ccs
        ])

    # 15. Insert 3: SlotClassSection
    scs = SlotClassSection.objects.create(
        slot_id=slot,
        class_section_id=section,
        class_section_subject_id=css,
        created_by=user,
    )

    # 16. Insert 4: SlotClassSectionVolunteer × 1-2
    SlotClassSectionVolunteer.objects.create(
        slot_class_section_id=scs,
        volunteer_id=vol1,
        created_by=user,
    )
    if vol2:
        SlotClassSectionVolunteer.objects.create(
            slot_class_section_id=scs,
            volunteer_id=vol2,
            created_by=user,
        )

    # 17. Insert 5: SchoolVolunteer (idempotent — skips if already active at this school)
    for vol in ([vol1] + ([vol2] if vol2 else [])):
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
        SlotClassSection.objects
        .filter(slot_id=slot, is_active=True, removed=False)
        .select_related("class_section_id", "class_section_subject_id__subject_id")
        .prefetch_related("slotclasssectionvolunteer_set")
        .order_by("created_at")
    )
