"""
F-M8a-6: Admin realtime events API tests.

Tests cover:
  GET  /api/admin/realtime-events/    — list with filters + pagination
  GET  /api/admin/realtime-events/{id}/ — detail with snapshots
  POST /api/admin/realtime-events/sync-user — manual sync trigger

Auth pattern: admin JWT (Project Lead) for success paths, CO role for 403 paths.
"""

import json

import pytest
from django.test import Client
from rest_framework_simplejwt.tokens import RefreshToken

from sessionops.models import RealtimeSyncLog, User

BASE = "/api/admin/realtime-events"

# ── Helpers ────────────────────────────────────────────────────────────────────

_UID = iter(range(8_000_000, 8_200_000))


def _user(role: str = "Project Lead", is_active: bool = True) -> User:
    uid = next(_UID)
    return User.objects.create(
        user_id=uid,
        user_login=f"u{uid}@re.test",
        user_display_name=f"User{uid}",
        email=f"u{uid}@re.test",
        user_role=role,
        is_active=is_active,
    )


def _tok(user: User) -> str:
    r = RefreshToken()
    r["user_id"] = user.user_id
    r["email"] = user.email
    r.access_token["user_id"] = user.user_id
    r.access_token["email"] = user.email
    return str(r.access_token)


def _h(user: User) -> dict:
    return {"HTTP_AUTHORIZATION": f"Bearer {_tok(user)}"}


def _log(
    user_id: int = 9_000_001,
    sync_type: str = "realtime_webhook",
    event_type: str = "update",
    status: str = "success",
    action_taken: str = "common_fields_updated",
    triggered_by: User | None = None,
    **kwargs,
) -> RealtimeSyncLog:
    return RealtimeSyncLog.objects.create(
        user_id_from_source=user_id,
        sync_type=sync_type,
        event_type=event_type,
        status=status,
        action_taken=action_taken,
        triggered_by=triggered_by,
        **kwargs,
    )


# ── List endpoint ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_list_events_requires_admin():
    co = _user(role="CO Full Time")
    client = Client()
    resp = client.get(f"{BASE}", **_h(co))
    assert resp.status_code == 403


