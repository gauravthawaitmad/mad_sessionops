from django.db import IntegrityError
from django.db.models import Count, Q, QuerySet
from django.utils import timezone

from sessionops.exceptions import ConflictError, NotFound
from sessionops.models import ChildClass, Class, SchoolClass

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

    if not Class.objects.filter(class_id=class_id, is_active=True, removed=False).exists():
        raise NotFound(f"Class {class_id} not found in catalog.")

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
