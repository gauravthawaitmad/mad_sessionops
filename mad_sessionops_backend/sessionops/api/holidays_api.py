from datetime import date
from typing import List, Optional

from ninja import Router

from sessionops.schemas.auth import ErrorResponseSchema
from sessionops.schemas.holidays import HolidayCreateIn, HolidayOut, HolidayPatchIn
from sessionops.services.holidays.create import create_holiday
from sessionops.services.holidays.delete import soft_delete_holiday
from sessionops.services.holidays.edit import edit_holiday
from sessionops.services.holidays.queries import list_holidays
from sessionops.services.rbac.scope import get_school_or_403

holidays_router = Router(tags=["Holidays"])


def _to_schema(h) -> HolidayOut:
    return HolidayOut(
        school_holiday_id=h.school_holiday_id,
        school_id=h.school_id,
        holiday_reason=h.holiday_reason,
        holiday_reason_display=h.get_holiday_reason_display_value(),
        start_date=h.start_date,
        end_date=h.end_date,
        holiday_description=h.holiday_description,
        remarks=h.remarks,
        created_at=h.created_at,
        updated_at=h.updated_at,
    )


@holidays_router.get(
    "/{school_id}/holidays/",
    response={200: List[HolidayOut], 403: ErrorResponseSchema, 404: ErrorResponseSchema},
)
def list_holidays_api(
    request,
    school_id: int,
    start_date: Optional[date] = None,
    end_date: Optional[date] = None,
):
    get_school_or_403(request.auth, school_id)
    holidays = list_holidays(school_id, start_date=start_date, end_date=end_date)
    return 200, [_to_schema(h) for h in holidays]


@holidays_router.post(
    "/{school_id}/holidays/",
    response={200: HolidayOut, 400: ErrorResponseSchema, 403: ErrorResponseSchema, 409: ErrorResponseSchema},
)
def create_holiday_api(request, school_id: int, payload: HolidayCreateIn):
    h = create_holiday(
        school_id=school_id,
        payload={
            "holiday_reason":      payload.holiday_reason,
            "start_date":          payload.start_date,
            "end_date":            payload.end_date,
            "holiday_description": payload.holiday_description,
            "remarks":             payload.remarks,
        },
        user=request.auth,
    )
    return 200, _to_schema(h)


@holidays_router.patch(
    "/{school_id}/holidays/{holiday_id}/",
    response={200: HolidayOut, 400: ErrorResponseSchema, 403: ErrorResponseSchema, 404: ErrorResponseSchema, 409: ErrorResponseSchema},
)
def edit_holiday_api(request, school_id: int, holiday_id: int, payload: HolidayPatchIn):
    patch: dict = {}
    if payload.holiday_reason is not None:
        patch["holiday_reason"] = payload.holiday_reason
    if payload.start_date is not None:
        patch["start_date"] = payload.start_date
    if payload.end_date is not None:
        patch["end_date"] = payload.end_date
    # Allow explicit null for description/remarks
    if "holiday_description" in payload.model_fields_set:
        patch["holiday_description"] = payload.holiday_description
    if "remarks" in payload.model_fields_set:
        patch["remarks"] = payload.remarks

    h = edit_holiday(holiday_id, patch, request.auth)
    return 200, _to_schema(h)


@holidays_router.delete(
    "/{school_id}/holidays/{holiday_id}/",
    response={204: None, 403: ErrorResponseSchema, 404: ErrorResponseSchema},
)
def delete_holiday_api(request, school_id: int, holiday_id: int):
    soft_delete_holiday(holiday_id, request.auth)
    return 204, None
