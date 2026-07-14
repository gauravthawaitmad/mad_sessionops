"""
F-M6-3: Bucket-children add/remove — managing membership after a child
already exists. Populates ChildSubject idempotently on add; never touches
it on remove (Dots needs historical continuity, per M6 decision #2).
"""

from django.db import transaction
from django.db.models import Count, Q
from django.utils import timezone

from sessionops.exceptions import ConflictError, NotFound
from sessionops.models import (
    Child,
    ChildClassSection,
    ChildSubject,
    ClassSection,
    ClassSectionSubject,
    SlotClassSection,
)

MAX_CHILDREN_PER_BUCKET = 5  # same rule as MAX_CHILDREN_PER_SECTION in enroll.py — R1 is one rule


@transaction.atomic
def add_child_to_bucket(school_id: int, class_section_id: int, child_id: int, user) -> ChildClassSection:
    bucket = ClassSection.objects.select_for_update().filter(
        class_section_id=class_section_id, school_id=school_id, is_active=True, removed=False,
    ).first()
    if not bucket:
        raise NotFound(f"Bucket {class_section_id} not found.")

    child = Child.objects.select_for_update().filter(
        child_id=child_id, school_id=school_id, is_active=True, removed=False,
    ).first()
    if not child:
        raise NotFound(f"Child {child_id} not found.")

    existing = ChildClassSection.objects.filter(
        child_id=child, is_active=True, removed=False
    ).select_related("class_section_id").first()
    if existing:
        if existing.class_section_id_id == class_section_id:
            return existing  # idempotent no-op
        raise ConflictError(
            f"{child.first_name} {child.last_name} is already in bucket "
            f'"{existing.class_section_id.section_display_name or existing.class_section_id.section_name}". '
            f"Remove them from that bucket first."
        )

    occupied = ChildClassSection.objects.filter(
        class_section_id=bucket, is_active=True, removed=False
    ).count()
    if occupied >= MAX_CHILDREN_PER_BUCKET:
        raise ConflictError(f"Bucket is full ({MAX_CHILDREN_PER_BUCKET}/{MAX_CHILDREN_PER_BUCKET}).")

    ccs = ChildClassSection.objects.create(child_id=child, class_section_id=bucket, created_by=user)

    active_css = list(ClassSectionSubject.objects.filter(
        class_section_id=bucket, is_active=True, removed=False
    ))
    for css in active_css:
        ChildSubject.objects.get_or_create(
            child_id=child, class_section_subject_id=css, defaults={"created_by": user},
        )

    return ccs


@transaction.atomic
def remove_child_from_bucket(school_id: int, class_section_id: int, child_id: int, user) -> None:
    bucket = ClassSection.objects.select_for_update().filter(
        class_section_id=class_section_id, school_id=school_id, is_active=True, removed=False,
    ).first()
    if not bucket:
        raise NotFound(f"Bucket {class_section_id} not found.")

    ccs = ChildClassSection.objects.select_for_update().filter(
        child_id=child_id, class_section_id=bucket, is_active=True, removed=False,
    ).first()
    if not ccs:
        raise NotFound(f"Child {child_id} is not in this bucket.")

    remaining_children = ChildClassSection.objects.filter(
        class_section_id=bucket, is_active=True, removed=False,
    ).exclude(child_class_section_id=ccs.child_class_section_id).count()

    active_slot_classes = SlotClassSection.objects.filter(
        class_section_id=bucket, is_active=True, removed=False,
    ).annotate(vol_count=Count(
        "slotclasssectionvolunteer",
        filter=Q(slotclasssectionvolunteer__is_active=True, slotclasssectionvolunteer__removed=False),
    ))
    for scs in active_slot_classes:
        if scs.vol_count > remaining_children:
            raise ConflictError(
                f"Cannot remove child. A scheduled slot-class for this bucket has "
                f"{scs.vol_count} volunteers and would have only {remaining_children} children. "
                f"Remove a volunteer from the slot-class first."
            )

    now = timezone.now()
    ccs.is_active = False
    ccs.removed = True
    ccs.deleted_at = now
    ccs.updated_by = user
    ccs.save(update_fields=["is_active", "removed", "deleted_at", "updated_by", "updated_at"])
    # ChildSubject rows are intentionally NOT touched — retained for Dots history.
