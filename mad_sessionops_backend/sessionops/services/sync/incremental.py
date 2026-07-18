"""
Incremental Hasura sync orchestrator — F-M4-6.

Cursor strategy (post-discussion):
  cursor_end is stored on every successful SyncRun.  It equals the max
  Hasura `updated_at` (or equivalent) seen across all rows fetched in that
  run.  The next run uses the previous run's cursor_end as its updated_after,
  so the cursor is always expressed in Hasura's time, not our processing clock.

  Clearing sync_run rows → cursor resets → next run does a full sync.
  Single-user runs are excluded from cursor lookup (they don't advance the
  bulk cursor).
"""

import logging
import time
from datetime import datetime

from django.db import close_old_connections
from django.utils import timezone as dj_timezone

from sessionops.exceptions import ConflictError
from sessionops.models import Partner, PartnerWorknode, SyncRun, User
from sessionops.services.hasura.client import (
    HasuraError,
    fetch_chapter_mapping,
    fetch_partners_updated_after,
    fetch_users_updated_after,
)
from sessionops.services.sync.upsert import (
    BATCH_SIZE,
    bulk_upsert_partners,
    bulk_upsert_users,
    parse_datetime,
    upsert_partner_worknode_row,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Cursor helpers — derived from sync_run, not from entity tables
# ---------------------------------------------------------------------------


def _get_user_cursor():
    """
    Return cursor_end from the last successful non-single-user sync_run for users.
    None → no previous run → full sync (no updated_after filter).
    """
    return (
        SyncRun.objects.filter(entity_type=SyncRun.ENTITY_TYPE_USER, status=SyncRun.STATUS_SUCCESS)
        .exclude(run_type=SyncRun.RUN_TYPE_MANUAL_SINGLE_USER)
        .order_by("-started_at")
        .values_list("cursor_end", flat=True)
        .first()
    )


def _get_partner_cursor():
    """
    Return cursor_end from the last successful partner sync_run.
    None → no previous run → full sync.
    """
    return (
        SyncRun.objects.filter(
            entity_type=SyncRun.ENTITY_TYPE_PARTNER, status=SyncRun.STATUS_SUCCESS
        )
        .order_by("-started_at")
        .values_list("cursor_end", flat=True)
        .first()
    )


def _compute_cursor_end(rows: list[dict], *field_names: str, fallback):
    """
    Return max(parse_datetime(row[field])) across all rows for the first
    matching field_name.  Falls back to `fallback` when rows is empty or
    none of the fields are present.
    """
    max_ts: datetime | None = None
    for row in rows:
        for field in field_names:
            val = parse_datetime(row.get(field))
            if val:
                if max_ts is None:
                    max_ts = val
                elif val > max_ts:
                    max_ts = val
                break  # first present field wins for this row
    return max_ts if max_ts is not None else fallback


# ---------------------------------------------------------------------------
# Entity sync helpers
# ---------------------------------------------------------------------------


def _sync_users(run_type: str, triggered_by) -> SyncRun:
    cursor = _get_user_cursor()
    run = SyncRun.objects.create(
        status=SyncRun.STATUS_RUNNING,
        run_type=run_type,
        entity_type=SyncRun.ENTITY_TYPE_USER,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_USERS,
        updated_after=cursor,
        triggered_by=triggered_by,
    )
    tag = f"[user #{run.id}]"
    t0 = time.monotonic()
    now = dj_timezone.now()
    logger.info("%s cron starting — cursor=%s", tag, cursor)

    try:
        rows = fetch_users_updated_after(cursor)
        total = len(rows)
        logger.info("%s fetched %d rows from Hasura", tag, total)
        total_created = total_updated = 0

        for batch_start in range(0, max(total, 1), BATCH_SIZE):
            close_old_connections()
            batch = rows[batch_start : batch_start + BATCH_SIZE]
            if not batch:
                break
            c, u = bulk_upsert_users(batch, now)
            total_created += c
            total_updated += u
            done = min(batch_start + BATCH_SIZE, total)
            if total > BATCH_SIZE:
                logger.info(
                    "%s batch %d/%d  created=%d updated=%d",
                    tag,
                    done,
                    total,
                    total_created,
                    total_updated,
                )

        cursor_end = _compute_cursor_end(rows, "user_updated_datetime", fallback=cursor)
        if total > 0 and cursor_end == cursor:
            logger.warning(
                "%s cursor_end unchanged — all row timestamps equal or missing (boundary overlap?), held at %s",
                tag,
                cursor,
            )

        user_logins = [
            {
                "user_login": row.get("user_login", "").lower().strip(),
                "user_name": row.get("user_display_name") or "",
            }
            for row in rows
            if row.get("user_login")
        ]

        elapsed = time.monotonic() - t0
        run.status = SyncRun.STATUS_SUCCESS
        run.cursor_end = cursor_end
        run.users_fetched = total
        run.users_created = total_created
        run.users_updated = total_updated
        run.user_logins = user_logins or None
        run.completed_at = dj_timezone.now()
        run.save(
            update_fields=[
                "status",
                "cursor_end",
                "users_fetched",
                "users_created",
                "users_updated",
                "user_logins",
                "completed_at",
            ]
        )
        logger.info(
            "%s DONE in %.1fs — fetched=%d  created=%d  updated=%d  cursor_end=%s",
            tag,
            elapsed,
            total,
            total_created,
            total_updated,
            cursor_end,
        )

    except Exception as exc:
        elapsed = time.monotonic() - t0
        run.status = SyncRun.STATUS_FAILED
        run.error_message = str(exc)
        run.completed_at = dj_timezone.now()
        run.save(update_fields=["status", "error_message", "completed_at"])
        logger.error("%s FAILED after %.1fs — %s", tag, elapsed, exc, exc_info=True)
        raise

    return run


def _sync_partners(run_type: str, triggered_by) -> SyncRun:
    cursor = _get_partner_cursor()
    run = SyncRun.objects.create(
        status=SyncRun.STATUS_RUNNING,
        run_type=run_type,
        entity_type=SyncRun.ENTITY_TYPE_PARTNER,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_PARTNERS,
        updated_after=cursor,
        triggered_by=triggered_by,
    )
    tag = f"[partner #{run.id}]"
    t0 = time.monotonic()
    now = dj_timezone.now()
    logger.info("%s cron starting — cursor=%s", tag, cursor)

    try:
        rows = fetch_partners_updated_after(cursor)
        total = len(rows)
        logger.info("%s fetched %d rows from Hasura", tag, total)
        total_created = total_updated = 0

        for batch_start in range(0, max(total, 1), BATCH_SIZE):
            close_old_connections()
            batch = rows[batch_start : batch_start + BATCH_SIZE]
            if not batch:
                break
            c, u = bulk_upsert_partners(batch, now)
            total_created += c
            total_updated += u
            done = min(batch_start + BATCH_SIZE, total)
            if total > BATCH_SIZE:
                logger.info(
                    "%s batch %d/%d  created=%d updated=%d",
                    tag,
                    done,
                    total,
                    total_created,
                    total_updated,
                )

        # Partners: prefer partner_updated_date (the CRM update timestamp), fall back to updated_at
        cursor_end = _compute_cursor_end(
            rows, "partner_updated_date", "updated_at", fallback=cursor
        )
        if total > 0 and cursor_end == cursor:
            logger.warning(
                "%s cursor_end unchanged — all row timestamps equal or missing (boundary overlap?), held at %s",
                tag,
                cursor,
            )

        partner_ids = [
            {"partner_id": row.get("partner_id"), "partner_name": row.get("partner_name") or ""}
            for row in rows
            if row.get("partner_id") is not None
        ]

        elapsed = time.monotonic() - t0
        run.status = SyncRun.STATUS_SUCCESS
        run.cursor_end = cursor_end
        run.partners_fetched = total
        run.partners_created = total_created
        run.partners_updated = total_updated
        run.partner_ids = partner_ids or None
        run.completed_at = dj_timezone.now()
        run.save(
            update_fields=[
                "status",
                "cursor_end",
                "partners_fetched",
                "partners_created",
                "partners_updated",
                "partner_ids",
                "completed_at",
            ]
        )
        logger.info(
            "%s DONE in %.1fs — fetched=%d  created=%d  updated=%d  cursor_end=%s",
            tag,
            elapsed,
            total,
            total_created,
            total_updated,
            cursor_end,
        )

    except Exception as exc:
        elapsed = time.monotonic() - t0
        run.status = SyncRun.STATUS_FAILED
        run.error_message = str(exc)
        run.completed_at = dj_timezone.now()
        run.save(update_fields=["status", "error_message", "completed_at"])
        logger.error("%s FAILED after %.1fs — %s", tag, elapsed, exc, exc_info=True)
        raise

    return run


def _sync_partner_worknode(run_type: str, triggered_by) -> SyncRun:
    run = SyncRun.objects.create(
        status=SyncRun.STATUS_RUNNING,
        run_type=run_type,
        entity_type=SyncRun.ENTITY_TYPE_PARTNER_WORKNODE,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_PARTNER_WORKNODE,
        updated_after=None,
        triggered_by=triggered_by,
    )
    tag = f"[partner_worknode #{run.id}]"
    t0 = time.monotonic()
    logger.info("%s cron starting — full sync (no cursor)", tag)

    try:
        rows = fetch_chapter_mapping()
        total = len(rows)
        logger.info("%s fetched %d rows from Hasura", tag, total)
        incoming_partner_ids: set[str] = set()
        upserted = 0

        for row in rows:
            pid = upsert_partner_worknode_row(row)
            if pid is not None:
                incoming_partner_ids.add(pid)
                upserted += 1

        deleted_count, _ = PartnerWorknode.objects.exclude(
            partner_id__in=incoming_partner_ids
        ).delete()

        elapsed = time.monotonic() - t0
        run.status = SyncRun.STATUS_SUCCESS
        run.users_fetched = upserted
        run.completed_at = dj_timezone.now()
        run.save(update_fields=["status", "users_fetched", "completed_at"])
        logger.info(
            "%s DONE in %.1fs — fetched=%d  upserted=%d  deleted=%d",
            tag,
            elapsed,
            total,
            upserted,
            deleted_count,
        )

    except Exception as exc:
        run.status = SyncRun.STATUS_FAILED
        run.error_message = str(exc)
        run.completed_at = dj_timezone.now()
        run.save(update_fields=["status", "error_message", "completed_at"])
        elapsed = time.monotonic() - t0
        logger.error("%s FAILED after %.1fs — %s", tag, elapsed, exc, exc_info=True)
        raise

    return run


# ---------------------------------------------------------------------------
# Public orchestrator (cron / auto runs)
# ---------------------------------------------------------------------------


def run_incremental_sync(run_type: str = "auto", triggered_by=None) -> dict:
    """
    Run incremental sync for all 3 entities.

    Returns {entity_type: SyncRun | None}. A None value means that entity failed.
    For manual runs only: raises ConflictError if any sync is already running.
    Auto runs skip the concurrent check (cron may overlap — acceptable in M4).
    """
    if run_type == SyncRun.RUN_TYPE_MANUAL:
        if SyncRun.objects.filter(status=SyncRun.STATUS_RUNNING).exists():
            raise ConflictError("Another sync is already in progress.")

    results: dict[str, SyncRun | None] = {}

    for entity_fn, entity_key in [
        (_sync_users, SyncRun.ENTITY_TYPE_USER),
        (_sync_partners, SyncRun.ENTITY_TYPE_PARTNER),
        (_sync_partner_worknode, SyncRun.ENTITY_TYPE_PARTNER_WORKNODE),
    ]:
        try:
            results[entity_key] = entity_fn(run_type, triggered_by)
        except Exception:
            results[entity_key] = None

    return results
