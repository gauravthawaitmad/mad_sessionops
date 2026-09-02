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
    Program,
    SchoolAcademicYear,
    SchoolClass,
    User,
)
from sessionops.schemas.children import ChildEnrollIn
from sessionops.services.structure.queries import assert_class_not_blocked_for_assignment

MAX_CHILDREN_PER_SECTION = 5


def get_foundation_program_id() -> int:
    """
    Return the PK of the "Foundation Program" row by name, not a hardcoded
    literal. A literal PK assumption isn't safe: Program (like Class, and per
    the M7 migration registry) is expected to carry real IDs imported from
    Bubble, and even locally, whichever code happens to create "Foundation
    Program" first gets whatever the sequence currently points at — nothing
    guarantees that's 1 (see migration 0027's history for exactly this bug).
    """
    try:
        return Program.objects.get(program_name="Foundation Program").program_id
    except Program.DoesNotExist:
        raise ValidationError(
            "Configuration error: 'Foundation Program' row not found. "
            "Seed or import the Program catalog before enrolling/reactivating children."
        )


def enroll_child(school_id: int, payload: ChildEnrollIn, user: User) -> Child:
    with transaction.atomic():
        # 1. Validate school_class_id belongs to this school (class is now mandatory
        # and independent of any bucket — was previously derived from the section).
        try:
            school_class = SchoolClass.objects.select_related("class_id").get(
                school_class_id=payload.school_class_id,
                school_id=school_id,
                is_active=True,
                removed=False,
            )
        except SchoolClass.DoesNotExist:
            raise NotFound(f"School class {payload.school_class_id} not found.")

        assert_class_not_blocked_for_assignment(
            school_class.class_id.class_code, school_class.class_id.class_name
        )

        # 2. If a bucket is given, lock + validate + capacity check (R1). Bucket
        # assignment is optional at enrollment (M6 decision #9).
        bucket = None
        if payload.class_section_id is not None:
            try:
                bucket = ClassSection.objects.select_for_update().get(
                    class_section_id=payload.class_section_id,
                    is_active=True,
                    removed=False,
                )
            except ClassSection.DoesNotExist:
                raise NotFound(f"Bucket {payload.class_section_id} not found.")
            if bucket.school_id != school_id:
                raise ValidationError("Bucket does not belong to this school.")
            occupied = ChildClassSection.objects.filter(
                class_section_id=bucket,
                is_active=True,
                removed=False,
            ).count()
            if occupied >= MAX_CHILDREN_PER_SECTION:
                raise ConflictError(
                    f"Bucket is full ({MAX_CHILDREN_PER_SECTION}/{MAX_CHILDREN_PER_SECTION})."
                )

        # 3. School confirmed-child-count cap
        try:
            partner = Partner.objects.get(partner_id=school_id)
        except Partner.DoesNotExist:
            raise NotFound(f"School {school_id} not found.")

        if partner.confirmed_child_count is not None:
            active_count = Child.objects.filter(
                school_id=school_id,
                is_active=True,
                removed=False,
            ).count()
            if active_count >= partner.confirmed_child_count:
                raise ConflictError("School has reached its confirmed child limit.")

        # 4. Resolve SchoolAcademicYear
        try:
            say = SchoolAcademicYear.objects.get(
                school_id=school_id,
                is_active=True,
                removed=False,
            )
        except SchoolAcademicYear.DoesNotExist:
            raise ConflictError("No active academic year binding found for this school.")

        # 5. Create Child
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
        # 6. Always link to SchoolClass via ChildClass (from payload, not derived)
        ChildClass.objects.create(
            child_id=child,
            school_class_id=school_class,
            created_by=user,
        )
        # 7. If a bucket was given, link it + backfill ChildSubject idempotently
        if bucket:
            ChildClassSection.objects.create(
                child_id=child,
                class_section_id=bucket,
                created_by=user,
            )
            active_css = list(
                ClassSectionSubject.objects.filter(
                    class_section_id=bucket,
                    is_active=True,
                    removed=False,
                )
            )
            for css in active_css:
                ChildSubject.objects.get_or_create(
                    child_id=child,
                    class_section_subject_id=css,
                    defaults={"created_by": user},
                )
        # 8. Link to school's academic year batch
        BatchChild.objects.create(
            school_academic_year_id=say,
            child_id=child,
            school_id=school_id,
            created_by=user,
        )
        # 9. Auto-assign Foundation Program
        ChildProgram.objects.create(
            program_id_id=get_foundation_program_id(),
            child_id=child,
            created_by=user,
        )

    # Re-fetch with annotations for response serialization
    from sessionops.services.children.queries import list_children

    return list_children(school_id).get(child_id=child.child_id)
