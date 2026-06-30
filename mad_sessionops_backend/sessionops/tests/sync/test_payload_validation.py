"""
Payload validation tests — defensive coercion and field-rename coverage.

Tests exercise RealtimeSyncUserPayload schema directly (Pydantic) and via the
HTTP endpoint (422 for invalid input).
"""

import json

import pytest
from django.test import Client
from rest_framework_simplejwt.tokens import RefreshToken

from sessionops.models import User
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload

ENDPOINT_BASE = "/sync-user-internal"
_UID = iter(range(7_900_000, 8_000_000))


# ── Helpers ────────────────────────────────────────────────────────────────────


def _url(user_id: int) -> str:
    return f"{ENDPOINT_BASE}/{user_id}"


def _admin_user() -> User:
    uid = next(_UID)
    return User.objects.create(
        user_id=uid,
        user_login=f"admin{uid}@val.test",
        user_display_name=f"Admin{uid}",
        email=f"admin{uid}@val.test",
        user_role="Project Lead",
        is_active=True,
    )


def _auth_header(user: User) -> dict:
    r = RefreshToken()
    r["user_id"] = user.user_id
    r.access_token["user_id"] = user.user_id
    return {"HTTP_AUTHORIZATION": f"Bearer {r.access_token}"}


def _base_payload(**kwargs) -> dict:
    return {
        "user_login": "test@val.test",
        "event_type": "update",
        "user_role": "Fellow",
        **kwargs,
    }


@pytest.fixture
def client():
    return Client()


# ── 1: empty string coercion ──────────────────────────────────────────────────


def test_payload_all_fields_empty_string_coerced_to_null():
    payload = RealtimeSyncUserPayload(
        user_login="u@test.com",
        event_type="update",
        user_display_name="",
        user_email="",
        user_phone="",
        user_role="",
        city="",
        center="",
        state="",
        x_modified_timestamp="",
        external_event_id="",
        reporting_manager_user_login="",
        reporting_manager_role_code="",
    )
    assert payload.user_display_name is None
    assert payload.user_email is None
    assert payload.user_phone is None
    assert payload.user_role is None
    assert payload.city is None
    assert payload.center is None
    assert payload.state is None
    assert payload.x_modified_timestamp is None
    assert payload.external_event_id is None
    assert payload.reporting_manager_user_login is None
    assert payload.reporting_manager_role_code is None


# ── 2 & 3: user_active_status string coercion ─────────────────────────────────


def test_payload_user_active_status_true_string_coerced_to_bool():
    for truthy in ("true", "True", "TRUE", "1", "yes"):
        p = RealtimeSyncUserPayload(
            user_login="u@test.com", event_type="insert", user_active_status=truthy
        )
        assert p.user_active_status is True, f"Failed for {truthy!r}"


def test_payload_user_active_status_false_string_coerced_to_bool():
    for falsy in ("false", "False", "FALSE", "0", "no"):
        p = RealtimeSyncUserPayload(
            user_login="u@test.com", event_type="insert", user_active_status=falsy
        )
        assert p.user_active_status is False, f"Failed for {falsy!r}"


# ── 4: null user_active_status for deactivate ─────────────────────────────────


def test_payload_user_active_status_null_for_deactivate_succeeds():
    payload = RealtimeSyncUserPayload(
        user_login="u@test.com",
        event_type="deactivate",
        user_active_status=None,
        user_role="Alumni",
    )
    assert payload.user_active_status is None
    assert payload.event_type == "deactivate"


# ── 5 & 6: worknode_id coercion ───────────────────────────────────────────────


def test_payload_worknode_id_as_numeric_string_coerced_to_int():
    for val in ("42", " 42 ", "1000"):
        p = RealtimeSyncUserPayload(
            user_login="u@test.com", event_type="update", worknode_id=val
        )
        assert isinstance(p.worknode_id, int), f"Failed for {val!r}"
        assert p.worknode_id == int(val.strip()), f"Failed for {val!r}"


def test_payload_worknode_id_empty_string_treated_as_null():
    p = RealtimeSyncUserPayload(
        user_login="u@test.com", event_type="update", worknode_id=""
    )
    assert p.worknode_id is None


# ── 7 & 8: invalid values return 422 via endpoint ────────────────────────────


@pytest.mark.django_db
def test_payload_worknode_id_invalid_string_returns_400(client):
    admin = _admin_user()
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps(_base_payload(worknode_id="not-a-number")),
        content_type="application/json",
        **_auth_header(admin),
    )
    assert resp.status_code == 422


@pytest.mark.django_db
def test_payload_user_active_status_invalid_string_returns_400(client):
    admin = _admin_user()
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps(_base_payload(user_active_status="maybe")),
        content_type="application/json",
        **_auth_header(admin),
    )
    assert resp.status_code == 422


# ── 9 & 10: missing required fields return 422 ───────────────────────────────


@pytest.mark.django_db
def test_payload_missing_required_user_login_returns_400(client):
    admin = _admin_user()
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps({"event_type": "update"}),
        content_type="application/json",
        **_auth_header(admin),
    )
    assert resp.status_code == 422


@pytest.mark.django_db
def test_payload_missing_required_event_type_returns_400(client):
    admin = _admin_user()
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps({"user_login": "u@test.com"}),
        content_type="application/json",
        **_auth_header(admin),
    )
    assert resp.status_code == 422


# ── 11: unknown event_type returns 422 ────────────────────────────────────────


@pytest.mark.django_db
def test_payload_unknown_event_type_returns_400(client):
    admin = _admin_user()
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps(_base_payload(event_type="upsert")),
        content_type="application/json",
        **_auth_header(admin),
    )
    assert resp.status_code == 422


# ── 12: deactivate with all optional fields null succeeds ─────────────────────


@pytest.mark.django_db
def test_deactivate_event_succeeds_with_all_optional_fields_null(client):
    admin = _admin_user()
    uid = next(_UID)
    resp = client.post(
        _url(uid),
        data=json.dumps({
            "user_login": f"alumni{uid}@test.com",
            "event_type": "deactivate",
            "user_role": "Alumni",
            "sync_type": "realtime_webhook",
        }),
        content_type="application/json",
        **_auth_header(admin),
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["action_taken"] in {"user_deactivated", "no_change"}


# ── 13: field rename — payload uses user_active_status not is_active ──────────


def test_field_renaming_payload_uses_user_active_status_not_is_active():
    # is_active is not a declared field on the schema
    assert "is_active" not in RealtimeSyncUserPayload.model_fields

    # user_active_status must be accepted and stored correctly
    p = RealtimeSyncUserPayload(
        user_login="u@test.com",
        event_type="update",
        user_active_status=True,
    )
    assert p.user_active_status is True
    assert not hasattr(p, "is_active")
