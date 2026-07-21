from sessionops.exceptions import NotFound
from sessionops.models import SchoolSessionDetails
from sessionops.services.academic_year.queries import get_active_academic_year


def get_active_session(school_id: int) -> SchoolSessionDetails | None:
    """
    Return the active session for the school in the current academic year.
    Returns None if the active year is missing or no session is configured.
    """
    try:
        active_year = get_active_academic_year()
    except NotFound:
        return None

    return SchoolSessionDetails.objects.filter(
        school_id=school_id,
        school_academic_year__academic_year_id=active_year,
        is_active=True,
        removed=False,
    ).first()
