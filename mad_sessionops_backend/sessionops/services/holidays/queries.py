from datetime import date

from sessionops.models import SchoolHoliday


def list_holidays(
    school_id: int,
    start_date: date | None = None,
    end_date: date | None = None,
) -> list[SchoolHoliday]:
    """
    Return active, non-removed holidays for the school ordered by start_date.
    Optional date window filter: returns holidays that overlap [start_date, end_date].
    """
    qs = SchoolHoliday.objects.filter(
        school_id=school_id,
        is_active=True,
        removed=False,
    ).order_by("start_date")

    if start_date:
        qs = qs.filter(end_date__gte=start_date)
    if end_date:
        qs = qs.filter(start_date__lte=end_date)

    return list(qs)
