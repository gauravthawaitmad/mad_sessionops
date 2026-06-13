"""
F-M4-5: Sync user by login — service unit tests.
"""

from unittest.mock import MagicMock, patch

import pytest

from sessionops.exceptions import ConflictError, NotFound, PermissionDenied
from sessionops.models import SyncRun, User
from sessionops.services.sync.single_user import sync_user_by_login

# ── Fixtures ──────────────────────────────────────────────────────────────────

_UID = iter(range(7_000_000, 7_100_000))

HASURA_USER_ROW = {
    "user_id": 99001,
    "user_login": "priya@makeadiff.in",
    "user_display_name": "Priya Menon",
    "email": "priya@makeadiff.in",
    "user_role": "CO Full Time",
}


def _admin() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_id=uid,
        user_login=f"admin{uid}@makeadiff.in",
        user_display_name=f"Admin{uid}",
        email=f"admin{uid}@makeadiff.in",
        user_role="Project Lead",
        is_active=True,
    )


def _co() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_id=uid,
        user_login=f"co{uid}@makeadiff.in",
        user_display_name=f"CO{uid}",
        email=f"co{uid}@makeadiff.in",
        user_role="CO Full Time",
        is_active=True,
    )


# ── Tests ─────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_sync_user_by_login_returns_403_for_non_admin():
    co = _co()
    with pytest.raises(PermissionDenied):
        sync_user_by_login("priya@makeadiff.in", co)


@pytest.mark.django_db
def test_sync_user_by_login_blocked_when_sync_running():
    admin = _admin()
    SyncRun.objects.create(
        status=SyncRun.STATUS_RUNNING,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_ALL,
    )
    with pytest.raises(ConflictError):
        sync_user_by_login("priya@makeadiff.in", admin)


@pytest.mark.django_db
def test_sync_user_by_login_not_found_returns_404():
    admin = _admin()
    with patch(
        "sessionops.services.sync.single_user.fetch_user_by_login",
        return_value=None,
    ):
        with pytest.raises(NotFound):
            sync_user_by_login("unknown@makeadiff.in", admin)

    run = SyncRun.objects.filter(target_identifier="unknown@makeadiff.in").first()
    assert run is not None
    assert run.status == SyncRun.STATUS_FAILED
    assert "No user found" in run.error_message


@pytest.mark.django_db
def test_sync_user_by_login_succeeds():
    admin = _admin()
    with patch(
        "sessionops.services.sync.single_user.fetch_user_by_login",
        return_value=dict(HASURA_USER_ROW),
    ):
        result = sync_user_by_login("priya@makeadiff.in", admin)

    assert result["sync_run_id"] is not None
    assert result["synced_user"].user_login == "priya@makeadiff.in"

    run = SyncRun.objects.get(id=result["sync_run_id"])
    assert run.status == SyncRun.STATUS_SUCCESS
    assert run.run_type == SyncRun.RUN_TYPE_MANUAL_SINGLE_USER
    assert run.entity_type == SyncRun.ENTITY_TYPE_USER
    assert run.target_identifier == "priya@makeadiff.in"
    assert run.triggered_by == admin
    assert run.users_fetched == 1


@pytest.mark.django_db
def test_sync_user_by_login_creates_sync_run_with_target_identifier():
    admin = _admin()
    with patch(
        "sessionops.services.sync.single_user.fetch_user_by_login",
        return_value=dict(HASURA_USER_ROW),
    ):
        result = sync_user_by_login("priya@makeadiff.in", admin)

    run = SyncRun.objects.get(id=result["sync_run_id"])
    assert run.target_identifier == "priya@makeadiff.in"
    assert run.triggered_by_id == admin.user_id


@pytest.mark.django_db
def test_sync_user_by_login_upserts_existing_user():
    admin = _admin()
    User.objects.create(
        user_id=99001,
        user_login="priya@makeadiff.in",
        user_display_name="Old Name",
        email="priya@makeadiff.in",
        user_role="CO Full Time",
    )
    updated_row = dict(HASURA_USER_ROW)
    updated_row["user_display_name"] = "Priya Updated"

    with patch(
        "sessionops.services.sync.single_user.fetch_user_by_login",
        return_value=updated_row,
    ):
        result = sync_user_by_login("priya@makeadiff.in", admin)

    user = result["synced_user"]
    assert user.user_display_name == "Priya Updated"


@pytest.mark.django_db
def test_sync_user_by_login_marks_run_failed_on_hasura_error():
    from sessionops.services.hasura.client import HasuraError

    admin = _admin()
    with patch(
        "sessionops.services.sync.single_user.fetch_user_by_login",
        side_effect=HasuraError("timeout"),
    ):
        with pytest.raises(HasuraError):
            sync_user_by_login("priya@makeadiff.in", admin)

    run = SyncRun.objects.filter(target_identifier="priya@makeadiff.in").first()
    assert run is not None
    assert run.status == SyncRun.STATUS_FAILED
    assert "timeout" in run.error_message
