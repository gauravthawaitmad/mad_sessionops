from django.db import IntegrityError
from django.db.models import Count, Q, QuerySet
from django.utils import timezone

from sessionops.exceptions import ConflictError, NotFound, ValidationError
from sessionops.models import ChildClass, Class, SchoolClass

# MAD's program scope is 5th-7th for now; 8th only exists because last year's
# 7th-graders progress into it (via Bubble's child/academic-year progression,
# not yet rebuilt here post-M6 decoupling). Nobody should be able to newly
# add class 8 to a school until that progression flow lands in Session-Ops.
BLOCKED_NEW_CLASS_CODES = frozenset(["8"])

# ── Classes ────────────────────────────────────────────────────────────────────


def list_classes_for_school(school_id: int) -> QuerySet:
    return (
        SchoolClass.objects.filter(school_id=school_id, is_active=True, removed=False)
        .select_related("class_id", "class_id__program_id")
        .annotate(
            sections_count=Count(
                "classsection",
                filter=Q(classsection__is_active=True, classsection__removed=False),
            )
        )
        .order_by("class_id__class_code")
    )


def add_class_to_school(school_id: int, class_id: int, user) -> SchoolClass:
    from sessionops.services.academic_year.queries import get_or_create_school_academic_year

    try:
        cls = Class.objects.get(class_id=class_id, is_active=True, removed=False)
    except Class.DoesNotExist:
        raise NotFound(f"Class {class_id} not found in catalog.")

    if cls.class_code in BLOCKED_NEW_CLASS_CODES:
        raise ValidationError(
            f"Class {cls.class_name} cannot be added directly. "
            f"It is only reachable via year-end progression from a lower class."
        )

    say = get_or_create_school_academic_year(school_id, user)
    try:
        sc = SchoolClass.objects.create(
            school_id=school_id,
            school_academic_year_id=say,
            class_id_id=class_id,
            created_by=user,
        )
        # Re-fetch with related so schema resolvers work
        return (
            SchoolClass.objects.select_related("class_id", "class_id__program_id")
            .annotate(
                sections_count=Count(
                    "classsection",
                    filter=Q(classsection__is_active=True, classsection__removed=False),
                )
            )
            .get(school_class_id=sc.school_class_id)
        )
    except IntegrityError:
        raise ConflictError("This class is already added to this school for the current year.")


def soft_delete_school_class(school_class_id: int, school_id: int, user) -> None:
    try:
        sc = SchoolClass.objects.get(
            school_class_id=school_class_id,
            school_id=school_id,
            is_active=True,
            removed=False,
        )
    except SchoolClass.DoesNotExist:
        raise NotFound(f"School class {school_class_id} not found.")

    # M6 decoupled classes from sections/buckets (buckets never set school_class_id —
    # see M6 decision #1), so class deletion must guard against active *children*
    # directly assigned via ChildClass, not against sections/buckets anymore.
    active_children = ChildClass.objects.filter(
        school_class_id=sc, is_active=True, removed=False
    ).count()
    if active_children > 0:
        raise ConflictError(
            f"Cannot remove class: {active_children} active child(ren) enrolled. "
            f"Remove or reassign them first."
        )

    now = timezone.now()
    sc.is_active = False
    sc.removed = True
    sc.deleted_at = now
    sc.updated_by = user
    sc.save(update_fields=["is_active", "removed", "deleted_at", "updated_by", "updated_at"])
