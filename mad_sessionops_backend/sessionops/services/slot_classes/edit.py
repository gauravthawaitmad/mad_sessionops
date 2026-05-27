from django.db import transaction
from django.utils import timezone

from sessionops.exceptions import NotFound, PermissionDenied, ValidationError
from sessionops.models import (
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
from sessionops.services.rbac.scope import can_modify_school, get_school_or_403
from sessionops.services.slot_classes.helpers import (
    check_r4_volunteer,
    check_r6_volunteer_in_slot,
    ensure_school_volunteer,
    reconcile_school_volunteer,
    validate_volunteer_worknode_match,
)
from sessionops.services.academic_year.queries import get_or_create_school_academic_year


@transaction.atomic
def edit_slot_class(scs_id: int, payload, user: User) -> SlotClassSection:
    """
    Three sub-flows depending on what changed:
      - Volunteer swap: swap out old SCSV rows, reconcile SchoolVolunteer
      - Section change: full cascade reset (soft-delete all child rows, re-insert)
      - Subject change: soft-delete CSS + ChildSubject rows, re-insert

    payload fields (all optional): volunteer_1_id, volunteer_2_id,
                                   class_section_id, subject_id
    """
    try:
        scs = (
            SlotClassSection.objects
            .select_for_update()
            .select_related("slot_id", "class_section_id", "class_section_subject_id")
            .get(slot_class_section_id=scs_id, is_active=True, removed=False)
        )
    except SlotClassSection.DoesNotExist:
        raise NotFound(f"Slot-class {scs_id} not found.")

    partner = get_school_or_403(user, scs.slot_id.school_id)
    if not can_modify_school(user, partner):
        raise PermissionDenied()

    school_id = scs.slot_id.school_id
    slot: Slot = scs.slot_id
    now = timezone.now()

    # ── Determine what is changing ────────────────────────────────────────────

    new_section_id = payload.class_section_id
    new_subject_id = payload.subject_id
    new_vol1_id    = payload.volunteer_1_id
    new_vol2_id    = payload.volunteer_2_id  # may be None (remove vol2)

    section_changing = new_section_id is not None and new_section_id != scs.class_section_id_id
    subject_changing = new_subject_id is not None and new_subject_id != scs.class_section_subject_id.subject_id_id
    vols_changing    = new_vol1_id is not None or payload.volunteer_2_id is not None

    if not any([section_changing, subject_changing, vols_changing]):
        return scs  # nothing to do

    say = get_or_create_school_academic_year(school_id, user)

    # ── Full cascade reset (section or subject change) ────────────────────────

    if section_changing or subject_changing:
        # Resolve new section
        if section_changing:
            try:
                new_section = ClassSection.objects.get(
                    class_section_id=new_section_id,
                    is_active=True,
                    removed=False,
                )
            except ClassSection.DoesNotExist:
                raise NotFound(f"Section {new_section_id} not found.")
            if new_section.school_id != school_id:
                raise ValidationError("Section does not belong to this school.")
        else:
            new_section = scs.class_section_id

        # Resolve new subject
        if subject_changing:
            try:
                new_subject = Subject.objects.get(subject_id=new_subject_id)
            except Subject.DoesNotExist:
                raise NotFound(f"Subject {new_subject_id} not found.")
        else:
            new_subject = scs.class_section_subject_id.subject_id

        # Soft-delete old SCSV rows
        old_vol_ids = list(
            SlotClassSectionVolunteer.objects
            .filter(slot_class_section_id=scs, is_active=True, removed=False)
            .values_list("volunteer_id_id", flat=True)
        )
        SlotClassSectionVolunteer.objects.filter(
            slot_class_section_id=scs, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now, updated_at=now)

        # Soft-delete old CSS
        ClassSectionSubject.objects.filter(
            class_section_subject_id=scs.class_section_subject_id_id,
            is_active=True, removed=False,
        ).update(is_active=False, removed=True, deleted_at=now, updated_at=now)

        # Create new CSS
        new_css = ClassSectionSubject.objects.create(
            class_section_id=new_section,
            subject_id=new_subject,
            created_by=user,
        )

        # Create ChildSubject rows for new section's active children
        active_ccs = list(
            ChildClassSection.objects.filter(
                class_section_id=new_section,
                is_active=True,
                removed=False,
            )
        )
        if active_ccs:
            ChildSubject.objects.bulk_create([
                ChildSubject(
                    child_id=ccs.child_id,
                    class_section_subject_id=new_css,
                    created_by=user,
                )
                for ccs in active_ccs
            ])

        # Update SlotClassSection
        scs.class_section_id = new_section
        scs.class_section_subject_id = new_css
        scs.updated_by = user
        scs.save(update_fields=["class_section_id", "class_section_subject_id", "updated_by", "updated_at"])

        # Reconcile old volunteers
        for vol_id in old_vol_ids:
            reconcile_school_volunteer(school_id, vol_id)

        # Re-create volunteers (reuse new ones if provided, else old list)
        if new_vol1_id:
            _replace_volunteers(scs, [new_vol1_id] + ([new_vol2_id] if new_vol2_id else []),
                                 slot, school_id, say, user, now)
        else:
            # Re-add old volunteers to new slot-class
            for vol_id in old_vol_ids:
                try:
                    vol = User.objects.get(user_id=vol_id, is_active=True)
                    SlotClassSectionVolunteer.objects.create(
                        slot_class_section_id=scs,
                        volunteer_id=vol,
                        created_by=user,
                    )
                    ensure_school_volunteer(school_id, say, vol, user)
                except User.DoesNotExist:
                    pass

        return scs

    # ── Volunteer-only swap ───────────────────────────────────────────────────

    if vols_changing:
        vol_ids = [new_vol1_id] + ([new_vol2_id] if new_vol2_id else [])
        old_vol_ids = list(
            SlotClassSectionVolunteer.objects
            .filter(slot_class_section_id=scs, is_active=True, removed=False)
            .values_list("volunteer_id_id", flat=True)
        )

        SlotClassSectionVolunteer.objects.filter(
            slot_class_section_id=scs, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now, updated_at=now)

        _replace_volunteers(scs, vol_ids, slot, school_id, say, user, now)

        # Reconcile removed volunteers
        staying = set(vol_ids)
        for vol_id in old_vol_ids:
            if vol_id not in staying:
                reconcile_school_volunteer(school_id, vol_id)

        scs.updated_by = user
        scs.save(update_fields=["updated_by", "updated_at"])

    return scs


def _replace_volunteers(scs: SlotClassSection, vol_ids: list[int],
                        slot: Slot, school_id: int, say,
                        user: User, now) -> None:
    """Validate and create new SCSV rows + ensure SchoolVolunteer."""
    if len(vol_ids) == 2 and vol_ids[0] == vol_ids[1]:
        raise ValidationError("Vol1 and Vol2 cannot be the same volunteer.")

    volunteers = []
    for vid in vol_ids:
        try:
            vol = User.objects.get(user_id=vid, is_active=True)
        except User.DoesNotExist:
            raise NotFound(f"Volunteer {vid} not found.")
        validate_volunteer_worknode_match(school_id, vol)
        # R6: exclude the scs itself from the in-slot check
        if SlotClassSectionVolunteer.objects.filter(
            volunteer_id=vol,
            is_active=True,
            removed=False,
            slot_class_section_id__slot_id=slot,
            slot_class_section_id__is_active=True,
            slot_class_section_id__removed=False,
        ).exclude(slot_class_section_id=scs).exists():
            from sessionops.exceptions import ConflictError
            raise ConflictError(
                f"{vol.user_display_name} is already assigned to another class in this slot."
            )
        check_r4_volunteer(vol, school_id)
        volunteers.append(vol)

    for vol in volunteers:
        SlotClassSectionVolunteer.objects.create(
            slot_class_section_id=scs,
            volunteer_id=vol,
            created_by=user,
        )
        ensure_school_volunteer(school_id, say, vol, user)
