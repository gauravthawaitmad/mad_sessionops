"""
Sync admin dashboard services.

Read-only queries powering the /admin Data Sync tab.
"""

import datetime as dt
from zoneinfo import ZoneInfo

from django.db.models import Q, QuerySet
from django.utils import timezone as dj_timezone

from sessionops.models import Partner, PartnerWorknode, SyncRun, User

_IST = ZoneInfo("Asia/Kolkata")
_CRON_HOURS = [8, 10, 12, 14, 16, 18]
_CRON_HEALTH_THRESHOLD_HOURS = 2


def list_recent_runs(limit: int = 50) -> QuerySet:
    limit = min(limit, 200)
    return SyncRun.objects.select_related("triggered_by").order_by("-started_at")[:limit]


def get_run_detail(sync_run_id: int) -> SyncRun:
    from sessionops.exceptions import NotFound

    try:
        return SyncRun.objects.select_related("triggered_by").get(id=sync_run_id)
    except SyncRun.DoesNotExist:
        raise NotFound(f"SyncRun {sync_run_id} not found.")


def _last_successful_sync_for(entity_key: str) -> "dt.datetime | None":
    """Return started_at of the most recent successful run that included entity_key."""
    old_types_map = {
        "user": [SyncRun.ENTITY_SYNC_TYPE_USERS, SyncRun.ENTITY_SYNC_TYPE_ALL],
        "partner": [SyncRun.ENTITY_SYNC_TYPE_PARTNERS, SyncRun.ENTITY_SYNC_TYPE_ALL],
        "partner_worknode": [
            SyncRun.ENTITY_SYNC_TYPE_PARTNER_WORKNODE,
            SyncRun.ENTITY_SYNC_TYPE_ALL,
        ],
    }
    old_types = old_types_map.get(entity_key, [SyncRun.ENTITY_SYNC_TYPE_ALL])
    run = (
        SyncRun.objects.filter(
            Q(entity_type=entity_key) | Q(entity_sync_type__in=old_types, entity_type__isnull=True),
            status=SyncRun.STATUS_SUCCESS,
        )
        .order_by("-started_at")
        .first()
    )
    return run.started_at if run else None


def get_entity_stats() -> dict:
    """Return active/inactive/removed counts and last_successful_sync for each entity type."""

    # --- User ---
    all_users = User.objects.all()
    user_active = all_users.filter(is_active=True).count()
    user_inactive = all_users.filter(is_active=False, deleted_at__isnull=True).count()
    user_removed = all_users.filter(deleted_at__isnull=False).count()
    user_last = _last_successful_sync_for("user")

    # --- Partner ---
    partner_active = Partner.objects.count()
    partner_inactive = Partner.all_objects.filter(is_active=False, deleted_at__isnull=True).count()
    partner_removed = Partner.all_objects.filter(deleted_at__isnull=False).count()
    partner_last = _last_successful_sync_for("partner")

    # --- PartnerWorknode (no soft-delete) ---
    pw_total = PartnerWorknode.objects.count()
    pw_last = _last_successful_sync_for("partner_worknode")

    return {
        "user": {
            "total": user_active + user_inactive + user_removed,
            "active": user_active,
            "inactive": user_inactive,
            "removed": user_removed,
            "last_successful_sync": user_last,
        },
        "partner": {
            "total": partner_active + partner_inactive + partner_removed,
            "active": partner_active,
            "inactive": partner_inactive,
            "removed": partner_removed,
            "last_successful_sync": partner_last,
        },
        "partner_worknode": {
            "total": pw_total,
            "active": pw_total,
            "inactive": 0,
            "removed": 0,
            "last_successful_sync": pw_last,
        },
    }


def _next_cron_run(now: dt.datetime) -> dt.datetime:
    """Return the next 8/10/12/14/16/18 IST slot strictly after now."""
    now_ist = now.astimezone(_IST)
    today = now_ist.date()
    for hour in _CRON_HOURS:
        candidate = dt.datetime(today.year, today.month, today.day, hour, 0, 0, tzinfo=_IST)
        if candidate > now_ist:
            return candidate
    tomorrow = today + dt.timedelta(days=1)
    return dt.datetime(
        tomorrow.year, tomorrow.month, tomorrow.day, _CRON_HOURS[0], 0, 0, tzinfo=_IST
    )


def get_cron_health() -> dict:
    """Return cron health based on most recent auto-run success within 2 hours."""
    last_run = (
        SyncRun.objects.filter(
            Q(run_type=SyncRun.RUN_TYPE_AUTO) | Q(run_type__isnull=True),
            status=SyncRun.STATUS_SUCCESS,
        )
        .order_by("-started_at")
        .first()
    )

    now = dj_timezone.now()

    if last_run is None:
        return {
            "healthy": False,
            "last_successful_sync_at": None,
            "hours_since_last_success": None,
            "next_expected_run": _next_cron_run(now),
            "reason": "no_successful_sync_ever",
        }

    hours_since = (now - last_run.started_at).total_seconds() / 3600
    healthy = hours_since <= _CRON_HEALTH_THRESHOLD_HOURS

    return {
        "healthy": healthy,
        "last_successful_sync_at": last_run.started_at,
        "hours_since_last_success": round(hours_since, 2),
        "next_expected_run": _next_cron_run(now),
        "reason": None,
    }
