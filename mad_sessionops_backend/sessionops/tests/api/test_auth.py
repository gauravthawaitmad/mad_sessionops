"""
Integration tests for F01a auth endpoints.

Uses Django's test client against the full WSGI stack so that
auth middleware and exception handlers are exercised.
Mocks exchange_code_for_id_token to avoid live Google calls.
"""

import json
from unittest.mock import patch

from django.test import Client

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from sessionops.models import User, UserAuth

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

_GOOGLE_SUB = "google-sub-test-123"


def _make_user(user_role="CO Full Time", is_active=True, email="user@example.com"):
    return User.objects.create(
        email=email,
        user_login=email,
        user_display_name="Test User",
        user_role=user_role,
        is_active=is_active,
    )


def _google_claims(email="user@example.com", sub=_GOOGLE_SUB):
    return {"sub": sub, "email": email, "email_verified": True, "name": "Test User"}


def _issue_tokens(user) -> tuple[str, str]:
    """Return (access_token_str, refresh_token_str) for a given user."""
    r = RefreshToken()
    r["user_id"] = user.user_id
    r["email"] = user.email
    r["role"] = user.user_role
    r.access_token["user_id"] = user.user_id
    r.access_token["email"] = user.email
    r.access_token["role"] = user.user_role
    return str(r.access_token), str(r)


def _auth_header(access_token: str) -> dict:
    return {"HTTP_AUTHORIZATION": f"Bearer {access_token}"}


_CALLBACK_URL = "/api/auth/google/callback"
_REFRESH_URL = "/api/auth/refresh"
_LOGOUT_URL = "/api/auth/logout"
_ME_URL = "/api/auth/me"


@pytest.fixture
def client():
    return Client()


# ---------------------------------------------------------------------------
# POST /api/auth/google/callback
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestGoogleCallback:
    def _post(self, client, email="user@example.com", sub=_GOOGLE_SUB, **payload_overrides):
        payload = {
            "code": "auth-code",
            "code_verifier": "verifier",
            "redirect_uri": "http://localhost/cb",
        }
        payload.update(payload_overrides)
        with patch(
            "sessionops.services.auth.exchange_code_for_id_token",
            return_value=_google_claims(email=email, sub=sub),
        ):
            return client.post(
                _CALLBACK_URL, data=json.dumps(payload), content_type="application/json"
            )

    def test_happy_path_co_full_time(self, client):
        _make_user(user_role="CO Full Time")
        resp = self._post(client)
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["user"]["user_login"] == "user@example.com"
        assert data["user"]["allowed_roles"] == ["CO Full Time"]
        assert data["user"]["is_admin"] is False

    def test_co_part_time_with_wingman_allowed(self, client):
        _make_user(user_role="CO Part Time,Wingman")
        resp = self._post(client)
        assert resp.status_code == 200
        data = resp.json()
        assert data["user"]["allowed_roles"] == ["CO Part Time"]
        assert data["user"]["is_admin"] is False

    def test_function_lead_is_admin(self, client):
        _make_user(user_role="Function Lead")
        resp = self._post(client)
        assert resp.status_code == 200
        assert resp.json()["user"]["is_admin"] is True

    def test_project_lead_with_academic_support_is_admin(self, client):
        _make_user(user_role="Project Lead,Academic Support")
        resp = self._post(client)
        assert resp.status_code == 200
        assert resp.json()["user"]["is_admin"] is True

    def test_academic_support_only_rejected(self, client):
        _make_user(user_role="Academic Support,Fellow")
        resp = self._post(client)
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "auth_failed"
        assert resp.json()["error"]["message"] == "Authentication failed"

    def test_wingman_rejected(self, client):
        _make_user(user_role="Wingman")
        resp = self._post(client)
        assert resp.status_code == 401

    def test_empty_role_rejected(self, client):
        _make_user(user_role="")
        resp = self._post(client)
        assert resp.status_code == 401

    def test_inactive_user_with_allowed_role_rejected(self, client):
        _make_user(user_role="CO Full Time", is_active=False)
        resp = self._post(client)
        assert resp.status_code == 401

    def test_unknown_email_rejected(self, client):
        # No user in DB
        resp = self._post(client, email="nobody@example.com")
        assert resp.status_code == 401

    def test_missing_code_returns_422(self, client):
        _make_user()
        payload = {"code_verifier": "v", "redirect_uri": "http://localhost/cb"}
        with patch(
            "sessionops.services.auth.exchange_code_for_id_token", return_value=_google_claims()
        ):
            resp = client.post(
                _CALLBACK_URL, data=json.dumps(payload), content_type="application/json"
            )
        assert resp.status_code == 422

    def test_error_envelope_shape(self, client):
        resp = self._post(client, email="nobody@example.com")
        body = resp.json()
        assert "error" in body
        assert "code" in body["error"]
        assert "message" in body["error"]
        assert body["error"]["message"] == "Authentication failed"


