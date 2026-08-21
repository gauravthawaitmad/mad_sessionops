from django.db import transaction
from django.utils import timezone

from sessionops.exceptions import NotFound, PermissionDenied, ValidationError
from sessionops.models import (
    ChildClassSection,
    ChildSubject,
    ClassSection,
    ClassSectionSubject,
    SlotClassSection,
    SlotClassSectionVolunteer,
    User,
)
from sessionops.services.academic_year.queries import get_or_create_school_academic_year
from sessionops.services.rbac.scope import can_modify_school, get_school_or_403
from sessionops.services.slot_classes.helpers import (
    check_r4_volunteer,
    check_r6_volunteer_single_assignment,
    check_r_bucket_capacity,
    ensure_school_volunteer,
    get_foundation_subject,
    reconcile_school_volunteer,
    validate_volunteer_worknode_match,
)


@transaction.atomic
def edit_slot_class(scs_id: int, payload, user: User) -> SlotClassSection:
    """
    Two sub-flows depending on what changed:
      - Volunteer swap: swap out old SCSV rows, reconcile SchoolVolunteer
      - Section change: full cascade reset (soft-delete all child rows, re-insert).
        Subject can no longer change from client input — it's always the seeded
        Foundation subject, so a section change always re-derives it via
        get_foundation_subject() rather than trusting a payload field.

    payload fields (all optional): volunteer_ids, class_section_id
    """
    try:
        scs = (
            SlotClassSection.objects.select_for_update()
            .select_related("slot_id", "class_section_id", "class_section_subject_id")
            .get(slot_class_section_id=scs_id, is_active=True, removed=False)
        )
    except SlotClassSection.DoesNotExist:
        raise NotFound(f"Slot-class {scs_id} not found.")

    partner = get_school_or_403(user, scs.slot_id.school_id)
    if not can_modify_school(user, partner):
        raise PermissionDenied()

    school_id = scs.slot_id.school_id
    now = timezone.now()

    # ── Determine what is changing ────────────────────────────────────────────

    new_section_id = payload.class_section_id
    new_volunteer_ids = payload.volunteer_ids  # None = no change

    section_changing = new_section_id is not None and new_section_id != scs.class_section_id_id
    vols_changing = new_volunteer_ids is not None

    if not any([section_changing, vols_changing]):
        return scs  # nothing to do

    say = get_or_create_school_academic_year(school_id, user)

    # ── Full cascade reset (section change) ───────────────────────────────────

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

        # Subject can never come from client input — always Foundation.
        new_subject = get_foundation_subject()

        old_vol_ids = list(
            SlotClassSectionVolunteer.objects.filter(
                slot_class_section_id=scs, is_active=True, removed=False
            ).values_list("volunteer_id_id", flat=True)
        )

        # R-bucket: check against whichever volunteer set will end up on the new
        # section — the explicit new list if provided, else the carried-over old list.
        check_r_bucket_capacity(
            new_section.class_section_id,
            len(new_volunteer_ids) if new_volunteer_ids is not None else len(old_vol_ids),
        )

        # Soft-delete old SCSV rows
        SlotClassSectionVolunteer.objects.filter(
            slot_class_section_id=scs, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now, updated_at=now)

        # Soft-delete old CSS
        ClassSectionSubject.objects.filter(
            class_section_subject_id=scs.class_section_subject_id_id,
            is_active=True,
            removed=False,
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
            ChildSubject.objects.bulk_create(
                [
                    ChildSubject(
                        child_id=ccs.child_id,
                        class_section_subject_id=new_css,
                        created_by=user,
                    )
                    for ccs in active_ccs
                ]
            )

        # Update SlotClassSection
        scs.class_section_id = new_section
        scs.class_section_subject_id = new_css
        scs.updated_by = user
        scs.save(
            update_fields=[
                "class_section_id",
                "class_section_subject_id",
                "updated_by",
                "updated_at",
            ]
        )

        # Reconcile old volunteers
        for vol_id in old_vol_ids:
            reconcile_school_volunteer(school_id, vol_id)

        # Re-create volunteers (reuse new list if provided, else carry over the old list)
        if new_volunteer_ids is not None:
            _replace_volunteers(scs, new_volunteer_ids, school_id, say, user)
        else:
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
        old_vol_ids = list(
            SlotClassSectionVolunteer.objects.filter(
                slot_class_section_id=scs, is_active=True, removed=False
            ).values_list("volunteer_id_id", flat=True)
        )

        if set(new_volunteer_ids) == set(old_vol_ids):
            # Same volunteers, no actual change (e.g. the client resubmitted the
            # current list unchanged). Avoid deactivating and recreating rows
            # that would otherwise look like a spurious removal+reassignment
            # in the audit history.
            return scs

        check_r_bucket_capacity(scs.class_section_id_id, len(new_volunteer_ids))

        SlotClassSectionVolunteer.objects.filter(
            slot_class_section_id=scs, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now, updated_at=now)

        _replace_volunteers(scs, new_volunteer_ids, school_id, say, user)

        # Reconcile removed volunteers
        staying = set(new_volunteer_ids)
        for vol_id in old_vol_ids:
            if vol_id not in staying:
                reconcile_school_volunteer(school_id, vol_id)

        scs.updated_by = user
        scs.save(update_fields=["updated_by", "updated_at"])

    return scs


def _replace_volunteers(
    scs: SlotClassSection,
    vol_ids: list[int],
    school_id: int,
    say,
    user: User,
) -> None:
    """Validate and create new SCSV rows + ensure SchoolVolunteer.

    Uniqueness (R3) is enforced by the schema validator before this runs.
    """
    volunteers = []
    for vid in vol_ids:
        try:
            vol = User.objects.get(user_id=vid, is_active=True)
        except User.DoesNotExist:
            raise NotFound(f"Volunteer {vid} not found.")
        validate_volunteer_worknode_match(school_id, vol)
        # R4 before R6 — see resolve_volunteer_list's docstring for why the order
        # matters (R4's message names the school; R6 alone would mask it).
        check_r4_volunteer(vol, school_id)
        # exclude the scs itself — its own old rows may not be soft-deleted yet
        # depending on call order, but the volunteer being re-added to the same
        # slot-class they're already on isn't a real conflict.
        check_r6_volunteer_single_assignment(vol, exclude_scs=scs)
        volunteers.append(vol)

    for vol in volunteers:
        SlotClassSectionVolunteer.objects.create(
            slot_class_section_id=scs,
            volunteer_id=vol,
            created_by=user,
        )
        ensure_school_volunteer(school_id, say, vol, user)
