import logging
import time
from datetime import date, datetime, timezone
from typing import Callable

import sentry_sdk
from django.db import IntegrityError, OperationalError, transaction
from django.db import close_old_connections
from django.utils import timezone as dj_timezone

from sessionops.models import Partner, PartnerWorknode, SyncRun, User
from sessionops.services.hasura.client import fetch_chapter_mapping, fetch_partners, fetch_users

logger = logging.getLogger(__name__)

_BATCH_SIZE = 500
_PROGRESS_INTERVAL = _BATCH_SIZE  # one progress line per batch

_USER_UPDATE_FIELDS = ["user_login", "user_display_name", "email", "user_role", "worknode_id", "synced_at"]

_PARTNER_UPDATE_FIELDS = [
    "partner_name", "co_id", "co_name",
    "address_line_1", "address_line_2", "city", "city_id", "state", "state_id", "pincode",
    "school_type", "partner_affiliation_type",
    "poc_name", "poc_email", "poc_designation", "poc_contact",
    "mou_sign_date", "mou_start_date", "mou_end_date", "mou_url",
    "converted", "crm_partner_removed", "latest_conversion_stage", "lead_source",
    "date_of_first_contact", "confirmed_child_count", "total_child_count", "classes",
    "partner_created_date", "partner_updated_date", "synced_at", "is_active",
]


# ---------------------------------------------------------------------------
# Field parsing helpers
# ---------------------------------------------------------------------------

def _parse_date(value) -> date | None:
    if not value:
        return None
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except (ValueError, TypeError):
        return None


def _parse_datetime(value) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None


def _str(value) -> str | None:
    if value is None:
        return None
    s = str(value).strip()
    return s if s else None


def _int(value) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


# ---------------------------------------------------------------------------
# Object builders
# ---------------------------------------------------------------------------

def _build_user_obj(row: dict, now: datetime) -> User | None:
    user_id = row.get("user_id")
    if not user_id:
        return None
    return User(
        user_id=user_id,
        user_login=(row.get("user_login") or "").lower().strip(),
        user_display_name=_str(row.get("user_display_name")) or "",
        email=(row.get("email") or "").lower().strip(),
        user_role=_str(row.get("user_role")) or "",
        worknode_id=_int(row.get("worknode_id")),
        synced_at=now,
    )


def _build_partner_obj(row: dict, now: datetime) -> Partner | None:
    partner_id = _int(row.get("partner_id"))
    if partner_id is None:
        return None
    crm_removed = bool(row.get("crm_partner_removed", False))
    return Partner(
        partner_id=partner_id,
        partner_name=_str(row.get("partner_name")) or "",
        co_id=_int(row.get("co_id")),
        co_name=_str(row.get("co_name")),
        address_line_1=_str(row.get("address_line_1")),
        address_line_2=_str(row.get("address_line_2")),
        city=_str(row.get("city")),
        city_id=_int(row.get("city_id")),
        state=_str(row.get("state")),
        state_id=_int(row.get("state_id")),
        pincode=_int(row.get("pincode")),
        school_type=_str(row.get("school_type")),
        partner_affiliation_type=_str(row.get("partner_affiliation_type")),
        poc_name=_str(row.get("poc_name")),
        poc_email=_str(row.get("poc_email")),
        poc_designation=_str(row.get("poc_designation")),
        poc_contact=_str(row.get("poc_contact")),
        mou_sign_date=_parse_date(row.get("mou_sign_date")),
        mou_start_date=_parse_date(row.get("mou_start_date")),
        mou_end_date=_parse_date(row.get("mou_end_date")),
        mou_url=_str(row.get("mou_url")),
        converted=bool(row.get("converted", False)),
        crm_partner_removed=crm_removed,
        latest_conversion_stage=_str(row.get("latest_conversion_stage")),
        lead_source=_str(row.get("lead_source")),
        date_of_first_contact=_parse_datetime(row.get("date_of_first_contact")),
        confirmed_child_count=_int(row.get("confirmed_child_count")),
        total_child_count=_int(row.get("total_child_count")),
        classes=_str(row.get("classes")),
        partner_created_date=_parse_datetime(row.get("partner_created_date")),
        partner_updated_date=_parse_datetime(row.get("partner_updated_date")),
        synced_at=now,
        is_active=not crm_removed,
    )


