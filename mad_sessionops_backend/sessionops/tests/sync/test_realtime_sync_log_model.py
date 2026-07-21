"""
F-M8a-1: RealtimeSyncLog model tests.
"""

from django.utils import timezone

import pytest

from sessionops.models import (
    ACTIONS_TAKEN,
    EVENT_TYPES,
    SYNC_STATUSES,
    SYNC_TYPES,
    RealtimeSyncLog,
    User,
)

# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(8_800_000, 8_900_000))


def _user() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_id=uid,
        user_login=f"u{uid}@test.com",
        user_display_name=f"User {uid}",
        email=f"u{uid}@test.com",
        user_role="Admin",
        is_active=True,
    )


def _log(**kwargs) -> RealtimeSyncLog:
    defaults = dict(
        user_id_from_source=1001,
        sync_type="manual_admin",
        event_type="insert",
        status="success",
        action_taken="user_created",
    )
    defaults.update(kwargs)
    return RealtimeSyncLog.objects.create(**defaults)


# ── Tests ──────────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_realtime_sync_log_insert_with_minimal_fields():
    log = _log()
    assert log.realtime_sync_log_id is not None
    assert log.user_id_from_source == 1001
    assert log.status == "success"
    assert log.action_taken == "user_created"
    assert log.received_at is not None
    assert log.created_at is not None


@pytest.mark.django_db
def test_realtime_sync_log_insert_with_all_fields():
    user = _user()
    log = _log(
        user_id_from_source=2002,
        sync_type="realtime_webhook",
        event_type="update",
        status="partial_success",
        action_taken="worknode_added",
        triggered_by=user,
        external_event_id="ext-abc-123",
        processed_at=timezone.now(),
        error_details=None,
        pre_snapshot={"user_login": "old@test.com"},
        incoming_payload={"user_login": "new@test.com"},
        field_changes=[{"field": "user_login", "old": "old@test.com", "new": "new@test.com"}],
        cascaded_changes=[{"table": "school_volunteer", "id": 5, "action": "soft_deleted"}],
        rules_fired=["ensure_school_volunteer:worknode_added"],
        deferred_operations={"reason": "no_partner_worknode_mapping"},
    )
    assert log.realtime_sync_log_id is not None
    assert log.triggered_by_id == user.user_id
    assert log.external_event_id == "ext-abc-123"
    assert log.field_changes[0]["field"] == "user_login"
    assert log.cascaded_changes[0]["table"] == "school_volunteer"


@pytest.mark.django_db
def test_realtime_sync_log_query_by_user_id():
    _log(user_id_from_source=3001)
    _log(user_id_from_source=3002)
    _log(user_id_from_source=3001)

    results = RealtimeSyncLog.objects.filter(user_id_from_source=3001)
    assert results.count() == 2
    assert all(r.user_id_from_source == 3001 for r in results)


@pytest.mark.django_db
def test_realtime_sync_log_query_by_status():
    _log(user_id_from_source=4001, status="success")
    _log(user_id_from_source=4002, status="failed")
    _log(user_id_from_source=4003, status="skipped_no_change")

    successes = RealtimeSyncLog.objects.filter(status="success")
    assert successes.filter(user_id_from_source=4001).exists()
    assert not successes.filter(user_id_from_source=4002).exists()


@pytest.mark.django_db
def test_realtime_sync_log_jsonfield_serialization():
    nested = {
        "before": {"worknode_id": None, "user_role": "CO Full Time"},
        "after": {"worknode_id": 42, "user_role": "CO Full Time"},
        "null_field": None,
    }
    log = _log(pre_snapshot=nested)

    fetched = RealtimeSyncLog.objects.get(pk=log.pk)
    assert fetched.pre_snapshot["before"]["worknode_id"] is None
    assert fetched.pre_snapshot["after"]["worknode_id"] == 42
    assert fetched.pre_snapshot["null_field"] is None


@pytest.mark.django_db
def test_realtime_sync_log_triggered_by_nullable():
    log = _log(triggered_by=None)
    assert log.triggered_by_id is None

    fetched = RealtimeSyncLog.objects.get(pk=log.pk)
    assert fetched.triggered_by is None


@pytest.mark.django_db
def test_realtime_sync_log_triggered_by_fk():
    user = _user()
    log = _log(triggered_by=user)

    fetched = RealtimeSyncLog.objects.select_related("triggered_by").get(pk=log.pk)
    assert fetched.triggered_by.user_id == user.user_id


@pytest.mark.django_db
def test_realtime_sync_log_no_soft_delete_fields():
    fields = {f.name for f in RealtimeSyncLog._meta.get_fields()}
    assert "is_active" not in fields
    assert "removed" not in fields
    assert "deleted_at" not in fields


@pytest.mark.django_db
def test_realtime_sync_log_all_statuses_valid():
    valid_statuses = [s[0] for s in SYNC_STATUSES]
    for status in valid_statuses:
        log = _log(user_id_from_source=5000, status=status)
        assert log.status == status


@pytest.mark.django_db
def test_realtime_sync_log_all_actions_valid():
    valid_actions = [a[0] for a in ACTIONS_TAKEN]
    for action in valid_actions:
        log = _log(user_id_from_source=6000, action_taken=action)
        assert log.action_taken == action


@pytest.mark.django_db
def test_realtime_sync_log_all_event_types_valid():
    for event_type, _ in EVENT_TYPES:
        log = _log(user_id_from_source=7000, event_type=event_type)
        assert log.event_type == event_type


@pytest.mark.django_db
def test_realtime_sync_log_all_sync_types_valid():
    for sync_type, _ in SYNC_TYPES:
        log = _log(user_id_from_source=8000, sync_type=sync_type)
        assert log.sync_type == sync_type
