from datetime import date

from django.db import transaction

from sessionops.exceptions import ConflictError, PermissionDenied, ValidationError
from sessionops.models import SchoolSessionDetails
from sessionops.services.academic_year.queries import get_or_create_school_academic_year
from sessionops.services.rbac.scope import can_modify_school, get_school_or_403


@transaction.atomic
def create_school_session(
    school_id: int,
    start_date: date,
    end_date: date,
    user,
) -> SchoolSessionDetails:
    """
    Create an immutable academic session for the given school and the active academic year.

    Business rules enforced:
    - RBAC: user must have modify access to this school (CO own school, CHO worknode scope, admin any)
    - start_date must be strictly before end_date
    - Only one active session per (school, academic_year) — ConflictError if duplicate
    """
    partner = get_school_or_403(user, school_id)
    if not can_modify_school(user, partner):
        raise PermissionDenied()

    if start_date >= end_date:
        raise ValidationError("start_date must be before end_date.")

    say = get_or_create_school_academic_year(school_id, user)

    existing = SchoolSessionDetails.objects.filter(
        school_id=school_id,
        school_academic_year=say,
        is_active=True,
        removed=False,
    ).first()

    if existing:
        raise ConflictError(
            "Session already configured for this academic year. " "Session is immutable in M4."
        )

    return SchoolSessionDetails.objects.create(
        school_id=school_id,
        school_academic_year=say,
        start_date=start_date,
        end_date=end_date,
        created_by=user,
    )
