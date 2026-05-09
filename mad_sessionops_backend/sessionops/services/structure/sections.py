from django.db import IntegrityError
from django.db.models import Count, Q, QuerySet
from django.utils import timezone

from sessionops.exceptions import ConflictError, NotFound
from sessionops.models import ClassSection, ChildClassSection, SchoolClass
from sessionops.models.class_section import SECTION_CODES


def list_sections_for_class(school_class_id: int) -> QuerySet:
    return (
        ClassSection.objects
        .filter(school_class_id=school_class_id, is_active=True, removed=False)
        .annotate(
            active_children_count=Count(
                "childclasssection",
                filter=Q(childclasssection__is_active=True, childclasssection__removed=False),
            )
        )
        .order_by("section_code")
    )


def available_section_codes(school_class_id: int) -> list[str]:
    used = set(
        ClassSection.objects
        .filter(school_class_id=school_class_id, removed=False)
        .values_list("section_code", flat=True)
    )
    return [c for c in SECTION_CODES if c not in used]


def add_section_to_class(
    school_class_id: int, school_id: int, section_code: str, user
) -> ClassSection:
    try:
        sc = SchoolClass.objects.select_related("class_id").get(
            school_class_id=school_class_id, school_id=school_id,
            is_active=True, removed=False,
        )
    except SchoolClass.DoesNotExist:
        raise NotFound(f"School class {school_class_id} not found.")

    section_name = f"{sc.class_id.class_name} - {section_code}"

    try:
        section = ClassSection.objects.create(
            school_class_id=sc,
            school_id=school_id,
            section_code=section_code,
            section_name=section_name,
            created_by=user,
        )
    except IntegrityError:
        raise ConflictError(f"Section {section_code} already exists for this class.")

    # Re-fetch with annotation so the schema resolver finds active_children_count.
    return (
        ClassSection.objects
        .annotate(
            active_children_count=Count(
                "childclasssection",
                filter=Q(childclasssection__is_active=True, childclasssection__removed=False),
            )
        )
        .get(class_section_id=section.class_section_id)
    )


def count_active_children_in_section(class_section_id: int) -> int:
    return ChildClassSection.objects.filter(
        class_section_id=class_section_id, is_active=True, removed=False
    ).count()


def soft_delete_section(class_section_id: int, school_id: int, user) -> None:
    try:
        cs = ClassSection.objects.get(
            class_section_id=class_section_id, school_id=school_id,
            is_active=True, removed=False,
        )
    except ClassSection.DoesNotExist:
        raise NotFound(f"Section {class_section_id} not found.")

    count = count_active_children_in_section(class_section_id)
    if count > 0:
        raise ConflictError(f"Cannot remove section: {count} active child(ren) enrolled.")

    now = timezone.now()
    cs.is_active = False
    cs.removed = True
    cs.deleted_at = now
    cs.updated_by = user
    cs.save(update_fields=["is_active", "removed", "deleted_at", "updated_by", "updated_at"])