# ---------------------------------------------------------------------------
# Single-row fallback (used only when bulk hits a user_login collision)
# ---------------------------------------------------------------------------

def _upsert_user_single(row: dict, now: datetime) -> bool:
    user_id = row.get("user_id")
    if not user_id:
        return False
    defaults = {
        "user_login": (row.get("user_login") or "").lower().strip(),
        "user_display_name": _str(row.get("user_display_name")) or "",
        "email": (row.get("email") or "").lower().strip(),
        "user_role": _str(row.get("user_role")) or "",
        "worknode_id": _int(row.get("worknode_id")),
        "synced_at": now,
    }
    for attempt in range(2):
        try:
            with transaction.atomic():
                _, created = User.objects.update_or_create(user_id=user_id, defaults=defaults)
                return created
        except IntegrityError:
            # Only remaining unique constraint is user_login — restamp the existing row
            user_login = defaults["user_login"]
            logger.warning(
                "upsert_user_single: user_login=%s exists under a different user_id; "
                "updating that row to user_id=%s", user_login, user_id,
            )
            with transaction.atomic():
                User.objects.filter(user_login=user_login).update(user_id=user_id, **defaults)
            return False
        except OperationalError:
            if attempt == 0:
                logger.warning("upsert_user_single: connection lost, reconnecting...")
                close_old_connections()
                time.sleep(2)
            else:
                raise
    return False


# ---------------------------------------------------------------------------
# Bulk upsert helpers
# ---------------------------------------------------------------------------

def _bulk_upsert_users(batch_rows: list[dict], now: datetime) -> tuple[int, int]:
    """
    Bulk upsert a batch of user rows using INSERT ... ON CONFLICT DO UPDATE.
    Returns (created, updated).
    Falls back to row-by-row if a user_login uniqueness collision is hit.
    """
    objects = [obj for row in batch_rows if (obj := _build_user_obj(row, now))]
    if not objects:
        return 0, 0

    batch_ids = [o.user_id for o in objects]
    existing_ids = set(
        User.objects.filter(user_id__in=batch_ids).values_list("user_id", flat=True)
    )

    try:
        User.objects.bulk_create(
            objects,
            update_conflicts=True,
            update_fields=_USER_UPDATE_FIELDS,
            unique_fields=["user_id"],
        )
        created = sum(1 for o in objects if o.user_id not in existing_ids)
        updated = len(objects) - created
        return created, updated

    except IntegrityError:
        # user_login collision on a new user_id — fall back to row-by-row for this batch
        logger.warning("bulk_upsert_users: IntegrityError, falling back to row-by-row for batch")
        created = updated = 0
        for row in batch_rows:
            if _upsert_user_single(row, now):
                created += 1
            else:
                updated += 1
        return created, updated


def _bulk_upsert_partners(batch_rows: list[dict], now: datetime) -> tuple[int, int]:
    """
    Bulk upsert a batch of partner rows using INSERT ... ON CONFLICT DO UPDATE.
    Uses all_objects manager so soft-deleted rows are found and reactivated.
    Returns (created, updated).
    """
    objects = [obj for row in batch_rows if (obj := _build_partner_obj(row, now))]
    if not objects:
        return 0, 0

    batch_ids = [o.partner_id for o in objects]
    existing_ids = set(
        Partner.all_objects.filter(partner_id__in=batch_ids).values_list("partner_id", flat=True)
    )

    for attempt in range(2):
        try:
            Partner.all_objects.bulk_create(
                objects,
                update_conflicts=True,
                update_fields=_PARTNER_UPDATE_FIELDS,
                unique_fields=["partner_id"],
            )
            created = sum(1 for o in objects if o.partner_id not in existing_ids)
            updated = len(objects) - created
            return created, updated
        except OperationalError:
            if attempt == 0:
                logger.warning("bulk_upsert_partners: connection lost, reconnecting...")
                close_old_connections()
                time.sleep(2)
            else:
                raise
    return 0, 0


# ---------------------------------------------------------------------------
# Internal phase runners
# ---------------------------------------------------------------------------

