"""Shared helpers for slot_class CRUD services (create, edit, delete)."""

from django.utils import timezone

from sessionops.exceptions import ConflictError, NotFound, ValidationError
from sessionops.models import (
    ChildClassSection,
    Partner,
    PartnerWorknode,
    SchoolVolunteer,
    Slot,
    SlotClassSectionVolunteer,
    Subject,
    User,
)

_FOUNDATION_SUBJECT_CACHE: Subject | None = None


def get_foundation_subject() -> Subject:
    """Return the seeded Foundation Subject row, caching it at module scope.

    Safe to cache because the row is immutable at runtime once migration 0027
    has run. Tests must reset `_FOUNDATION_SUBJECT_CACHE` to None between runs.
    """
    global _FOUNDATION_SUBJECT_CACHE
    if _FOUNDATION_SUBJECT_CACHE is None:
        try:
            _FOUNDATION_SUBJECT_CACHE = Subject.objects.get(subject_name="Foundation")
        except Subject.DoesNotExist:
            raise ValidationError(
                "Configuration error: 'Foundation' Subject row not seeded. "
                "Run migration 0027 before using slot-class create/edit."
            )
    return _FOUNDATION_SUBJECT_CACHE


def normalize_subject_display_name(subject_name: str) -> str:
    """Collapse legacy pre-M6 subject names ('Foundation Day 1', 'Foundation Day 2')
    to 'Foundation' for display. DB values are left untouched (Dots reads the raw
    column); this only affects what the read-path schemas return to the frontend.
    """
    if subject_name.startswith("Foundation"):
        return "Foundation"
    return subject_name


def check_r_bucket_capacity(class_section_id: int, volunteer_count: int) -> None:
    """Raise ValidationError (R-bucket) if volunteer_count exceeds the bucket's active children."""
    active_children = ChildClassSection.objects.filter(
        class_section_id=class_section_id, is_active=True, removed=False
    ).count()
    if volunteer_count > active_children:
        raise ValidationError(
            f"Cannot assign {volunteer_count} volunteers — "
            f"bucket has only {active_children} child(ren). "
            f"Maximum {active_children} volunteer(s) allowed."
        )


def resolve_volunteer_list(volunteer_ids: list[int], school_id: int, slot: Slot) -> list[User]:
    """Resolve, validate (worknode match, R4, R6), and return User objects for volunteer_ids.

    R3 (uniqueness) is already enforced by the schema validator before this runs.
    Used by create_slot_class only — edit_slot_class's _replace_volunteers has its
    own resolution loop because its R6 check must exclude the slot-class being edited.
    """
    volunteers = []
    for vid in volunteer_ids:
        try:
            vol = User.objects.get(user_id=vid, is_active=True)
        except User.DoesNotExist:
            raise NotFound(f"Volunteer {vid} not found.")
        validate_volunteer_worknode_match(school_id, vol)
        check_r6_volunteer_in_slot(slot, vol)
        check_r4_volunteer(vol, school_id)
        volunteers.append(vol)
    return volunteers


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
        slot_class_section_id__slot_id=slot.slot_id,
        slot_class_section_id__is_active=True,
        slot_class_section_id__removed=False,
    ).exists():
        raise ConflictError(
            f"{volunteer.user_display_name} is already assigned to another class " "in this slot."
        )


def check_r4_volunteer(volunteer: User, school_id: int) -> None:
    """Raise ConflictError (R4) if volunteer has an active SchoolVolunteer row at a different school."""
    other_sv = (
        SchoolVolunteer.objects.filter(volunteer_id=volunteer, is_active=True, removed=False)
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
