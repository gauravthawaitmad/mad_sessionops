"""
F-M4-6: Incremental sync service unit tests.

All Hasura calls are mocked — no network I/O.
"""

from contextlib import contextmanager
from datetime import datetime, timezone
from unittest.mock import DEFAULT, patch

from django.utils import timezone as dj_timezone

import pytest

from sessionops.exceptions import ConflictError
from sessionops.models import Partner, PartnerWorknode, SyncRun, User
from sessionops.services.sync.incremental import (
    _get_partner_cursor,
    _get_user_cursor,
    run_incremental_sync,
)

# ── Fixtures ──────────────────────────────────────────────────────────────────

_UID = iter(range(5_000_000, 5_100_000))

USER_ROW = {
    "user_id": 1001,
    "user_login": "alice@makeadiff.in",
    "user_display_name": "Alice",
    "email": "alice@makeadiff.in",
    "user_role": "CO Full Time",
}

PARTNER_ROW = {
    "partner_id": 501,
    "partner_name": "Test School",
    "co_id": 1001,
    "co_name": "Alice",
    "crm_partner_removed": False,
}

CHAPTER_ROW = {
    "chapter_id": "501",
    "worknode_id": 42,
    "city_name": "Mumbai",
}


@contextmanager
def _mock_all(users=None, partners=None, chapters=None):
    """Patch all 3 Hasura fetch functions.

    Uses DEFAULT so patch.multiple's context-manager return value is populated —
    passing pre-built Mock instances instead makes patch.multiple return {} (only
    DEFAULT-valued attributes are included), which is why callers indexing
    mocks["fetch_users_updated_after"] used to KeyError.
    """
    with patch.multiple(
        "sessionops.services.sync.incremental",
        fetch_users_updated_after=DEFAULT,
        fetch_partners_updated_after=DEFAULT,
        fetch_chapter_mapping=DEFAULT,
    ) as mocks:
        mocks["fetch_users_updated_after"].return_value = users or []
        mocks["fetch_partners_updated_after"].return_value = partners or []
        mocks["fetch_chapter_mapping"].return_value = chapters or []
        yield mocks


# ── Cursor tests ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_cursor_is_null_when_no_users():
    assert _get_user_cursor() is None


@pytest.mark.django_db
def test_cursor_is_null_when_no_partners():
    assert _get_partner_cursor() is None


@pytest.mark.django_db
def test_cursor_advances_after_user_upsert():
    """_get_user_cursor() derives from SyncRun.cursor_end, not User.synced_at directly —
    a successful sync_run must exist for the cursor to advance."""
    ts = dj_timezone.now()
    SyncRun.objects.create(
        status=SyncRun.STATUS_SUCCESS,
        entity_type=SyncRun.ENTITY_TYPE_USER,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_USERS,
        cursor_end=ts,
    )
    cursor = _get_user_cursor()
    assert cursor is not None


# ── Full sync cycle tests ─────────────────────────────────────────────────────


@pytest.mark.django_db
def test_sync_creates_3_sync_run_rows_per_cycle():
    with _mock_all():
        results = run_incremental_sync(run_type="auto")

    assert len(results) == 3
    assert SyncRun.objects.count() == 3
    entity_types = set(SyncRun.objects.values_list("entity_type", flat=True))
    assert entity_types == {"user", "partner", "partner_worknode"}


@pytest.mark.django_db
def test_first_sync_with_null_cursor_does_full_fetch():
    """On first run, cursor is None — no updated_after param passed to Hasura."""
    with _mock_all(users=[dict(USER_ROW)]) as mocks:
        run_incremental_sync(run_type="auto")

    call_kwargs = mocks["fetch_users_updated_after"].call_args
    assert call_kwargs.args[0] is None  # cursor passed as None


@pytest.mark.django_db
def test_subsequent_runs_use_cursor_from_max_synced_at():
    """Second run passes the cursor from the prior successful sync_run's cursor_end."""
    ts = datetime(2026, 6, 1, tzinfo=timezone.utc)
    SyncRun.objects.create(
        status=SyncRun.STATUS_SUCCESS,
        entity_type=SyncRun.ENTITY_TYPE_USER,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_USERS,
        cursor_end=ts,
    )

    with _mock_all() as mocks:
        run_incremental_sync(run_type="auto")

    call_kwargs = mocks["fetch_users_updated_after"].call_args
    assert call_kwargs.args[0] == ts