@pytest.mark.django_db
def test_list_events_returns_empty_when_none():
    admin = _user()
    client = Client()
    resp = client.get(f"{BASE}", **_h(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 0
    assert data["results"] == []


@pytest.mark.django_db
def test_list_events_returns_paginated_results():
    admin = _user()
    for i in range(30):
        _log(user_id=9_001_000 + i)
    client = Client()
    resp = client.get(f"{BASE}?page=2&page_size=10", **_h(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 30
    assert data["page"] == 2
    assert data["page_size"] == 10
    assert len(data["results"]) == 10


@pytest.mark.django_db
def test_list_events_filter_by_status():
    admin = _user()
    _log(status="success", action_taken="common_fields_updated")
    _log(status="failed", action_taken="failed")
    _log(status="skipped_no_change", action_taken="no_change")
    client = Client()
    resp = client.get(f"{BASE}?status=success", **_h(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["results"][0]["status"] == "success"


@pytest.mark.django_db
def test_list_events_filter_by_event_type():
    admin = _user()
    _log(event_type="update", action_taken="common_fields_updated")
    _log(event_type="insert", action_taken="user_created")
    _log(event_type="deactivate", action_taken="user_deactivated")
    client = Client()
    resp = client.get(f"{BASE}?event_type=deactivate", **_h(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["results"][0]["event_type"] == "deactivate"


@pytest.mark.django_db
def test_list_events_filter_by_user_id():
    admin = _user()
    _log(user_id=9_002_001)
    _log(user_id=9_002_002)
    _log(user_id=9_002_001)
    client = Client()
    resp = client.get(f"{BASE}?user_id_from_source=9002001", **_h(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 2
    for row in data["results"]:
        assert row["user_id_from_source"] == 9_002_001


@pytest.mark.django_db
def test_list_events_filter_by_sync_type():
    admin = _user()
    _log(sync_type="manual_admin", action_taken="common_fields_updated")
    _log(sync_type="realtime_webhook", action_taken="common_fields_updated")
    client = Client()
    resp = client.get(f"{BASE}?sync_type=manual_admin", **_h(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert data["total"] == 1
    assert data["results"][0]["sync_type"] == "manual_admin"


@pytest.mark.django_db
def test_list_events_result_has_expected_fields():
    admin = _user()
    _log(
        user_id=9_003_001,
        sync_type="manual_admin",
        event_type="update",
        status="success",
        action_taken="common_fields_updated",
        triggered_by=admin,
        external_event_id="ext-123",
    )
    client = Client()
    resp = client.get(f"{BASE}", **_h(admin))
    assert resp.status_code == 200
    row = resp.json()["results"][0]
    assert "realtime_sync_log_id" in row
    assert row["user_id_from_source"] == 9_003_001
    assert row["sync_type"] == "manual_admin"
    assert row["event_type"] == "update"
    assert row["status"] == "success"
    assert row["action_taken"] == "common_fields_updated"
    assert row["triggered_by_user_id"] == admin.user_id
    assert row["external_event_id"] == "ext-123"
    assert "pre_snapshot" not in row  # not in list view
    assert "incoming_payload" not in row  # not in list view


# ── Detail endpoint ────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_get_event_detail_requires_admin():
    co = _user(role="CO Full Time")
    log = _log()
    client = Client()
    resp = client.get(f"{BASE}/{log.realtime_sync_log_id}", **_h(co))
    assert resp.status_code == 403


@pytest.mark.django_db
def test_get_event_detail_includes_snapshots():
    admin = _user()
    snapshot = {"user_login": "old@test.com", "user_role": "Youth"}
    payload_data = {"user_login": "new@test.com", "user_role": "Alumni"}
    log = _log(
        pre_snapshot=snapshot,
        incoming_payload=payload_data,
        field_changes=[{"field": "user_login", "old": "old@test.com", "new": "new@test.com"}],
        cascaded_changes=[{"table": "school_volunteer", "id": 1, "action": "soft_deleted"}],
        rules_fired=["deactivate_user"],
    )
    client = Client()
    resp = client.get(f"{BASE}/{log.realtime_sync_log_id}", **_h(admin))
    assert resp.status_code == 200
    data = resp.json()
    assert data["pre_snapshot"] == snapshot
    assert data["incoming_payload"] == payload_data
    assert data["field_changes"][0]["field"] == "user_login"
    assert data["cascaded_changes"][0]["table"] == "school_volunteer"
    assert "deactivate_user" in data["rules_fired"]


@pytest.mark.django_db
def test_get_event_not_found():
    admin = _user()
    client = Client()
    resp = client.get(f"{BASE}/9999999", **_h(admin))
    assert resp.status_code == 404


# ── Manual sync endpoint ───────────────────────────────────────────────────────


@pytest.mark.django_db
def test_manual_sync_requires_admin():
    co = _user(role="CO Full Time")
    target = _user(role="Youth")
    client = Client()
    resp = client.post(
        f"{BASE}/sync-user",
        data=json.dumps({
            "payload": {
                "user_id": target.user_id,
                "user_login": target.user_login,
                "event_type": "update",
                "sync_type": "manual_admin",
            }
        }),
        content_type="application/json",
        **_h(co),
    )
    assert resp.status_code == 403


@pytest.mark.django_db
def test_manual_sync_valid_payload_returns_log_id():
    admin = _user()
    target = _user(role="Youth")
    client = Client()
    resp = client.post(
        f"{BASE}/sync-user",
        data=json.dumps({
            "payload": {
                "user_id": target.user_id,
                "user_login": target.user_login,
                "user_display_name": target.user_display_name,
                "user_email": target.email,
                "event_type": "update",
                "sync_type": "manual_admin",
                "user_role": "Youth",
            }
        }),
        content_type="application/json",
        **_h(admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "log_id" in data
    assert "status" in data
    assert "action_taken" in data
    assert RealtimeSyncLog.objects.filter(realtime_sync_log_id=data["log_id"]).exists()


@pytest.mark.django_db
def test_manual_sync_missing_user_id_returns_400():
    admin = _user()
    client = Client()
    resp = client.post(
        f"{BASE}/sync-user",
        data=json.dumps({
            "payload": {
                "user_login": "someone@test.com",
                "event_type": "update",
                "sync_type": "manual_admin",
            }
        }),
        content_type="application/json",
        **_h(admin),
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_manual_sync_invalid_payload_missing_required_field_returns_400():
    admin = _user()
    client = Client()
    resp = client.post(
        f"{BASE}/sync-user",
        data=json.dumps({
            "payload": {
                "user_id": 9_004_001,
                # missing user_login and event_type (required by RealtimeSyncUserPayload)
                "sync_type": "manual_admin",
            }
        }),
        content_type="application/json",
        **_h(admin),
    )
    assert resp.status_code == 400


@pytest.mark.django_db
def test_manual_sync_writes_triggered_by():
    admin = _user()
    target = _user(role="Youth")
    client = Client()
    resp = client.post(
        f"{BASE}/sync-user",
        data=json.dumps({
            "payload": {
                "user_id": target.user_id,
                "user_login": target.user_login,
                "user_display_name": target.user_display_name,
                "user_email": target.email,
                "event_type": "update",
                "sync_type": "manual_admin",
                "user_role": "Youth",
            }
        }),
        content_type="application/json",
        **_h(admin),
    )
    assert resp.status_code == 200
    log_id = resp.json()["log_id"]
    log = RealtimeSyncLog.objects.get(realtime_sync_log_id=log_id)
    assert log.triggered_by_id == admin.user_id
