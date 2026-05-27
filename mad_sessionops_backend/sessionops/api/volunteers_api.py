from ninja import Router

from sessionops.schemas.volunteers import VolunteerListResponseSchema
from sessionops.services.volunteers.list import list_school_volunteers

volunteers_router = Router(tags=["Volunteers"])


@volunteers_router.get("/{school_id}/volunteers/", response=VolunteerListResponseSchema)
def list_volunteers(request, school_id: int):
    result = list_school_volunteers(school_id, request.auth)
    return result
