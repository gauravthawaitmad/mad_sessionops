"""
Internal realtime sync endpoint.

Security model:
  - auth=None disables the default CustomJwtAuthMiddleware for this route.
  - _resolve_auth manually validates either an admin JWT or a service token.
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


@router.post("/{user_id}", auth=None)
def sync_user_endpoint(request, user_id: int, payload: RealtimeSyncUserPayload):
    triggered_by = _resolve_auth(request)
    log = process_sync_event(user_id, payload, triggered_by=triggered_by)
    return {
        "log_id": log.realtime_sync_log_id,
        "status": log.status,
        "action_taken": log.action_taken,
        "field_changes": log.field_changes,
        "cascaded_changes": log.cascaded_changes,
        "deferred_operations": log.deferred_operations,
    }


def _resolve_auth(request) -> User | None:
    """
    Returns the authenticated User for admin JWT callers, or None for service token callers.
    Raises AuthenticationError if neither auth method passes.
    """
    auth_header = request.headers.get("Authorization", "")

    # Service token path (M8b automated callers)
    if validate_service_token(auth_header):
        _log.info("realtime_sync: service token auth succeeded")
        return None

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
        except Exception:
            pass

    raise AuthenticationError("Valid admin JWT or service token required")
