from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from sessionops.exceptions import ConflictError, NotFound, ValidationError
from sessionops.models import (
    Child,
    ChildClass,
    ChildClassSection,
    ChildSubject,
    ClassSection,
    ClassSectionSubject,
    User,
)
from sessionops.schemas.children import ChildEditIn
from sessionops.services.children.enroll import MAX_CHILDREN_PER_SECTION
from sessionops.services.rbac.scope import get_school_or_403

_DEMOGRAPHIC_FIELDS = [
    "first_name", "last_name", "gender", "age",
    "date_of_birth", "city", "mother_tongue",
    "date_of_enrollment", "mad_joining_date",
]


def edit_child(child_id: int, payload: ChildEditIn, user: User):
    with transaction.atomic():
        # Lock child row to prevent concurrent edits
        try:
            child = (
                Child.objects
                .select_for_update()
                .get(child_id=child_id, is_active=True, removed=False)
            )
        except Child.DoesNotExist:
            raise NotFound(f"Child {child_id} not found.")

        # RBAC: CO may only edit children at their assigned schools
        get_school_or_403(user, child.school_id)

        # Update demographic fields (only non-None values from payload)
        update_fields = ["updated_by_id", "updated_at"]
        for field in _DEMOGRAPHIC_FIELDS:
            val = getattr(payload, field, None)
            if val is not None:
                setattr(child, field, val)
                update_fields.append(field)
        child.updated_by = user
        child.save(update_fields=update_fields)

        # Handle section / class change
        if payload.class_section_id is not None:
            try:
                new_section = (
                    ClassSection.objects
                    .select_for_update()
                    .get(
                        class_section_id=payload.class_section_id,
                        is_active=True,
                        removed=False,
                    )
                )
            except ClassSection.DoesNotExist:
                raise NotFound(f"Section {payload.class_section_id} not found.")

            # Cross-school guard
            if new_section.school_id != child.school_id:
                raise ValidationError("Target section belongs to a different school.")

            now = timezone.now()
            current_ccs = ChildClassSection.objects.filter(
                child_id=child, is_active=True, removed=False
            ).first()

            # Only create history rows when the section actually changes
            if current_ccs is None or current_ccs.class_section_id_id != payload.class_section_id:
                # Capacity check on the target section
                occupied = ChildClassSection.objects.filter(
                    class_section_id=new_section, is_active=True, removed=False
                ).count()
                if occupied >= MAX_CHILDREN_PER_SECTION:
                    raise ConflictError(
                        f"Section is full ({MAX_CHILDREN_PER_SECTION}/{MAX_CHILDREN_PER_SECTION})."
                    )

                # Soft-delete current ChildClassSection (if any)
                if current_ccs:
                    current_ccs.is_active = False
                    current_ccs.removed = True
                    current_ccs.deleted_at = now
                    current_ccs.updated_by = user
                    current_ccs.save()

                # Insert new ChildClassSection
                ChildClassSection.objects.create(
                    child_id=child,
                    class_section_id=new_section,
                    created_by=user,
                )

                # M3 extension: sync ChildSubject rows on section change
                # Soft-delete old ChildSubject rows (via old ClassSectionSubject rows)
                if current_ccs:
                    old_css_ids = list(
                        ClassSectionSubject.objects.filter(
                            class_section_id_id=current_ccs.class_section_id_id,
                            removed=False,
                        ).values_list("class_section_subject_id", flat=True)
                    )
                    if old_css_ids:
                        ChildSubject.objects.filter(
                            child_id=child,
                            class_section_subject_id_id__in=old_css_ids,
                            is_active=True,
                            removed=False,
                        ).update(
                            is_active=False,
                            removed=True,
                            deleted_at=now,
                            updated_by=user,
                            updated_at=now,
                        )

                # Create ChildSubject rows for new section's active subjects
                new_active_css = list(
                    ClassSectionSubject.objects.filter(
                        class_section_id=new_section,
                        is_active=True,
                        removed=False,
                    )
                )
                if new_active_css:
                    ChildSubject.objects.bulk_create([
                        ChildSubject(
                            child_id=child,
                            class_section_subject_id=css,
                            created_by=user,
                        )
                        for css in new_active_css
                    ])

                # Handle class change when section moves to a different SchoolClass
                current_cc = ChildClass.objects.filter(
                    child_id=child, is_active=True, removed=False
                ).first()
                new_school_class_id = new_section.school_class_id_id

                if current_cc and current_cc.school_class_id_id != new_school_class_id:
                    current_cc.is_active = False
                    current_cc.removed = True
                    current_cc.deleted_at = now
                    current_cc.updated_by = user
                    current_cc.save()

                    ChildClass.objects.create(
                        child_id=child,
                        school_class_id=new_section.school_class_id,
                        created_by=user,
                    )

    # Re-fetch with annotations for serialization
    from sessionops.services.children.queries import list_children
    return list_children(child.school_id).get(child_id=child_id)
