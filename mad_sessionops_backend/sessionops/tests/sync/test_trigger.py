"""
F-M4-7: Manual sync trigger — service unit tests.

All Hasura calls are mocked. The background thread is replaced with a mock
(or allowed to run synchronously) so tests don't depend on thread scheduling.
"""

from unittest.mock import MagicMock, patch

import pytest

from sessionops.exceptions import ConflictError, PermissionDenied
from sessionops.models import SyncRun, User
from sessionops.services.sync.trigger import (
    _execute_partner_sync,
    _execute_partner_worknode_sync,
    _execute_user_sync,
    trigger_manual_sync,
)

# ── Fixtures ──────────────────────────────────────────────────────────────────

_UID = iter(range(4_000_000, 4_100_000))

HASURA_USER_ROW = {
    "user_id": 12001,
    "user_login": "sync@makeadiff.in",
    "user_display_name": "Sync User",
    "email": "sync@makeadiff.in",
    "user_role": "CO Full Time",
}

HASURA_PARTNER_ROW = {
    "partner_id": 9001,
    "partner_name": "Test School",
    "co_id": 12001,
    "co_name": "Sync User",
    "crm_partner_removed": False,
}

HASURA_CHAPTER_ROW = {
    "chapter_id": "9001",
    "worknode_id": 55,
    "city_name": "Pune",
}


def _admin() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_id=uid,
        user_login=f"admin{uid}@t.com",
        user_display_name=f"Admin{uid}",
        email=f"admin{uid}@t.com",
        user_role="Project Lead",
        is_active=True,
    )


def _running_run() -> SyncRun:
    return SyncRun.objects.create(
        status=SyncRun.STATUS_RUNNING,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_ALL,
    )


def _new_run(entity_type: str, entity_sync_type: str) -> SyncRun:
    return SyncRun.objects.create(
        status=SyncRun.STATUS_RUNNING,
        run_type=SyncRun.RUN_TYPE_MANUAL,
        entity_type=entity_type,
        entity_sync_type=entity_sync_type,
    )


# ── trigger_manual_sync tests ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_trigger_returns_409_when_any_sync_running():
    _running_run()
    admin = _admin()
    with pytest.raises(ConflictError):
        trigger_manual_sync(triggered_by=admin)


@pytest.mark.django_db
def test_trigger_creates_3_running_sync_runs_before_thread_starts():
    admin = _admin()
    with patch("sessionops.services.sync.trigger.threading.Thread") as mock_thread_cls:
        mock_thread_cls.return_value = MagicMock()
        trigger_manual_sync(triggered_by=admin)

    # Thread was started, but we want to check the DB state BEFORE it runs
    runs = list(
        SyncRun.objects.filter(run_type=SyncRun.RUN_TYPE_MANUAL, status=SyncRun.STATUS_RUNNING)
    )
    assert len(runs) == 3
    entity_types = {r.entity_type for r in runs}
    assert entity_types == {
        SyncRun.ENTITY_TYPE_USER,
        SyncRun.ENTITY_TYPE_PARTNER,
        SyncRun.ENTITY_TYPE_PARTNER_WORKNODE,
    }


@pytest.mark.django_db
def test_trigger_returns_correct_run_ids():
    admin = _admin()
    with patch("sessionops.services.sync.trigger.threading.Thread") as mock_thread_cls:
        mock_thread_cls.return_value = MagicMock()
        result = trigger_manual_sync(triggered_by=admin)

    assert "user_run_id" in result
    assert "partner_run_id" in result
    assert "partner_worknode_run_id" in result
    assert isinstance(result["user_run_id"], int)
    assert isinstance(result["partner_run_id"], int)
    assert isinstance(result["partner_worknode_run_id"], int)


@pytest.mark.django_db
def test_trigger_sets_triggered_by():
    admin = _admin()
    with patch("sessionops.services.sync.trigger.threading.Thread") as mock_thread_cls:
        mock_thread_cls.return_value = MagicMock()
        result = trigger_manual_sync(triggered_by=admin)

    user_run = SyncRun.objects.get(id=result["user_run_id"])
    assert user_run.triggered_by_id == admin.user_id


# ── _execute_user_sync tests ───────────────────────────────────────────────────


@pytest.mark.django_db
def test_execute_user_sync_marks_run_success():
    run = _new_run(SyncRun.ENTITY_TYPE_USER, SyncRun.ENTITY_SYNC_TYPE_USERS)
    with patch(
        "sessionops.services.sync.trigger.fetch_users_updated_after",
        return_value=[dict(HASURA_USER_ROW)],
    ):
        _execute_user_sync(run)

    run.refresh_from_db()
    assert run.status == SyncRun.STATUS_SUCCESS
    assert run.users_fetched == 1
    assert run.completed_at is not None


@pytest.mark.django_db
def test_execute_user_sync_marks_run_failed_on_hasura_error():
    from sessionops.services.hasura.client import HasuraError

    run = _new_run(SyncRun.ENTITY_TYPE_USER, SyncRun.ENTITY_SYNC_TYPE_USERS)
    with patch(
        "sessionops.services.sync.trigger.fetch_users_updated_after",
        side_effect=HasuraError("timeout"),
    ):
        _execute_user_sync(run)  # must NOT raise — failure is contained

    run.refresh_from_db()
    assert run.status == SyncRun.STATUS_FAILED
    assert "timeout" in run.error_message


@pytest.mark.django_db
def test_execute_syncs_are_independent():
    """User sync failure must not stop partner sync from completing."""
    from sessionops.services.hasura.client import HasuraError

    user_run = _new_run(SyncRun.ENTITY_TYPE_USER, SyncRun.ENTITY_SYNC_TYPE_USERS)
    partner_run = _new_run(SyncRun.ENTITY_TYPE_PARTNER, SyncRun.ENTITY_SYNC_TYPE_PARTNERS)

    with patch(
        "sessionops.services.sync.trigger.fetch_users_updated_after",
        side_effect=HasuraError("user down"),
    ):
        _execute_user_sync(user_run)

    with patch(
        "sessionops.services.sync.trigger.fetch_partners_updated_after",
        return_value=[dict(HASURA_PARTNER_ROW)],
    ):
        _execute_partner_sync(partner_run)

    user_run.refresh_from_db()
    partner_run.refresh_from_db()
    assert user_run.status == SyncRun.STATUS_FAILED
    assert partner_run.status == SyncRun.STATUS_SUCCESS


@pytest.mark.django_db
def test_execute_partner_worknode_sync_marks_success():
    run = _new_run(SyncRun.ENTITY_TYPE_PARTNER_WORKNODE, SyncRun.ENTITY_SYNC_TYPE_PARTNER_WORKNODE)
    with patch(
        "sessionops.services.sync.trigger.fetch_chapter_mapping",
        return_value=[dict(HASURA_CHAPTER_ROW)],
    ):
        _execute_partner_worknode_sync(run)

    run.refresh_from_db()
    assert run.status == SyncRun.STATUS_SUCCESS
