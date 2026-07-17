"""
F-M8a-2: diff engine tests.

Tests exercise compute_diff() in isolation — no DB writes except for
User row creation needed by the function signature.
"""

import pytest
from django.utils import timezone

from sessionops.models import User
from sessionops.services.realtime_sync.diff import TRACKED_FIELDS, compute_diff
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload

_UID = iter(range(7_600_000, 7_700_000))


def _user(**kwargs) -> User:
    uid = next(_UID)
    defaults = dict(
        user_id=uid,
        user_login=f"u{uid}@diff.test",
        user_display_name=f"Diff User {uid}",
        email=f"u{uid}@diff.test",
        contact=None,
        user_role="CO Full Time",
        worknode_id=None,
        is_active=True,
        synced_at=None,
    )
    defaults.update(kwargs)
    return User.objects.create(**defaults)


def _payload(**kwargs) -> RealtimeSyncUserPayload:
    defaults = dict(
        user_login="payload@diff.test",
        user_display_name="Payload User",
        user_email="payload@diff.test",
        user_phone=None,
        user_role="CO Full Time",
        worknode_id=None,
        user_active_status=True,
        event_type="update",
    )
    defaults.update(kwargs)
    return RealtimeSyncUserPayload(**defaults)


# ── user_exists_locally=False ──────────────────────────────────────────────────


@pytest.mark.django_db
def test_diff_user_does_not_exist():
    payload = _payload(user_role="Youth")
    diff = compute_diff(None, payload)

    assert diff.user_exists_locally is False
    assert diff.is_stale is False
    assert diff.incoming_role == "Youth"
    assert diff.common_fields_changed == []
    assert diff.pre_snapshot == {}


# ── no-change ─────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_diff_no_changes():
    uid = next(_UID)
    user = _user(
        user_id=uid,
        user_login=f"u{uid}@diff.test",
        user_display_name="Same User",
        email=f"u{uid}@diff.test",
        user_role="CHO",
        worknode_id=5,
        is_active=True,
    )
    payload = _payload(
        user_login=user.user_login,
        user_display_name="Same User",
        user_email=user.email,
        user_phone=None,
        user_role="CHO",
        worknode_id=5,
        user_active_status=True,
    )
    diff = compute_diff(user, payload)

    assert diff.user_exists_locally is True
    assert diff.common_fields_changed == []
    assert diff.worknode_action == "none"
    assert diff.is_stale is False


# ── field changes ─────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_diff_common_field_changed_display_name():
    uid = next(_UID)
    user = _user(user_id=uid, user_display_name="Old Name")
    payload = _payload(
        user_login=user.user_login,
        user_email=user.email,
        user_display_name="New Name",
    )

    diff = compute_diff(user, payload)

    changed_fields = {c["field"] for c in diff.common_fields_changed}
    assert "user_display_name" in changed_fields
    name_change = next(
        c for c in diff.common_fields_changed if c["field"] == "user_display_name"
    )
    assert name_change["old"] == "Old Name"
    assert name_change["new"] == "New Name"


@pytest.mark.django_db
def test_diff_email_field_mapped_correctly():
    """User.email ↔ payload.user_email mapping must be applied."""
    uid = next(_UID)
    user = _user(user_id=uid, email=f"old{uid}@test.com")
    payload = _payload(user_login=user.user_login, user_email=f"new{uid}@test.com")

    diff = compute_diff(user, payload)

    changed_fields = {c["field"] for c in diff.common_fields_changed}
    assert "email" in changed_fields


@pytest.mark.django_db
def test_diff_contact_field_mapped_correctly():
    """User.contact ↔ payload.user_phone mapping must be applied."""
    uid = next(_UID)
    user = _user(user_id=uid, contact="9876543210")
    payload = _payload(
        user_login=user.user_login,
        user_email=user.email,
        user_phone="0000000000",
    )

    diff = compute_diff(user, payload)

    changed_fields = {c["field"] for c in diff.common_fields_changed}
    assert "contact" in changed_fields


# ── worknode actions ──────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_diff_worknode_added():
    uid = next(_UID)
    user = _user(user_id=uid, worknode_id=None)
    payload = _payload(
        user_login=user.user_login, user_email=user.email, worknode_id=42
    )

    diff = compute_diff(user, payload)
    assert diff.worknode_action == "added"


