from django.db import transaction
from django.utils import timezone

from sessionops.exceptions import NotFound, PermissionDenied
from sessionops.models import SchoolHoliday
from sessionops.services.holidays.create import create_holiday
from sessionops.services.rbac.scope import can_modify_school, get_school_or_403


@transaction.atomic
def edit_holiday(school_holiday_id: int, payload: dict, user) -> SchoolHoliday:
    """
    Edit a holiday.

    Metadata-only edit (reason/description/remarks): updates in place.
    Date change (start_date or end_date differs): soft-deletes the current row
    and creates a new one (preserves audit history and re-checks overlap).
    """
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

    new_start = payload.get("start_date", holiday.start_date)
    new_end = payload.get("end_date", holiday.end_date)
    date_changed = (new_start != holiday.start_date) or (new_end != holiday.end_date)

    if date_changed:
        # Soft-delete current row so the overlap check won't count it
        now = timezone.now()
        holiday.is_active = False
        holiday.removed = True
        holiday.deleted_at = now
        holiday.updated_by = user
        holiday.save(
            update_fields=["is_active", "removed", "deleted_at", "updated_by", "updated_at"]
        )

        new_payload = {
            "holiday_reason": payload.get("holiday_reason", holiday.holiday_reason),
            "start_date": new_start,
            "end_date": new_end,
            "holiday_description": payload.get("holiday_description", holiday.holiday_description),
            "remarks": payload.get("remarks", holiday.remarks),
        }
        return create_holiday(holiday.school_id, new_payload, user)

    # Metadata-only in-place edit
    for field in ("holiday_reason", "holiday_description", "remarks"):
        if field in payload:
            setattr(holiday, field, payload[field])
    holiday.updated_by = user
    holiday.save(
        update_fields=[
            "holiday_reason",
            "holiday_description",
            "remarks",
            "updated_by",
            "updated_at",
        ]
    )
    return holiday
