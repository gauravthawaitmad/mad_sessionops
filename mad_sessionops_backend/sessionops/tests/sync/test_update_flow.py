"""
F-M8a-3: handle_update flow unit tests.
"""

from django.utils import timezone

import pytest

from sessionops.models import User
from sessionops.services.realtime_sync.diff import UserDiff
from sessionops.services.realtime_sync.flows import FlowResult
from sessionops.services.realtime_sync.flows.update import handle_update
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload

_UID = iter(range(7_400_000, 7_500_000))


def _user(**kwargs) -> User:
    uid = next(_UID)
    defaults = dict(
        user_id=uid,
        user_login=f"u{uid}@update.test",
        user_display_name=f"Update User {uid}",
        email=f"u{uid}@update.test",
        contact=None,
        user_role="CO Full Time",
        worknode_id=None,
        is_active=True,
    )
    defaults.update(kwargs)
    return User.objects.create(**defaults)


def _payload(**kwargs) -> RealtimeSyncUserPayload:
    defaults = dict(
        user_login="update@test.com",
        user_display_name="Updated User",
        user_email="update@test.com",
        user_phone=None,
        user_role="CO Full Time",
        worknode_id=None,
        user_active_status=True,
        event_type="update",
    )
    defaults.update(kwargs)
    return RealtimeSyncUserPayload(**defaults)


def _diff(worknode_action: str = "none", **kwargs) -> UserDiff:
    return UserDiff(user_exists_locally=True, worknode_action=worknode_action, **kwargs)


# ── Common field writes ────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_handle_update_writes_display_name():
    uid = next(_UID)
    user = _user(user_id=uid, user_display_name="Old Name")
    payload = _payload(
        user_login=user.user_login, user_email=user.email, user_display_name="New Name"
    )

    handle_update(user, payload, _diff(), user_id=uid)

    user.refresh_from_db()
    assert user.user_display_name == "New Name"


@pytest.mark.django_db
def test_handle_update_maps_email_and_contact_correctly():
    uid = next(_UID)
    user = _user(user_id=uid, email="old@test.com", contact="0000000000")
    payload = _payload(
        user_login=user.user_login, user_email="new@test.com", user_phone="9999999999"
    )

    handle_update(user, payload, _diff(), user_id=uid)

    user.refresh_from_db()
    assert user.email == "new@test.com"
    assert user.contact == "9999999999"


@pytest.mark.django_db
def test_handle_update_sets_location_fields():
    uid = next(_UID)
    user = _user(user_id=uid)
    payload = _payload(
        user_login=user.user_login,
        user_email=user.email,
        city="Pune",
        center="Wanowrie",
        state="Maharashtra",
    )

    handle_update(user, payload, _diff(), user_id=uid)

    user.refresh_from_db()
    assert user.city == "Pune"
    assert user.center == "Wanowrie"
    assert user.state == "Maharashtra"


@pytest.mark.django_db
def test_handle_update_sets_synced_at():
    uid = next(_UID)
    user = _user(user_id=uid, synced_at=None)
    before = timezone.now()
    payload = _payload(user_login=user.user_login, user_email=user.email)

    handle_update(user, payload, _diff(), user_id=uid)

    user.refresh_from_db()
    assert user.synced_at is not None
    assert user.synced_at >= before


# ── worknode_id protection ─────────────────────────────────────────────────────


@pytest.mark.django_db
def test_handle_update_does_not_modify_worknode_id():
    uid = next(_UID)
    user = _user(user_id=uid, worknode_id=5)
    payload = _payload(user_login=user.user_login, user_email=user.email, worknode_id=5)

    handle_update(user, payload, _diff(worknode_action="none"), user_id=uid)

    user.refresh_from_db()
    assert user.worknode_id == 5


@pytest.mark.django_db
def test_handle_update_worknode_add_partial_success_when_no_mapping():
    # No PartnerWorknode entry exists → resolver returns None → partial_success
    uid = next(_UID)
    user = _user(user_id=uid, worknode_id=None)
    payload = _payload(user_login=user.user_login, user_email=user.email, worknode_id=10)

    result = handle_update(user, payload, _diff(worknode_action="added"), user_id=uid)

    assert result.status == "partial_success"
    assert result.action_taken == "no_school_found_for_worknode"
    user.refresh_from_db()
    assert user.worknode_id is None  # not updated on partial_success


@pytest.mark.django_db
def test_handle_update_worknode_remove_succeeds_when_no_old_school():
    # No PartnerWorknode for old worknode → old_school_id is None → cascade skipped → success
    uid = next(_UID)
    user = _user(user_id=uid, worknode_id=10)
    payload = _payload(user_login=user.user_login, user_email=user.email, worknode_id=None)

    result = handle_update(user, payload, _diff(worknode_action="removed"), user_id=uid)

    assert result.status == "success"
    assert result.action_taken == "worknode_removed"
    user.refresh_from_db()
    assert user.worknode_id is None


@pytest.mark.django_db
def test_handle_update_worknode_update_partial_success_when_new_mapping_missing():
    # No PartnerWorknode for new worknode_id=20 → partial_success, worknode_id stays at 10
    uid = next(_UID)
    user = _user(user_id=uid, worknode_id=10)
    payload = _payload(user_login=user.user_login, user_email=user.email, worknode_id=20)

    result = handle_update(user, payload, _diff(worknode_action="updated"), user_id=uid)

    assert result.status == "partial_success"
    assert result.action_taken == "no_school_found_for_worknode"
    user.refresh_from_db()
    assert user.worknode_id == 10  # not updated on partial_success


# ── FlowResult ─────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_handle_update_returns_correct_flow_result():
    uid = next(_UID)
    user = _user(user_id=uid)
    payload = _payload(user_login=user.user_login, user_email=user.email)

    result = handle_update(user, payload, _diff(), user_id=uid)

    assert isinstance(result, FlowResult)
    assert result.status == "success"
    assert result.action_taken == "common_fields_updated"
