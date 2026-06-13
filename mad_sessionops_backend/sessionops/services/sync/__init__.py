import logging
from typing import Callable

import sentry_sdk
from django.db import close_old_connections
from django.utils import timezone as dj_timezone

from sessionops.models import Partner, PartnerWorknode, SyncRun, User
from sessionops.services.hasura.client import fetch_chapter_mapping, fetch_partners, fetch_users
from sessionops.services.sync.upsert import (
    BATCH_SIZE as _BATCH_SIZE,
    bulk_upsert_partners as _bulk_upsert_partners,
    bulk_upsert_users as _bulk_upsert_users,
    parse_date as _parse_date,
    parse_datetime as _parse_datetime,
    to_int as _int,
    to_str as _str,
    upsert_partner_worknode_row,
)

logger = logging.getLogger(__name__)

# Re-export for backward compat with existing tests
_build_user_obj = None   # internal — use upsert.build_user_obj directly if needed
_build_partner_obj = None


# ---------------------------------------------------------------------------
# Internal phase runners (legacy M1 all-entities sync)
# ---------------------------------------------------------------------------

def _run_users_phase(sync_run: SyncRun, now, progress: Callable[[str], None]) -> None:
    progress("Fetching users from Hasura...")
    rows = fetch_users()
    total = len(rows)
    progress(f"  Fetched {total} users. Upserting in batches of {_BATCH_SIZE}...")

    total_created = total_updated = 0
    for batch_start in range(0, total, _BATCH_SIZE):
        close_old_connections()
        batch = rows[batch_start:batch_start + _BATCH_SIZE]
        batch_created, batch_updated = _bulk_upsert_users(batch, now)
        total_created += batch_created
        total_updated += batch_updated
        done = min(batch_start + _BATCH_SIZE, total)
        progress(f"  [{done}/{total}] users — created={total_created} updated={total_updated}")

    sync_run.users_fetched = total
    sync_run.users_created = total_created
    sync_run.users_updated = total_updated
    logger.info(
        "Hasura sync: users done — fetched=%d created=%d updated=%d",
        total, total_created, total_updated,
    )


def _run_partners_phase(sync_run: SyncRun, now, progress: Callable[[str], None]) -> None:
    progress("Fetching partners from Hasura...")
    rows = fetch_partners()
    total = len(rows)
    progress(f"  Fetched {total} partners. Upserting in batches of {_BATCH_SIZE}...")

    total_created = total_updated = 0
    for batch_start in range(0, total, _BATCH_SIZE):
        close_old_connections()
        batch = rows[batch_start:batch_start + _BATCH_SIZE]
        batch_created, batch_updated = _bulk_upsert_partners(batch, now)
        total_created += batch_created
        total_updated += batch_updated
        done = min(batch_start + _BATCH_SIZE, total)
        progress(f"  [{done}/{total}] partners — created={total_created} updated={total_updated}")

    sync_run.partners_fetched = total
    sync_run.partners_created = total_created
    sync_run.partners_updated = total_updated
    logger.info(
        "Hasura sync: partners done — fetched=%d created=%d updated=%d",
        total, total_created, total_updated,
    )


def _run_partner_worknode_phase(sync_run: SyncRun, now, progress: Callable[[str], None]) -> None:
    """Upsert PartnerWorknode from Hasura chapter_mapping (full-sync, hard-delete removed rows)."""
    progress("Fetching chapter_mapping from Hasura...")
    rows = fetch_chapter_mapping()
    total = len(rows)
    progress(f"  Fetched {total} chapter_mapping rows. Upserting...")

    incoming_partner_ids: set[str] = set()
    upserted = 0
    for row in rows:
        pid = upsert_partner_worknode_row(row)
        if pid is not None:
            incoming_partner_ids.add(pid)
            upserted += 1

    deleted_count, _ = PartnerWorknode.objects.exclude(partner_id__in=incoming_partner_ids).delete()
    progress(f"  partner_worknode: upserted={upserted} deleted={deleted_count}")
    logger.info(
        "Hasura sync: partner_worknode done — fetched=%d upserted=%d deleted=%d",
        total, upserted, deleted_count,
    )


# ---------------------------------------------------------------------------
# Legacy M1 sync entry points (kept for backward compat with existing tests)
# ---------------------------------------------------------------------------

def _execute_sync(entity_sync_type: str, phases, progress: Callable[[str], None] | None) -> SyncRun:
    def _p(msg: str) -> None:
        if progress:
            progress(msg)

    sync_run = SyncRun.objects.create(
        status=SyncRun.STATUS_RUNNING,
        entity_sync_type=entity_sync_type,
        run_type=SyncRun.RUN_TYPE_AUTO,
    )
    now = dj_timezone.now()

    try:
        for phase in phases:
            phase(sync_run, now, _p)

        sync_run.status = SyncRun.STATUS_SUCCESS
        sync_run.completed_at = dj_timezone.now()
        sync_run.save()

    except Exception as exc:
        sync_run.status = SyncRun.STATUS_FAILED
        sync_run.error_message = str(exc)
        sync_run.completed_at = dj_timezone.now()
        sync_run.save()
        sentry_sdk.capture_exception(exc)
        logger.error("Hasura sync (%s) failed: %s", entity_sync_type, exc)
        raise

    return sync_run


def run_user_sync(progress: Callable[[str], None] | None = None) -> SyncRun:
    return _execute_sync(SyncRun.ENTITY_SYNC_TYPE_USERS, [_run_users_phase], progress)


def run_partner_sync(progress: Callable[[str], None] | None = None) -> SyncRun:
    return _execute_sync(SyncRun.ENTITY_SYNC_TYPE_PARTNERS, [_run_partners_phase], progress)


def run_partner_worknode_sync(progress: Callable[[str], None] | None = None) -> SyncRun:
    return _execute_sync(SyncRun.ENTITY_SYNC_TYPE_PARTNER_WORKNODE, [_run_partner_worknode_phase], progress)


def run_sync(progress: Callable[[str], None] | None = None) -> SyncRun:
    return _execute_sync(
        SyncRun.ENTITY_SYNC_TYPE_ALL,
        [_run_users_phase, _run_partners_phase, _run_partner_worknode_phase],
        progress,
    )
