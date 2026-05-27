from __future__ import annotations

from django.db import transaction

from sessionops.exceptions import ConflictError, NotFound, ValidationError
from sessionops.models import (
    BatchChild,
    Child,
    ChildClass,
    ChildClassSection,
    ChildProgram,
    ChildSubject,
    ClassSection,
    ClassSectionSubject,
    Partner,
    SchoolAcademicYear,
    User,
)
from sessionops.schemas.children import ChildEnrollIn

FOUNDATION_PROGRAM_ID = 1
MAX_CHILDREN_PER_SECTION = 5


def enroll_child(school_id: int, payload: ChildEnrollIn, user: User) -> Child:
    with transaction.atomic():
        # 1. Lock section row to prevent concurrent capacity violations
        try:
            section = (
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

        # 2. Section capacity check (R1: max 5 children per section)
        occupied = ChildClassSection.objects.filter(
            class_section_id=section,
            is_active=True,
            removed=False,
        ).count()
        if occupied >= MAX_CHILDREN_PER_SECTION:
            raise ConflictError(
                f"Section is full ({MAX_CHILDREN_PER_SECTION}/{MAX_CHILDREN_PER_SECTION})."
            )

        # 3. School confirmed-child-count cap
        try:
            partner = Partner.objects.get(partner_id=school_id)
        except Partner.DoesNotExist:
            raise NotFound(f"School {school_id} not found.")

        if partner.confirmed_child_count is not None:
            active_batch = BatchChild.objects.filter(
                school_id=school_id,
                is_active=True,
                removed=False,
            ).count()
            if active_batch >= partner.confirmed_child_count:
                raise ConflictError("School has reached its confirmed child limit.")

        # 4. Cross-school section validation
        if section.school_id != school_id:
            raise ValidationError("Section does not belong to this school.")

        # 5. Resolve SchoolAcademicYear (must exist; guaranteed if section exists)
        try:
            say = SchoolAcademicYear.objects.get(
                school_id=school_id,
                is_active=True,
                removed=False,
            )
        except SchoolAcademicYear.DoesNotExist:
            raise ConflictError("No active academic year binding found for this school.")

        # 6. Create Child
        child = Child.objects.create(
            school_id=school_id,
            first_name=payload.first_name,
            last_name=payload.last_name,
            gender=payload.gender,
            age=payload.age,
            city=payload.city,
            mother_tongue=payload.mother_tongue,
            date_of_birth=payload.date_of_birth,
            date_of_enrollment=payload.date_of_enrollment,
            mad_joining_date=payload.mad_joining_date,
            created_by=user,
        )
        # 7. Link to SchoolClass via ChildClass
        ChildClass.objects.create(
            child_id=child,
            school_class_id_id=section.school_class_id_id,
            created_by=user,
        )
        # 8. Link to ClassSection via ChildClassSection
        ChildClassSection.objects.create(
            child_id=child,
            class_section_id=section,
            created_by=user,
        )
        # 9. Link to school's academic year batch
        BatchChild.objects.create(
            school_academic_year_id=say,
            child_id=child,
            school_id=school_id,
            created_by=user,
        )
        # 10. Auto-assign Foundation Program
        ChildProgram.objects.create(
            program_id_id=FOUNDATION_PROGRAM_ID,
            child_id=child,
            created_by=user,
        )

        # 11. M3 extension: create ChildSubject for any active subjects on this section
        active_css = list(
            ClassSectionSubject.objects.filter(
                class_section_id=section,
                is_active=True,
                removed=False,
            )
        )
        if active_css:
            ChildSubject.objects.bulk_create([
                ChildSubject(
                    child_id=child,
                    class_section_subject_id=css,
                    created_by=user,
                )
                for css in active_css
            ])

    # Re-fetch with annotations for response serialization
    from sessionops.services.children.queries import list_children
    return list_children(school_id).get(child_id=child.child_id)
