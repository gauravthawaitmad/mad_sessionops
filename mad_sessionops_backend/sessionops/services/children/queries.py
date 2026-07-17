from __future__ import annotations

from django.db.models import OuterRef, Q, QuerySet, Subquery

from sessionops.models import Child, ChildClass, ChildClassSection


def list_children(
    school_id: int,
    *,
    section_id: int | None = None,
    class_id: int | None = None,
    status: str = "active",
    search: str | None = None,
    unassigned: bool = False,
) -> QuerySet:
    qs = Child.objects.filter(school_id=school_id)

    if status == "active":
        qs = qs.filter(is_active=True, removed=False)
    elif status == "inactive":
        qs = qs.filter(is_active=False, removed=False)  # deactivated, not hard-deleted
    else:  # "all"
        qs = qs.filter(removed=False)

    # Annotate current section name and class name from active assignments
    qs = qs.annotate(
        current_section_name=Subquery(
            ChildClassSection.objects
            .filter(child_id=OuterRef("pk"), is_active=True, removed=False)
            .values("class_section_id__section_name")[:1]
        ),
        current_section_display_name=Subquery(
            ChildClassSection.objects
            .filter(child_id=OuterRef("pk"), is_active=True, removed=False)
            .values("class_section_id__section_display_name")[:1]
        ),
        current_class_name=Subquery(
            ChildClass.objects
            .filter(child_id=OuterRef("pk"), is_active=True, removed=False)
            .values("school_class_id__class_id__class_name")[:1]
        ),
        # IDs needed for filtering
        _current_section_id=Subquery(
            ChildClassSection.objects
            .filter(child_id=OuterRef("pk"), is_active=True, removed=False)
            .values("class_section_id")[:1]
        ),
        _current_school_class_id=Subquery(
            ChildClass.objects
            .filter(child_id=OuterRef("pk"), is_active=True, removed=False)
            .values("school_class_id")[:1]
        ),
    )

    if unassigned:
        qs = qs.filter(_current_section_id__isnull=True)
    elif section_id:
        qs = qs.filter(_current_section_id=section_id)
    if class_id:
        qs = qs.filter(_current_school_class_id=class_id)
    if search:
        qs = qs.filter(Q(first_name__icontains=search) | Q(last_name__icontains=search))

    return qs.order_by("first_name", "last_name")
