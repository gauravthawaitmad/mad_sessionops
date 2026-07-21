from typing import Optional

from ninja import Router

from sessionops.schemas.auth import ErrorResponseSchema
from sessionops.schemas.sessions import SessionCreateIn, SessionDefaultsOut, SessionOut
from sessionops.services.sessions.create import create_school_session
from sessionops.services.sessions.get_defaults import get_session_defaults
from sessionops.services.sessions.queries import get_active_session

sessions_router = Router(tags=["Sessions"])


@sessions_router.get(
    "/{school_id}/session/",
    response={200: Optional[SessionOut], 403: ErrorResponseSchema, 404: ErrorResponseSchema},
)
def get_session(request, school_id: int):
    """Return the active session for a school, or null if not configured."""
    from sessionops.services.rbac.scope import get_school_or_403

    get_school_or_403(request.auth, school_id)
    session = get_active_session(school_id)
    return 200, session


@sessions_router.get(
    "/{school_id}/session/defaults/",
    response={200: SessionDefaultsOut, 403: ErrorResponseSchema, 404: ErrorResponseSchema},
)
def get_session_defaults_api(request, school_id: int):
    """Return MOU-based date defaults for the set-session modal pre-fill."""
    defaults = get_session_defaults(school_id, request.auth)
    return 200, defaults


@sessions_router.post(
    "/{school_id}/session/",
    response={
        200: SessionOut,
        400: ErrorResponseSchema,
        403: ErrorResponseSchema,
        409: ErrorResponseSchema,
    },
)
def create_session(request, school_id: int, payload: SessionCreateIn):
    """Create a one-time immutable academic session for the school."""
    session = create_school_session(
        school_id=school_id,
        start_date=payload.start_date,
        end_date=payload.end_date,
        user=request.auth,
    )
    return 200, session
