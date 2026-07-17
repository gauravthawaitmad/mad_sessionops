"""Admin realtime events API — admin-only endpoints for RealtimeSyncLog."""

from datetime import datetime
from typing import List, Optional

from django.utils.dateparse import parse_datetime
from ninja import Router

from sessionops.exceptions import NotFound, PermissionDenied
from sessionops.exceptions import ValidationError as BusinessValidationError
from sessionops.models import RealtimeSyncLog
from sessionops.schemas.auth import ErrorResponseSchema
from sessionops.services.auth.role_helpers import user_has_admin_access
from sessionops.services.realtime_sync.orchestrator import process_sync_event
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload
from ninja import Schema

admin_realtime_events_router = Router(tags=["admin-realtime-events"])


def _require_admin(user) -> None:
    if not user_has_admin_access(user.user_role):
        raise PermissionDenied()


# ── Schemas ────────────────────────────────────────────────────────────────────


class RealtimeSyncLogOut(Schema):
    realtime_sync_log_id: int
    user_id_from_source: int
    sync_type: str
    event_type: str
    received_at: datetime
    processed_at: Optional[datetime] = None
    status: str
    action_taken: str
    error_details: Optional[str] = None
    field_changes: Optional[list] = None
    cascaded_changes: Optional[list] = None
    deferred_operations: Optional[dict] = None
    rules_fired: Optional[list] = None
    triggered_by_user_id: Optional[int] = None
    external_event_id: Optional[str] = None

    @staticmethod
    def resolve_triggered_by_user_id(obj):
        return obj.triggered_by_id


class RealtimeSyncLogDetailOut(RealtimeSyncLogOut):
    pre_snapshot: Optional[dict] = None
    incoming_payload: Optional[dict] = None


class RealtimeSyncLogListOut(Schema):
    total: int
    page: int
    page_size: int
    results: List[RealtimeSyncLogOut]


class ManualSyncIn(Schema):
    payload: dict  # Must include user_id plus all RealtimeSyncUserPayload fields


class ManualSyncOut(Schema):
    log_id: int
    status: str
    action_taken: str
    field_changes: Optional[list] = None
    cascaded_changes: Optional[list] = None
    deferred_operations: Optional[dict] = None
    error_details: Optional[str] = None


# ── Endpoints ──────────────────────────────────────────────────────────────────


@admin_realtime_events_router.get(
    "",
    response={200: RealtimeSyncLogListOut, 403: ErrorResponseSchema},
)
def list_realtime_events(
    request,
    page: int = 1,
    page_size: int = 25,
    status: Optional[str] = None,
    sync_type: Optional[str] = None,
    event_type: Optional[str] = None,
    user_id_from_source: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
):
    _require_admin(request.auth)

    qs = RealtimeSyncLog.objects.order_by("-received_at")
    if status:
        qs = qs.filter(status=status)
    if sync_type:
        qs = qs.filter(sync_type=sync_type)
    if event_type:
        qs = qs.filter(event_type=event_type)
    if user_id_from_source is not None:
        qs = qs.filter(user_id_from_source=user_id_from_source)
    if date_from:
        dt = parse_datetime(date_from)
        if dt:
            qs = qs.filter(received_at__gte=dt)
    if date_to:
        dt = parse_datetime(date_to)
        if dt:
            qs = qs.filter(received_at__lte=dt)

    total = qs.count()
    offset = (page - 1) * page_size
    results = list(qs[offset : offset + page_size])
    return 200, {"total": total, "page": page, "page_size": page_size, "results": results}


@admin_realtime_events_router.post(
    "/sync-user",
    response={200: ManualSyncOut, 400: ErrorResponseSchema, 403: ErrorResponseSchema},
)
def manual_sync_user(request, body: ManualSyncIn):
    _require_admin(request.auth)

    raw = dict(body.payload)
    user_id = raw.pop("user_id", None)
    if user_id is None:
        raise BusinessValidationError("payload must include user_id")

    try:
        user_id = int(user_id)
    except (TypeError, ValueError):
        raise BusinessValidationError("user_id must be an integer")

    try:
        sync_payload = RealtimeSyncUserPayload(**raw)
    except Exception as e:
        raise BusinessValidationError(f"Invalid payload: {e}")

    log = process_sync_event(user_id, sync_payload, triggered_by=request.auth)
    return 200, {
        "log_id": log.realtime_sync_log_id,
        "status": log.status,
        "action_taken": log.action_taken,
        "field_changes": log.field_changes,
        "cascaded_changes": log.cascaded_changes,
        "deferred_operations": log.deferred_operations,
        "error_details": log.error_details,
    }


@admin_realtime_events_router.get(
    "/{log_id}",
    response={200: RealtimeSyncLogDetailOut, 403: ErrorResponseSchema, 404: ErrorResponseSchema},
)
def get_realtime_event(request, log_id: int):
    _require_admin(request.auth)
    try:
        return 200, RealtimeSyncLog.objects.get(realtime_sync_log_id=log_id)
    except RealtimeSyncLog.DoesNotExist:
        raise NotFound("Realtime sync log entry not found")