@pytest.mark.django_db
def test_diff_worknode_removed():
    uid = next(_UID)
    user = _user(user_id=uid, worknode_id=42)
    payload = _payload(
        user_login=user.user_login, user_email=user.email, worknode_id=None
    )

    diff = compute_diff(user, payload)
    assert diff.worknode_action == "removed"


@pytest.mark.django_db
def test_diff_worknode_updated():
    uid = next(_UID)
    user = _user(user_id=uid, worknode_id=10)
    payload = _payload(
        user_login=user.user_login, user_email=user.email, worknode_id=20
    )

    diff = compute_diff(user, payload)
    assert diff.worknode_action == "updated"


@pytest.mark.django_db
def test_diff_worknode_unchanged():
    uid = next(_UID)
    user = _user(user_id=uid, worknode_id=10)
    payload = _payload(
        user_login=user.user_login, user_email=user.email, worknode_id=10
    )

    diff = compute_diff(user, payload)
    assert diff.worknode_action == "none"


# ── stale check ───────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_diff_is_stale_when_incoming_timestamp_older():
    uid = next(_UID)
    t2 = timezone.now()
    t1_str = "2020-01-01T00:00:00+00:00"  # definitely older
    user = _user(user_id=uid, synced_at=t2)
    payload = _payload(
        user_login=user.user_login,
        user_email=user.email,
        x_modified_timestamp=t1_str,
    )

    diff = compute_diff(user, payload)
    assert diff.is_stale is True


@pytest.mark.django_db
def test_diff_not_stale_when_incoming_timestamp_newer():
    uid = next(_UID)
    t1 = timezone.now()
    user = _user(user_id=uid, synced_at=t1)
    t2_str = "2099-01-01T00:00:00+00:00"  # definitely newer
    payload = _payload(
        user_login=user.user_login,
        user_email=user.email,
        x_modified_timestamp=t2_str,
    )

    diff = compute_diff(user, payload)
    assert diff.is_stale is False


@pytest.mark.django_db
def test_diff_not_stale_when_no_local_synced_at():
    uid = next(_UID)
    user = _user(user_id=uid, synced_at=None)
    payload = _payload(
        user_login=user.user_login,
        user_email=user.email,
        x_modified_timestamp="2020-01-01T00:00:00+00:00",
    )

    diff = compute_diff(user, payload)
    assert diff.is_stale is False


@pytest.mark.django_db
def test_diff_not_stale_when_no_incoming_timestamp():
    uid = next(_UID)
    user = _user(user_id=uid, synced_at=timezone.now())
    payload = _payload(
        user_login=user.user_login,
        user_email=user.email,
        x_modified_timestamp=None,
    )

    diff = compute_diff(user, payload)
    assert diff.is_stale is False


# ── pre_snapshot content ──────────────────────────────────────────────────────


@pytest.mark.django_db
def test_diff_pre_snapshot_contains_tracked_fields():
    uid = next(_UID)
    user = _user(user_id=uid)
    payload = _payload(user_login=user.user_login, user_email=user.email)

    diff = compute_diff(user, payload)

    for field in TRACKED_FIELDS:
        assert field in diff.pre_snapshot


@pytest.mark.django_db
def test_diff_pre_snapshot_contains_synced_at():
    uid = next(_UID)
    user = _user(user_id=uid)
    payload = _payload(user_login=user.user_login, user_email=user.email)

    diff = compute_diff(user, payload)
    assert "synced_at" in diff.pre_snapshot


# ── reactivation flag ─────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_diff_reactivation_when_user_inactive():
    uid = next(_UID)
    user = _user(user_id=uid, is_active=False)
    payload = _payload(
        user_login=user.user_login, user_email=user.email, user_active_status=True
    )

    diff = compute_diff(user, payload)
    assert diff.is_reactivation is True


@pytest.mark.django_db
def test_diff_no_reactivation_when_user_active():
    uid = next(_UID)
    user = _user(user_id=uid, is_active=True)
    payload = _payload(
        user_login=user.user_login, user_email=user.email, user_active_status=True
    )

    diff = compute_diff(user, payload)
    assert diff.is_reactivation is False