# ---------------------------------------------------------------------------
# POST /api/auth/refresh
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestRefreshEndpoint:
    def test_happy_path(self, client):
        user = _make_user()
        _, refresh = _issue_tokens(user)
        resp = client.post(
            _REFRESH_URL,
            data=json.dumps({"refresh_token": refresh}),
            content_type="application/json",
        )
        assert resp.status_code == 200
        data = resp.json()
        assert "access_token" in data
        assert len(data) == 1  # RefreshResponseSchema has only access_token

    def test_garbage_token_returns_401(self, client):
        resp = client.post(
            _REFRESH_URL,
            data=json.dumps({"refresh_token": "not-a-token"}),
            content_type="application/json",
        )
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "auth_failed"

    def test_missing_field_returns_422(self, client):
        resp = client.post(_REFRESH_URL, data=json.dumps({}), content_type="application/json")
        assert resp.status_code == 422

    def test_role_changed_to_disallowed_fails(self, client):
        user = _make_user(user_role="CO Full Time")
        _, refresh = _issue_tokens(user)
        # Simulate Hasura sync removing allowed role
        User.objects.filter(user_id=user.user_id).update(user_role="Wingman")
        resp = client.post(
            _REFRESH_URL,
            data=json.dumps({"refresh_token": refresh}),
            content_type="application/json",
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# POST /api/auth/logout
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestLogoutEndpoint:
    def test_happy_path_returns_204(self, client):
        user = _make_user()
        access, refresh = _issue_tokens(user)
        resp = client.post(
            _LOGOUT_URL,
            data=json.dumps({"refresh_token": refresh}),
            content_type="application/json",
            **_auth_header(access),
        )
        assert resp.status_code == 204

    def test_subsequent_refresh_fails_after_logout(self, client):
        user = _make_user()
        access, refresh = _issue_tokens(user)
        # Logout
        client.post(
            _LOGOUT_URL,
            data=json.dumps({"refresh_token": refresh}),
            content_type="application/json",
            **_auth_header(access),
        )
        # Refresh with same token should fail
        resp = client.post(
            _REFRESH_URL,
            data=json.dumps({"refresh_token": refresh}),
            content_type="application/json",
        )
        assert resp.status_code == 401

    def test_unauthenticated_returns_401(self, client):
        resp = client.post(
            _LOGOUT_URL,
            data=json.dumps({"refresh_token": "tok"}),
            content_type="application/json",
        )
        assert resp.status_code == 401


# ---------------------------------------------------------------------------
# GET /api/auth/me
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestMeEndpoint:
    def test_happy_path_profile_shape(self, client):
        user = _make_user(user_role="CO Full Time")
        access, _ = _issue_tokens(user)
        resp = client.get(_ME_URL, **_auth_header(access))
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == user.user_id
        assert data["user_login"] == user.user_login
        assert data["display_name"] == user.user_display_name
        assert data["allowed_roles"] == ["CO Full Time"]
        assert data["is_admin"] is False

    def test_admin_user_is_admin_true(self, client):
        user = _make_user(user_role="Project Lead")
        access, _ = _issue_tokens(user)
        resp = client.get(_ME_URL, **_auth_header(access))
        assert resp.json()["is_admin"] is True

    def test_no_token_returns_401(self, client):
        resp = client.get(_ME_URL)
        assert resp.status_code == 401
        assert resp.json()["error"]["code"] == "auth_failed"

    def test_garbage_token_returns_401(self, client):
        resp = client.get(_ME_URL, **{"HTTP_AUTHORIZATION": "Bearer garbage"})
        assert resp.status_code == 401

    def test_user_with_disallowed_role_rejected_at_middleware(self, client):
        user = _make_user(user_role="CO Full Time")
        access, _ = _issue_tokens(user)
        # Simulate role stripped between token issuance and request
        User.objects.filter(user_id=user.user_id).update(user_role="Wingman")
        resp = client.get(_ME_URL, **_auth_header(access))
        assert resp.status_code == 401
