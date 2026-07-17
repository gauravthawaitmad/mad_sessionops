"""Shared helpers for slot_class CRUD services (create, edit, delete)."""

from django.utils import timezone

from sessionops.exceptions import ConflictError, ValidationError
from sessionops.models import (
    Partner,
    PartnerWorknode,
    SchoolVolunteer,
    Slot,
    SlotClassSection,
    SlotClassSectionVolunteer,
    User,
)


def validate_volunteer_worknode_match(school_id: int, volunteer: User) -> None:
    """Raise ValidationError if volunteer is not in the school's Worknode list."""
    if volunteer.worknode_id is None:
        raise ValidationError(
            f"{volunteer.user_display_name} has no Worknode ID and cannot be "
            "assigned to a slot-class."
        )
    if not PartnerWorknode.objects.filter(
        partner_id=str(school_id),
        worknode_id=volunteer.worknode_id,
    ).exists():
        raise ValidationError(
            f"{volunteer.user_display_name} is not listed as a volunteer at this "
            "school according to Worknode records."
        )


def check_r6_volunteer_in_slot(slot: Slot, volunteer: User) -> None:
    """Raise ConflictError (R6) if volunteer is already in another slot-class in this slot."""
    if SlotClassSectionVolunteer.objects.filter(
        volunteer_id=volunteer,
        is_active=True,
        removed=False,
        slot_class_section_id__slot_id=slot,
        slot_class_section_id__is_active=True,
        slot_class_section_id__removed=False,
    ).exists():
        raise ConflictError(
            f"{volunteer.user_display_name} is already assigned to another class "
            "in this slot."
        )


def check_r4_volunteer(volunteer: User, school_id: int) -> None:
    """Raise ConflictError (R4) if volunteer has an active SchoolVolunteer row at a different school."""
    other_sv = (
        SchoolVolunteer.objects
        .filter(volunteer_id=volunteer, is_active=True, removed=False)
        .exclude(school_id=school_id)
        .first()
    )
    if other_sv:
        try:
            other_partner = Partner.objects.get(partner_id=other_sv.school_id)
            school_name = other_partner.partner_name
        except Partner.DoesNotExist:
            school_name = f"school {other_sv.school_id}"
        raise ConflictError(
            f"{volunteer.user_display_name} is already at school '{school_name}'. "
            "Remove them from there first."
        )


def ensure_school_volunteer(school_id: int, say, volunteer: User, created_by: User) -> None:
    """Create a SchoolVolunteer row if the volunteer isn't already active at this school."""
    if not SchoolVolunteer.objects.filter(
        school_id=school_id,
        volunteer_id=volunteer,
        is_active=True,
        removed=False,
    ).exists():
        SchoolVolunteer.objects.create(
            school_id=school_id,
            school_academic_year_id=say,
            volunteer_id=volunteer,
            created_by=created_by,
        )


def reconcile_school_volunteer(school_id: int, volunteer_user_id: int) -> None:
    """Soft-delete the SchoolVolunteer row if the volunteer has no remaining active assignments at this school."""
    has_remaining = SlotClassSectionVolunteer.objects.filter(
        volunteer_id_id=volunteer_user_id,
        is_active=True,
        removed=False,
        slot_class_section_id__slot_id__school_id=school_id,
        slot_class_section_id__is_active=True,
        slot_class_section_id__removed=False,
    ).exists()
    if not has_remaining:
        sv = SchoolVolunteer.objects.filter(
            school_id=school_id,
            volunteer_id_id=volunteer_user_id,
            is_active=True,
            removed=False,
        ).first()
        if sv:
            sv.is_active = False
            sv.removed = True
            sv.deleted_at = timezone.now()
            sv.save(update_fields=["is_active", "removed", "deleted_at", "updated_at"])
