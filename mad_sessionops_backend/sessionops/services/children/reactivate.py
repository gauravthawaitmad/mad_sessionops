from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from sessionops.exceptions import ConflictError, NotFound, ValidationError
from sessionops.models import (
    BatchChild,
    Child,
    ChildClass,
    ChildClassSection,
    ChildProgram,
    ChildRemovalLog,
    ChildSubject,
    ClassSection,
    ClassSectionSubject,
    Partner,
    SchoolAcademicYear,
    SchoolClass,
    User,
)
from sessionops.schemas.children import ReactivateIn
from sessionops.services.children.enroll import FOUNDATION_PROGRAM_ID, MAX_CHILDREN_PER_SECTION
from sessionops.services.rbac.scope import get_school_or_403


def reactivate_child(child_id: int, payload: ReactivateIn, user: User) -> Child:
    with transaction.atomic():
        # 1. Lock and validate — child must be deactivated (is_active=False, not hard-deleted)
        try:
            child = (
                Child.objects
                .select_for_update()
                .get(child_id=child_id, is_active=False, removed=False)
            )
        except Child.DoesNotExist:
            if Child.objects.filter(child_id=child_id, is_active=True).exists():
                raise ValidationError("Child is already active.")
            raise NotFound(f"Child {child_id} not found.")

        # 2. RBAC
        get_school_or_403(user, child.school_id)

        # 3. Validate school_class_id belongs to this school (class is mandatory,
        # independent of any bucket — same fix as enroll_child, F-M6-4).
        try:
            school_class = SchoolClass.objects.select_related("class_id").get(
                school_class_id=payload.school_class_id,
                school_id=child.school_id,
                is_active=True,
                removed=False,
            )
        except SchoolClass.DoesNotExist:
            raise NotFound(f"School class {payload.school_class_id} not found.")

        # 4. If a bucket is given, lock + validate + capacity check (R1). Bucket
        # assignment is optional on reactivation, same as enrollment.
        bucket = None
        if payload.class_section_id is not None:
            try:
                bucket = (
                    ClassSection.objects
                    .select_for_update()
                    .get(
                        class_section_id=payload.class_section_id,
                        is_active=True,
                        removed=False,
                    )
                )
            except ClassSection.DoesNotExist:
                raise NotFound(f"Bucket {payload.class_section_id} not found.")
            if bucket.school_id != child.school_id:
                raise ValidationError("Bucket belongs to a different school.")
            occupied = ChildClassSection.objects.filter(
                class_section_id=bucket, is_active=True, removed=False
            ).count()
            if occupied >= MAX_CHILDREN_PER_SECTION:
                raise ConflictError(
                    f"Bucket is full ({MAX_CHILDREN_PER_SECTION}/{MAX_CHILDREN_PER_SECTION})."
                )

        # 5. School-level capacity check
        partner = Partner.objects.get(partner_id=child.school_id)
        if partner.confirmed_child_count is not None:
            active_count = BatchChild.objects.filter(
                school_id=child.school_id, is_active=True, removed=False
            ).count()
            if active_count >= partner.confirmed_child_count:
                raise ConflictError("School has reached its confirmed child limit.")

        now = timezone.now()

        # 6. Reactivate Child row
        child.is_active = True
        child.updated_by = user
        child.save(update_fields=["is_active", "updated_by_id", "updated_at"])

        # 7. Resolve active SchoolAcademicYear for this school
        try:
            say = SchoolAcademicYear.objects.get(
                school_id=child.school_id, is_active=True, removed=False
            )
        except SchoolAcademicYear.DoesNotExist:
            raise ConflictError("No active academic year binding found for this school.")

        # 8. Always recreate ChildClass from payload.school_class_id
        ChildClass.objects.create(
            child_id=child,
            school_class_id=school_class,
            created_by=user,
        )
        # 9. If a bucket was given, link it + backfill ChildSubject idempotently
        if bucket:
            ChildClassSection.objects.create(
                child_id=child,
                class_section_id=bucket,
                created_by=user,
            )
            active_css = list(
                ClassSectionSubject.objects.filter(
                    class_section_id=bucket, is_active=True, removed=False,
                )
            )
            for css in active_css:
                ChildSubject.objects.get_or_create(
                    child_id=child, class_section_subject_id=css,
                    defaults={"created_by": user},
                )
        BatchChild.objects.create(
            school_academic_year_id=say,
            child_id=child,
            school_id=child.school_id,
            created_by=user,
        )
        ChildProgram.objects.create(
            program_id_id=FOUNDATION_PROGRAM_ID,
            child_id=child,
            created_by=user,
        )

        # 10. Mark current ChildRemovalLog inactive
        ChildRemovalLog.objects.filter(
            child_id=child, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now)

    # Re-fetch with annotations for serialization
    from sessionops.services.children.queries import list_children
    return list_children(child.school_id).get(child_id=child_id)
