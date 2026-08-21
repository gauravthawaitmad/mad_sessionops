"""
F-M8a-3: end-to-end tests through the sync endpoint.
Focuses on DB state assertions — the flow handler actually wrote to the DB.
Auth and allowlist behaviour are covered by test_realtime_sync_endpoint.py.
"""

import json

from django.test import Client
from django.utils import timezone

import pytest
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


# ── Skipped-role-then-later-allowed (dispatch bug regression) ──────────────────


@pytest.mark.django_db
def test_update_event_creates_user_previously_skipped_for_disallowed_role(client):
    """
    A user first arrives with a disallowed role via an INSERT event and is
    correctly skipped (no local row created). When their role later becomes
    allowed, the upstream event is an UPDATE (the row always existed in the
    source system) — but locally the user still doesn't exist. The dispatcher
    must route this to handle_insert based on local existence, not the
    event_type label, or it crashes trying to update a None user.
    """
    admin = _admin()
    uid = next(_UID)
    login = f"skip{uid}@test.com"

    skipped_resp = client.post(
        _url(uid),
        data=json.dumps(
            {
                "user_login": login,
                "user_email": login,
                "user_display_name": "Not Yet Allowed",
                "user_role": "Intern",
                "event_type": "insert",
            }
        ),
        content_type="application/json",
        **_auth(admin),
    )
    assert skipped_resp.status_code == 200
    assert skipped_resp.json()["status"] == "skipped_role_not_allowed"
    assert not User.objects.filter(user_id=uid).exists()

    promoted_resp = client.post(
        _url(uid),
        data=json.dumps(
            {
                "user_login": login,
                "user_email": login,
                "user_display_name": "Now Allowed",
                "user_role": "Youth",
                "event_type": "update",
            }
        ),
        content_type="application/json",
        **_auth(admin),
    )
    assert promoted_resp.status_code == 200
    assert promoted_resp.json()["status"] == "success"
    assert promoted_resp.json()["action_taken"] == "user_created"

    user = User.objects.get(user_id=uid)
    assert user.user_display_name == "Now Allowed"
    assert user.user_role == "Youth"
    assert user.is_active is True


# ── Deactivate priority over is_reactivation (dispatch ordering regression) ────


@pytest.mark.django_db
def test_deactivate_role_does_not_reactivate_already_inactive_user(client):
    """
    A user already soft-deleted locally (is_active=False) receives another
    event whose role is Alumni (deactivate-classified). is_reactivation is
    True purely because the local row happens to be inactive right now —
    deactivate intent must still win, not get misrouted to handle_insert's
    reactivation branch.
    """
    admin = _admin()
    uid = next(_UID)
    login = f"deact{uid}@test.com"
    User.objects.create(
        user_id=uid,
        user_login=login,
        user_display_name="Former Volunteer",
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
                "user_display_name": "Former Volunteer",
                "user_role": "Alumni",
                "event_type": "update",
            }
        ),
        content_type="application/json",
        **_auth(admin),
    )
    assert resp.status_code == 200
    assert resp.json()["status"] == "skipped_no_change"

    assert User.objects.get(user_id=uid).is_active is False
