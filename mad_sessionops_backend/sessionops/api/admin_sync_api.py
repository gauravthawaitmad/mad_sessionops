"""Admin sync dashboard API — admin-only endpoints."""

from typing import List

from ninja import Router

from sessionops.exceptions import PermissionDenied
from sessionops.schemas.auth import ErrorResponseSchema
from sessionops.schemas.sync_admin import (
    AdminStatsOut,
    SyncRunDetailOut,
    SyncRunListItemOut,
    SyncTriggerOut,
    SyncUserByLoginIn,
    SyncUserByLoginOut,
)
from sessionops.services.auth.role_helpers import user_has_admin_access
from sessionops.services.sync.dashboard import (
    get_cron_health,
    get_entity_stats,
    get_run_detail,
    list_recent_runs,
)
from sessionops.services.sync.single_user import sync_user_by_login
from sessionops.services.sync.trigger import trigger_entity_sync, trigger_manual_sync

admin_sync_router = Router(tags=["admin-sync"])


def _require_admin(user) -> None:
    if not user_has_admin_access(user.user_role):
        raise PermissionDenied()


@admin_sync_router.get(
    "/sync/runs/",
    response={200: List[SyncRunListItemOut], 403: ErrorResponseSchema},
)
def list_sync_runs(request, limit: int = 50):
    _require_admin(request.auth)
    return 200, list(list_recent_runs(limit))


@admin_sync_router.get(
    "/sync/runs/{sync_run_id}/",
    response={200: SyncRunDetailOut, 403: ErrorResponseSchema, 404: ErrorResponseSchema},
)
def get_sync_run(request, sync_run_id: int):
    _require_admin(request.auth)
    return 200, get_run_detail(sync_run_id)


@admin_sync_router.get(
    "/sync/stats/",
    response={200: AdminStatsOut, 403: ErrorResponseSchema},
)
def get_sync_stats(request):
    _require_admin(request.auth)
    entity_stats = get_entity_stats()
    cron_health = get_cron_health()
    return 200, {
        "entity_stats": entity_stats,
        "cron_health": cron_health,
    }


@admin_sync_router.post(
    "/sync/user-by-login/",
    response={200: SyncUserByLoginOut, 403: ErrorResponseSchema, 404: ErrorResponseSchema, 409: ErrorResponseSchema},
)
def sync_user_by_login_api(request, payload: SyncUserByLoginIn):
    _require_admin(request.auth)
    result = sync_user_by_login(payload.user_login, request.auth)
    synced = result["synced_user"]
    return 200, {
        "sync_run_id": result["sync_run_id"],
        "user_login": synced.user_login,
        "user_name": synced.user_display_name,
    }


@admin_sync_router.post(
    "/sync/trigger/",
    response={200: SyncTriggerOut, 403: ErrorResponseSchema, 409: ErrorResponseSchema},
)
def trigger_sync(request, entity: str = None):
    """
    entity=None       → sync all 3 entities (global concurrent guard)
    entity=user       → sync only users (per-entity guard)
    entity=partner    → sync only partners (per-entity guard)
    entity=partner_worknode → sync only partner worknodes (per-entity guard)
    """
    _require_admin(request.auth)
    if entity:
        run_id = trigger_entity_sync(entity_type=entity, triggered_by=request.auth)
        # Map entity → response field name: user→user_run_id, partner→partner_run_id, etc.
        field = f"{entity}_run_id"
        return 200, {field: run_id}
    result = trigger_manual_sync(triggered_by=request.auth)
    return 200, result
