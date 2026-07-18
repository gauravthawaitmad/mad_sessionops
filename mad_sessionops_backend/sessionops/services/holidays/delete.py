from django.db import transaction
from django.utils import timezone

from sessionops.exceptions import NotFound, PermissionDenied
from sessionops.models import SchoolHoliday
from sessionops.services.rbac.scope import can_modify_school, get_school_or_403


@transaction.atomic
def soft_delete_holiday(school_holiday_id: int, user) -> None:
    """Soft-delete a holiday (R9: no hard deletes)."""
    try:
        holiday = SchoolHoliday.objects.select_for_update().get(
            school_holiday_id=school_holiday_id,
            removed=False,
        )
    except SchoolHoliday.DoesNotExist:
        raise NotFound(f"Holiday {school_holiday_id} not found.")

    partner = get_school_or_403(user, holiday.school_id)
    if not can_modify_school(user, partner):
        raise PermissionDenied()

    now = timezone.now()
    holiday.is_active = False
    holiday.removed = True
    holiday.deleted_at = now
    holiday.updated_by = user
    holiday.save(update_fields=["is_active", "removed", "deleted_at", "updated_by", "updated_at"])
