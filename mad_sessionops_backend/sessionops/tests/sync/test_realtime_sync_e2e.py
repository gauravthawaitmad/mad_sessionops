"""
F-M8a-3: end-to-end tests through the sync endpoint.
Focuses on DB state assertions — the flow handler actually wrote to the DB.
Auth and allowlist behaviour are covered by test_realtime_sync_endpoint.py.
"""

import json

import pytest
from django.test import Client
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from sessionops.models import RealtimeSyncLog, User

ENDPOINT_BASE = "/sync-user-internal"

_UID = iter(range(7_500_000, 7_600_000))


def _url(user_id: int) -> str:
    return f"{ENDPOINT_BASE}/{user_id}"


def _admin() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_id=uid,
        user_login=f"admin{uid}@e2e.test",
        user_display_name=f"Admin {uid}",
        email=f"admin{uid}@e2e.test",
        user_role="Project Lead",
        is_active=True,
    )


def _auth(user: User) -> dict:
    r = RefreshToken()
    r["user_id"] = user.user_id
    r["email"] = user.email
    r.access_token["user_id"] = user.user_id
    r.access_token["email"] = user.email
    return {"HTTP_AUTHORIZATION": f"Bearer {str(r.access_token)}"}


@pytest.fixture
def client():
    return Client()


# ── INSERT flow ────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_insert_creates_user_row(client):
    admin = _admin()
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps(
            {
                "user_login": f"brand{uid}@test.com",
                "user_email": f"brand{uid}@test.com",
                "user_display_name": "Brand New",
                "user_role": "Youth",
                "event_type": "insert",
            }
        ),
        content_type="application/json",
        **_auth(admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["action_taken"] == "user_created"

    user = User.objects.get(user_id=uid)
    assert user.user_display_name == "Brand New"
    assert user.is_active is True
    assert user.synced_at is not None


@pytest.mark.django_db
def test_insert_log_row_captures_user_id(client):
    admin = _admin()
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps(
            {
                "user_login": f"log{uid}@test.com",
                "user_email": f"log{uid}@test.com",
                "user_display_name": "Log Test User",
                "user_role": "Wingman",
                "event_type": "insert",
            }
        ),
        content_type="application/json",
        **_auth(admin),
    )
    assert resp.status_code == 200
    log = RealtimeSyncLog.objects.get(realtime_sync_log_id=resp.json()["log_id"])
    assert log.user_id_from_source == uid
    assert log.action_taken == "user_created"


@pytest.mark.django_db
def test_insert_sets_location_and_org_fields(client):
    admin = _admin()
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps(
            {
                "user_login": f"loc{uid}@test.com",
                "user_email": f"loc{uid}@test.com",
                "user_display_name": "Location Test User",
                "user_role": "CO Full Time",
                "city": "Mumbai",
                "center": "Dharavi",
                "state": "Maharashtra",
                "reporting_manager_user_login": "mgr@test.com",
                "reporting_manager_role_code": "FL",
                "reporting_manager_user_id": 9900,
                "event_type": "insert",
            }
        ),
        content_type="application/json",
        **_auth(admin),
    )
    assert resp.status_code == 200
    user = User.objects.get(user_id=uid)
    assert user.city == "Mumbai"
    assert user.center == "Dharavi"
    assert user.state == "Maharashtra"
    assert user.reporting_manager_user_login == "mgr@test.com"
    assert user.reporting_manager_role_code == "FL"
    assert user.reporting_manager_user_id == 9900


# ── UPDATE flow ────────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_update_writes_changed_fields_to_db(client):
    admin = _admin()
    uid = next(_UID)
    login = f"upd{uid}@test.com"
    User.objects.create(
        user_id=uid,
        user_login=login,
        user_display_name="Old Name",
        email=login,
        user_role="CO Full Time",
        is_active=True,
    )
    resp = client.post(
        _url(uid),
        data=json.dumps(
            {
                "user_login": login,
                "user_email": login,
                "user_display_name": "New Name",
                "user_role": "CO Full Time",
                "event_type": "update",
            }
        ),
        content_type="application/json",
        **_auth(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["action_taken"] == "common_fields_updated"
    assert User.objects.get(user_id=uid).user_display_name == "New Name"


@pytest.mark.django_db
def test_update_sets_synced_at(client):
    admin = _admin()
    uid = next(_UID)
    login = f"st{uid}@test.com"
    before = timezone.now()
    User.objects.create(
        user_id=uid,
        user_login=login,
        user_display_name="Sync At Test",
        email=login,
        user_role="CO Full Time",
        is_active=True,
        synced_at=None,
    )
    client.post(
        _url(uid),
        data=json.dumps(
            {
                "user_login": login,
                "user_email": login,
                "user_display_name": "Sync At Updated",
                "user_role": "CO Full Time",
                "event_type": "update",
            }
        ),
        content_type="application/json",
        **_auth(admin),
    )
    synced_at = User.objects.get(user_id=uid).synced_at
    assert synced_at is not None
    assert synced_at >= before


@pytest.mark.django_db
def test_update_preserves_worknode_id_when_unchanged(client):
    admin = _admin()
    uid = next(_UID)
    login = f"wn{uid}@test.com"
    User.objects.create(
        user_id=uid,
        user_login=login,
        user_display_name="WN User",
        email=login,
        user_role="CO Full Time",
        is_active=True,
        worknode_id=99,
    )
    resp = client.post(
        _url(uid),
        data=json.dumps(
            {
                "user_login": login,
                "user_email": login,
                "user_display_name": "WN User Updated",
                "user_role": "CO Full Time",
                "worknode_id": 99,
                "event_type": "update",
            }
        ),
        content_type="application/json",
        **_auth(admin),
    )
    assert resp.status_code == 200
    assert User.objects.get(user_id=uid).worknode_id == 99


# ── Re-activation ──────────────────────────────────────────────────────────────


@pytest.mark.django_db
def test_reactivation_sets_is_active_true(client):
    admin = _admin()
    uid = next(_UID)
    login = f"react{uid}@test.com"
    User.objects.create(
        user_id=uid,
        user_login=login,
        user_display_name="Inactive User",
        email=login,
        user_role="Youth",
        is_active=False,
    )
    resp = client.post(
        _url(uid),
        data=json.dumps(
            {
                "user_login": login,
                "user_email": login,
                "user_display_name": "Reactivated User",
                "user_role": "Youth",
                "is_active": True,
                "event_type": "insert",
            }
        ),
        content_type="application/json",
        **_auth(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["action_taken"] == "user_created"
    assert User.objects.get(user_id=uid).is_active is True
