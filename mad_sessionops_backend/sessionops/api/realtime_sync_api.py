"""
Internal realtime sync endpoint.

Security model:
  - auth=_resolve_auth runs as a Ninja auth callback, which Ninja evaluates
    before it parses/validates the request body. This matters: if auth were
    checked inside the view body instead, a malformed/unauthenticated probe
    would trip Pydantic's 422 validation error (leaking the payload schema)
    before auth ever ran. Routing it through `auth=` means bad/missing
    credentials always get a clean 401 first.
  - _resolve_auth validates either an admin JWT or a service token, and sets
    request.auth to the authenticated User (admin JWT) or SERVICE_PRINCIPAL
    (service token) for the view to read.
  - The endpoint URL is a non-guessable path set via INTERNAL_SYNC_ENDPOINT_PATH env var.
  - Service token value is never logged.
"""

import logging

from ninja import Router

from sessionops.exceptions import AuthenticationError
from sessionops.models import User
from sessionops.services.realtime_sync.auth import validate_service_token
from sessionops.services.realtime_sync.orchestrator import process_sync_event
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload

_log = logging.getLogger(__name__)

router = Router(tags=["internal-sync"])

# Truthy sentinel for request.auth when a service token (not an admin user) authenticated.
SERVICE_PRINCIPAL = "service"


def _resolve_auth(request) -> User | str:
    """
    Ninja auth callback: returns the authenticated User for admin JWT callers,
    or SERVICE_PRINCIPAL for service token callers. Raising AuthenticationError
    here is handled by Ninja's on_exception dispatch the same as if it were
    raised from inside a view, so the existing 401 response/format is unchanged.
    """
    auth_header = request.headers.get("Authorization", "")

    # Service token path (M8b automated callers)
    if validate_service_token(auth_header):
        _log.info("realtime_sync: service token auth succeeded")
        return SERVICE_PRINCIPAL

    # Admin JWT path (M8a manual admin trigger)
    if auth_header.startswith("Bearer "):
        token = auth_header[len("Bearer ") :]
        try:
            from rest_framework_simplejwt.tokens import AccessToken

            from sessionops.services.auth.role_helpers import user_has_admin_access

            payload = AccessToken(token).payload
            user_id = payload.get("user_id")
            if user_id:
                user = User.objects.filter(user_id=user_id, is_active=True).first()
                if user and user_has_admin_access(user.user_role):
                    return user
        except (
            Exception
        ):  # nosec B110 — any JWT parse/validation failure just falls through to "not authenticated" below
            pass

    raise AuthenticationError("Valid admin JWT or service token required")


@router.post("/{user_id}", auth=_resolve_auth)
def sync_user_endpoint(request, user_id: int, payload: RealtimeSyncUserPayload):
    triggered_by = request.auth if isinstance(request.auth, User) else None
    log = process_sync_event(user_id, payload, triggered_by=triggered_by)
    return {
        "log_id": log.realtime_sync_log_id,
        "status": log.status,
        "action_taken": log.action_taken,
        "field_changes": log.field_changes,
        "cascaded_changes": log.cascaded_changes,
        "deferred_operations": log.deferred_operations,
    }
