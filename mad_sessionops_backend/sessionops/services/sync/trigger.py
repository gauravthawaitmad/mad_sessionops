"""
Manual sync trigger — F-M4-7 / per-entity.

Async pattern:
  1. Pre-create SyncRun(status=running) rows in the HTTP request thread.
  2. Spawn a daemon thread to do the actual Hasura work.
  3. Return run IDs immediately.

Per-entity: each entity has its own concurrent guard.
Sync-all: checks global lock (any entity running → block).
"""

import logging
import threading
import time
from typing import Literal

from django.db import close_old_connections
from django.db import connection as django_connection
from django.utils import timezone as dj_timezone

from sessionops.exceptions import ConflictError
from sessionops.models import PartnerWorknode, SyncRun, User
from sessionops.services.hasura.client import (
    fetch_chapter_mapping,
    fetch_partners_updated_after,
    fetch_users_updated_after,
)
from sessionops.services.sync.incremental import (
    _compute_cursor_end,
    _get_partner_cursor,
    _get_user_cursor,
)
from sessionops.services.sync.upsert import (
    BATCH_SIZE,
    bulk_upsert_partners,
    bulk_upsert_users,
    upsert_partner_worknode_row,
)

logger = logging.getLogger(__name__)

EntityType = Literal["user", "partner", "partner_worknode"]

_ENTITY_SYNC_TYPE_MAP = {
    "user": SyncRun.ENTITY_SYNC_TYPE_USERS,
    "partner": SyncRun.ENTITY_SYNC_TYPE_PARTNERS,
    "partner_worknode": SyncRun.ENTITY_SYNC_TYPE_PARTNER_WORKNODE,
}

# ── helpers ───────────────────────────────────────────────────────────────────


def _tag(entity: str, run_id: int) -> str:
    """Consistent log prefix: [user #42]"""
    return f"[{entity} #{run_id}]"


# ---------------------------------------------------------------------------
# Per-entity sync helpers (operate on a pre-created SyncRun row)
# ---------------------------------------------------------------------------


def _execute_user_sync(run: SyncRun) -> None:
    tag = _tag("user", run.id)
    t0 = time.monotonic()
    try:
        cursor = _get_user_cursor()
        run.updated_after = cursor
        run.save(update_fields=["updated_after"])
        logger.info("%s starting — cursor=%s", tag, cursor)

        rows = fetch_users_updated_after(cursor)
        total = len(rows)
        logger.info("%s fetched %d rows from Hasura", tag, total)

        total_created = total_updated = 0
        now = dj_timezone.now()

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

        cursor_end = _compute_cursor_end(rows, "user_updated_datetime", fallback=run.updated_after)
        if total > 0 and cursor_end == run.updated_after:
            logger.warning(
                "%s cursor_end unchanged — all row timestamps equal or missing (boundary overlap?), held at %s",
                tag,
                run.updated_after,
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


def _execute_partner_sync(run: SyncRun) -> None:
    tag = _tag("partner", run.id)
    t0 = time.monotonic()
    try:
        cursor = _get_partner_cursor()
        run.updated_after = cursor
        run.save(update_fields=["updated_after"])
        logger.info("%s starting — cursor=%s", tag, cursor)

        rows = fetch_partners_updated_after(cursor)
        total = len(rows)
        logger.info("%s fetched %d rows from Hasura", tag, total)

        total_created = total_updated = 0
        now = dj_timezone.now()

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

        cursor_end = _compute_cursor_end(
            rows, "partner_updated_date", "updated_at", fallback=run.updated_after
        )
        if total > 0 and cursor_end == run.updated_after:
            logger.warning(
                "%s cursor_end unchanged — all row timestamps equal or missing (boundary overlap?), held at %s",
                tag,
                run.updated_after,
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


def _execute_partner_worknode_sync(run: SyncRun) -> None:
    tag = _tag("partner_worknode", run.id)
    t0 = time.monotonic()
    try:
        logger.info("%s starting — full sync (no cursor)", tag)
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
        run.users_fetched = upserted  # reuse users_fetched to surface PW count in records_fetched
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
        elapsed = time.monotonic() - t0
        run.status = SyncRun.STATUS_FAILED
        run.error_message = str(exc)
        run.completed_at = dj_timezone.now()
        run.save(update_fields=["status", "error_message", "completed_at"])
        logger.error("%s FAILED after %.1fs — %s", tag, elapsed, exc, exc_info=True)


_EXECUTE_MAP = {
    "user": _execute_user_sync,
    "partner": _execute_partner_sync,
    "partner_worknode": _execute_partner_worknode_sync,
}


# ---------------------------------------------------------------------------
# Core trigger
# ---------------------------------------------------------------------------


def _trigger_entities(
    entity_types: list[str], triggered_by: User, global_lock: bool
) -> dict[str, int]:
    if global_lock:
        if SyncRun.objects.filter(status=SyncRun.STATUS_RUNNING).exists():
            raise ConflictError("Another sync is already in progress. Try again in a moment.")
    else:
        for et in entity_types:
            if SyncRun.objects.filter(status=SyncRun.STATUS_RUNNING, entity_type=et).exists():
                raise ConflictError(f"{et} sync is already running.")

    runs: dict[str, SyncRun] = {}
    for et in entity_types:
        runs[et] = SyncRun.objects.create(
            entity_type=et,
            entity_sync_type=_ENTITY_SYNC_TYPE_MAP[et],
            run_type=SyncRun.RUN_TYPE_MANUAL,
            status=SyncRun.STATUS_RUNNING,
            triggered_by=triggered_by,
        )

    triggered_by_name = triggered_by.user_display_name if triggered_by else "cron"
    logger.info(
        "trigger: starting manual sync for %s — triggered_by=%s", entity_types, triggered_by_name
    )

    def _background() -> None:
        close_old_connections()
        try:
            for et, run in runs.items():
                _EXECUTE_MAP[et](run)
        except Exception as exc:
            for run in runs.values():
                try:
                    run.refresh_from_db()
                    if run.status == SyncRun.STATUS_RUNNING:
                        run.status = SyncRun.STATUS_FAILED
                        run.error_message = f"Thread error: {exc}"
                        run.completed_at = dj_timezone.now()
                        run.save(update_fields=["status", "error_message", "completed_at"])
                except Exception:  # nosec B110 — best-effort; real error is logged below regardless
                    pass
            logger.error("trigger: background thread crashed — %s", exc, exc_info=True)
        finally:
            django_connection.close()

    threading.Thread(target=_background, daemon=True).start()
    return {et: run.id for et, run in runs.items()}


# ---------------------------------------------------------------------------
# Public entry points
# ---------------------------------------------------------------------------


def trigger_entity_sync(entity_type: str, triggered_by: User) -> int:
    """Trigger sync for a single entity. Per-entity concurrent guard."""
    if entity_type not in _ENTITY_SYNC_TYPE_MAP:
        from sessionops.exceptions import ValidationError

        raise ValidationError(f"Unknown entity type: {entity_type}")
    result = _trigger_entities([entity_type], triggered_by, global_lock=False)
    return result[entity_type]


def trigger_manual_sync(triggered_by: User) -> dict:
    """Trigger sync for all 3 entities. Global concurrent guard."""
    result = _trigger_entities(
        ["user", "partner", "partner_worknode"], triggered_by, global_lock=True
    )
    return {
        "user_run_id": result["user"],
        "partner_run_id": result["partner"],
        "partner_worknode_run_id": result["partner_worknode"],
    }
