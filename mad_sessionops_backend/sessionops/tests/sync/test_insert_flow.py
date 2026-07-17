"""
F-M8a-3: handle_insert flow unit tests.
"""

import pytest
from django.utils import timezone

from sessionops.models import User
from sessionops.services.realtime_sync.diff import UserDiff
from sessionops.services.realtime_sync.flows import FlowResult
from sessionops.services.realtime_sync.flows.insert import handle_insert
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload

_UID = iter(range(7_300_000, 7_400_000))


def _user(**kwargs) -> User:
    uid = next(_UID)
    defaults = dict(
        user_id=uid,
        user_login=f"u{uid}@insert.test",
        user_display_name=f"Insert User {uid}",
        email=f"u{uid}@insert.test",
        contact=None,
        user_role="Youth",
        worknode_id=None,
        is_active=True,
    )
    defaults.update(kwargs)
    return User.objects.create(**defaults)


def _payload(**kwargs) -> RealtimeSyncUserPayload:
    uid = next(_UID)
    defaults = dict(
        user_login=f"new{uid}@insert.test",
        user_display_name="New User",
        user_email=f"new{uid}@insert.test",
        user_phone="9876543210",
        user_role="Youth",
        worknode_id=None,
        user_active_status=True,
        event_type="insert",
    )
    defaults.update(kwargs)
    return RealtimeSyncUserPayload(**defaults)


def _new_diff() -> UserDiff:
    return UserDiff(user_exists_locally=False, incoming_role="Youth")


# ── True INSERT (no local user) ────────────────────────────────────────────────


@pytest.mark.django_db
def test_handle_insert_creates_new_user():
    uid = next(_UID)
    payload = _payload(
        user_login=f"brand{uid}@insert.test", user_email=f"brand{uid}@insert.test"
    )
    handle_insert(None, payload, _new_diff(), user_id=uid)

    user = User.objects.get(user_id=uid)
    assert user.user_login == payload.user_login
    assert user.is_active is True


@pytest.mark.django_db
def test_handle_insert_sets_synced_at():
    uid = next(_UID)
    before = timezone.now()
    handle_insert(None, _payload(), _new_diff(), user_id=uid)

    user = User.objects.get(user_id=uid)
    assert user.synced_at is not None
    assert user.synced_at >= before


@pytest.mark.django_db
def test_handle_insert_sets_worknode_id():
    uid = next(_UID)
    handle_insert(None, _payload(worknode_id=42), _new_diff(), user_id=uid)
    assert User.objects.get(user_id=uid).worknode_id == 42


@pytest.mark.django_db
def test_handle_insert_null_worknode_id_stays_null():
    uid = next(_UID)
    handle_insert(None, _payload(worknode_id=None), _new_diff(), user_id=uid)
    assert User.objects.get(user_id=uid).worknode_id is None


@pytest.mark.django_db
def test_handle_insert_sets_location_fields():
    uid = next(_UID)
    payload = _payload(city="Mumbai", center="Dharavi", state="Maharashtra")
    handle_insert(None, payload, _new_diff(), user_id=uid)

    user = User.objects.get(user_id=uid)
    assert user.city == "Mumbai"
    assert user.center == "Dharavi"
    assert user.state == "Maharashtra"


@pytest.mark.django_db
def test_handle_insert_sets_reporting_manager_fields():
    uid = next(_UID)
    payload = _payload(
        reporting_manager_user_login="mgr@test.com",
        reporting_manager_role_code="FL",
        reporting_manager_user_id=9900,
    )
    handle_insert(None, payload, _new_diff(), user_id=uid)

    user = User.objects.get(user_id=uid)
    assert user.reporting_manager_user_login == "mgr@test.com"
    assert user.reporting_manager_role_code == "FL"
    assert user.reporting_manager_user_id == 9900


@pytest.mark.django_db
def test_handle_insert_maps_email_and_contact():
    uid = next(_UID)
    payload = _payload(user_email="e@test.com", user_phone="1234567890")
    handle_insert(None, payload, _new_diff(), user_id=uid)

    user = User.objects.get(user_id=uid)
    assert user.email == "e@test.com"
    assert user.contact == "1234567890"


@pytest.mark.django_db
def test_handle_insert_returns_correct_flow_result():
    uid = next(_UID)
    result = handle_insert(None, _payload(), _new_diff(), user_id=uid)
    assert isinstance(result, FlowResult)
    assert result.status == "success"
    assert result.action_taken == "user_created"


# ── Re-activation (local user exists but is_active=False) ─────────────────────


@pytest.mark.django_db
def test_handle_insert_reactivates_soft_deleted_user():
    uid = next(_UID)
    existing = _user(user_id=uid, is_active=False, user_display_name="Old Name")
    payload = _payload(
        user_login=existing.user_login,
        user_email=existing.email,
        user_display_name="Reactivated",
        user_role="Wingman",
    )
    diff = UserDiff(
        user_exists_locally=True, is_reactivation=True, incoming_role="Wingman"
    )

    handle_insert(existing, payload, diff, user_id=uid)

    existing.refresh_from_db()
    assert existing.is_active is True
    assert existing.user_display_name == "Reactivated"
    assert existing.user_role == "Wingman"


@pytest.mark.django_db
def test_handle_insert_reactivation_sets_synced_at():
    uid = next(_UID)
    existing = _user(user_id=uid, is_active=False, synced_at=None)
    payload = _payload(user_login=existing.user_login, user_email=existing.email)
    diff = UserDiff(
        user_exists_locally=True, is_reactivation=True, incoming_role="Youth"
    )
    before = timezone.now()

    handle_insert(existing, payload, diff, user_id=uid)

    existing.refresh_from_db()
    assert existing.synced_at is not None
    assert existing.synced_at >= before


@pytest.mark.django_db
def test_handle_insert_reactivation_sets_worknode_id():
    uid = next(_UID)
    existing = _user(user_id=uid, is_active=False, worknode_id=None)
    payload = _payload(
        user_login=existing.user_login, user_email=existing.email, worknode_id=77
    )
    diff = UserDiff(
        user_exists_locally=True, is_reactivation=True, incoming_role="Youth"
    )

    handle_insert(existing, payload, diff, user_id=uid)

    existing.refresh_from_db()
    assert existing.worknode_id == 77