def _run_users_phase(sync_run: SyncRun, now: datetime, progress: Callable[[str], None]) -> None:
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


def _run_partners_phase(sync_run: SyncRun, now: datetime, progress: Callable[[str], None]) -> None:
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


# ---------------------------------------------------------------------------
# Partner-Worknode phase
# ---------------------------------------------------------------------------

def _run_partner_worknode_phase(sync_run: SyncRun, now: datetime, progress: Callable[[str], None]) -> None:
    """Upsert PartnerWorknode from Hasura chapter_mapping.

    Hasura field 'chapter_id' maps to our 'partner_id' (the upsert key).
    Rows no longer in Hasura are hard-deleted (sync mirror — no soft-delete).
    """
    progress("Fetching chapter_mapping from Hasura...")
    rows = fetch_chapter_mapping()
    total = len(rows)
    progress(f"  Fetched {total} chapter_mapping rows. Upserting...")

    incoming_partner_ids: set[str] = set()
    upserted = 0
    for row in rows:
        chapter_id = row.get("chapter_id")
        worknode_id = row.get("worknode_id")
        if chapter_id is None or worknode_id is None:
            continue
        partner_id = str(chapter_id)
        incoming_partner_ids.add(partner_id)
        PartnerWorknode.objects.update_or_create(
            partner_id=partner_id,
            defaults={
                "worknode_id":            _int(worknode_id) or worknode_id,
                "city_name":              _str(row.get("city_name")),
                "state":                  _str(row.get("state")),
                "co_name":                _str(row.get("co_name")),
                "chapter_name":           _str(row.get("chapter_name")),
                "engine":                 _str(row.get("engine")),
                "chapter_status":         _str(row.get("chapter_status")),
                "sourcing_campaign_code": _str(row.get("sourcing_campaign_code")),
                "campaign_name":          _str(row.get("campaign_name")),
                "fundraiser_id":          _str(row.get("fundraiser_id")),
                "fundraiser_name":        _str(row.get("fundraiser_name")),
            },
        )
        upserted += 1

    deleted_count, _ = PartnerWorknode.objects.exclude(partner_id__in=incoming_partner_ids).delete()
    progress(f"  partner_worknode: upserted={upserted} deleted={deleted_count}")
    logger.info(
        "Hasura sync: partner_worknode done — fetched=%d upserted=%d deleted=%d",
        total, upserted, deleted_count,
    )


# ---------------------------------------------------------------------------
# Public sync entry points
# ---------------------------------------------------------------------------

def _execute_sync(sync_type: str, phases, progress: Callable[[str], None] | None) -> SyncRun:
    def _p(msg: str) -> None:
        if progress:
            progress(msg)

    sync_run = SyncRun.objects.create(status=SyncRun.STATUS_RUNNING, sync_type=sync_type)
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
        logger.error("Hasura sync (%s) failed: %s", sync_type, exc)
        raise

    return sync_run


def run_user_sync(progress: Callable[[str], None] | None = None) -> SyncRun:
    """Sync only users from Hasura. Creates one SyncRun(sync_type='users')."""
    return _execute_sync(SyncRun.SYNC_TYPE_USERS, [_run_users_phase], progress)


def run_partner_sync(progress: Callable[[str], None] | None = None) -> SyncRun:
    """Sync only partners from Hasura. Creates one SyncRun(sync_type='partners')."""
    return _execute_sync(SyncRun.SYNC_TYPE_PARTNERS, [_run_partners_phase], progress)


def run_partner_worknode_sync(progress: Callable[[str], None] | None = None) -> SyncRun:
    """Sync only partner_worknode mappings from Hasura. Creates one SyncRun(sync_type='partner_worknode')."""
    return _execute_sync(SyncRun.SYNC_TYPE_PARTNER_WORKNODE, [_run_partner_worknode_phase], progress)


def run_sync(progress: Callable[[str], None] | None = None) -> SyncRun:
    """Sync users, partners, and partner_worknode. Creates one SyncRun(sync_type='all')."""
    return _execute_sync(
        SyncRun.SYNC_TYPE_ALL,
        [_run_users_phase, _run_partners_phase, _run_partner_worknode_phase],
        progress,
    )