@pytest.mark.django_db
def test_partner_worknode_always_full_sync_null_cursor():
    """partner_worknode run always has updated_after=None (no cursor)."""
    with _mock_all(chapters=[CHAPTER_ROW]):
        results = run_incremental_sync(run_type="auto")

    pw_run = results[SyncRun.ENTITY_TYPE_PARTNER_WORKNODE]
    assert pw_run is not None
    assert pw_run.updated_after is None


@pytest.mark.django_db
def test_failure_in_user_does_not_affect_partner_entity():
    """If user sync raises, partner and partner_worknode still run."""
    with patch(
        "sessionops.services.sync.incremental.fetch_users_updated_after",
        side_effect=Exception("Hasura down"),
    ), patch(
        "sessionops.services.sync.incremental.fetch_partners_updated_after",
        return_value=[],
    ), patch(
        "sessionops.services.sync.incremental.fetch_chapter_mapping",
        return_value=[],
    ):
        results = run_incremental_sync(run_type="auto")

    assert results[SyncRun.ENTITY_TYPE_USER] is None
    assert results[SyncRun.ENTITY_TYPE_PARTNER] is not None
    assert results[SyncRun.ENTITY_TYPE_PARTNER_WORKNODE] is not None

    # Failed user run must be persisted
    user_run = SyncRun.objects.filter(entity_type="user").first()
    assert user_run is not None
    assert user_run.status == SyncRun.STATUS_FAILED


@pytest.mark.django_db
def test_concurrent_sync_blocked_for_manual_type():
    SyncRun.objects.create(
        status=SyncRun.STATUS_RUNNING,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_ALL,
    )
    with pytest.raises(ConflictError):
        run_incremental_sync(run_type=SyncRun.RUN_TYPE_MANUAL)


@pytest.mark.django_db
def test_auto_sync_not_blocked_by_running_status():
    """Auto cron runs are NOT blocked even if another run is in progress."""
    SyncRun.objects.create(
        status=SyncRun.STATUS_RUNNING,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_ALL,
    )
    with _mock_all():
        results = run_incremental_sync(run_type=SyncRun.RUN_TYPE_AUTO)
    # Should not raise; all 3 entities should have runs
    assert len(results) == 3


@pytest.mark.django_db
def test_sync_handles_empty_hasura_response():
    """Zero records from Hasura → success run with records_fetched=0."""
    with _mock_all():
        results = run_incremental_sync(run_type="auto")

    user_run = results[SyncRun.ENTITY_TYPE_USER]
    assert user_run is not None
    assert user_run.status == SyncRun.STATUS_SUCCESS
    assert user_run.users_fetched == 0


@pytest.mark.django_db
def test_sync_handles_hasura_error_marks_run_failed():
    """HasuraError on user fetch → user run is marked failed."""
    from sessionops.services.hasura.client import HasuraError

    with patch(
        "sessionops.services.sync.incremental.fetch_users_updated_after",
        side_effect=HasuraError("500 from Hasura"),
    ), patch(
        "sessionops.services.sync.incremental.fetch_partners_updated_after",
        return_value=[],
    ), patch(
        "sessionops.services.sync.incremental.fetch_chapter_mapping",
        return_value=[],
    ):
        run_incremental_sync(run_type="auto")

    user_run = SyncRun.objects.filter(entity_type="user").first()
    assert user_run.status == SyncRun.STATUS_FAILED
    assert "500 from Hasura" in user_run.error_message


@pytest.mark.django_db
def test_incremental_sync_is_idempotent_when_cursor_unchanged():
    """Running twice with same Hasura data creates 2 sets of SyncRun rows, both success."""
    with _mock_all(users=[dict(USER_ROW)]):
        run_incremental_sync(run_type="auto")
    with _mock_all(users=[dict(USER_ROW)]):
        run_incremental_sync(run_type="auto")

    user_runs = SyncRun.objects.filter(entity_type="user")
    assert user_runs.count() == 2
    assert all(r.status == SyncRun.STATUS_SUCCESS for r in user_runs)
    # User row count stays at 1 (idempotent upsert)
    assert User.objects.filter(user_id=1001).count() == 1
