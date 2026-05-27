from typing import Optional

from ninja import Router

from sessionops.schemas.auth import ErrorResponseSchema
from sessionops.schemas.schedule import ScheduleResponseSchema
from sessionops.services.slot_classes.schedule import get_school_schedule

schedule_router = Router(tags=["Schedule"])


@schedule_router.get(
    "/{school_id}/schedule/",
    response={
        200: ScheduleResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
    },
)
def get_schedule(request, school_id: int, day_of_week: Optional[str] = None):
    data = get_school_schedule(school_id, request.auth, day_of_week=day_of_week)
    return 200, data
