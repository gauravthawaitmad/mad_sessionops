"""
Unit tests for F01a auth services.
Google OAuth calls are mocked — no real network traffic.
DB calls use Django's test DB (pytest-django).
"""

from unittest.mock import MagicMock, patch

from django.utils import timezone

import pytest
from rest_framework_simplejwt.tokens import RefreshToken

from sessionops.exceptions import AuthenticationError
from sessionops.models import User, UserAuth
from sessionops.services.auth import complete_google_login
from sessionops.services.auth.tokens import logout, refresh_access_token

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


def _make_user(**kwargs):
    defaults = dict(
        email="co@makeadiff.in",
        user_login="co@makeadiff.in",
        user_display_name="Test CO",
        user_role="CO Full Time",
        is_active=True,
    )
    defaults.update(kwargs)
    return User.objects.create(**defaults)


VALID_CLAIMS = {
    "sub": "google-sub-123",
    "email": "co@makeadiff.in",
    "email_verified": True,
    "name": "Test CO",
}


# ---------------------------------------------------------------------------
# complete_google_login
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestCompleteGoogleLogin:
    def _call(self, claims=None, **kwargs):
        claims = claims or VALID_CLAIMS
        with patch(
            "sessionops.services.auth.exchange_code_for_id_token",
            return_value=claims,
        ):
            return complete_google_login("code", "verifier", "http://localhost/cb")

    def test_new_user_first_login_creates_userauth(self):
        user = _make_user()
        result_user, access, refresh = self._call()

        assert result_user.user_id == user.user_id
        assert access
        assert refresh

        auth = UserAuth.objects.get(user=user, auth_type="google")
        assert auth.auth_identifier == "google-sub-123"
        assert auth.google_email_verified is True
        assert auth.last_used_at is not None

    def test_updates_last_login_at(self):
        user = _make_user()
        assert user.last_login_at is None
        self._call()
        user.refresh_from_db()
        assert user.last_login_at is not None

    def test_existing_active_auth_updates_last_used(self):
        user = _make_user()
        UserAuth.objects.create(
            user=user,
            auth_type="google",
            auth_identifier="google-sub-123",
            google_email_verified=True,
        )
        self._call()
        auth = UserAuth.objects.get(user=user, auth_type="google")
        assert auth.last_used_at is not None

    def test_soft_deleted_auth_creates_new_row(self):
        user = _make_user()
        UserAuth.objects.create(
            user=user,
            auth_type="google",
            auth_identifier="google-sub-123",
            google_email_verified=True,
            is_active=False,
            deleted_at=timezone.now(),
        )
        self._call()
        active = UserAuth.objects.filter(user=user, auth_type="google").count()
        assert active == 1  # new active row
        assert (
            UserAuth.objects.all_with_deleted().filter(user=user, auth_type="google").count() == 2
        )

    def test_unknown_email_raises(self):
        with pytest.raises(AuthenticationError) as exc_info:
            self._call()
        assert exc_info.value.error_code == "USER_NOT_FOUND"

    def test_inactive_user_raises(self):
        _make_user(is_active=False)
        with pytest.raises(AuthenticationError) as exc_info:
            self._call()
        assert exc_info.value.error_code == "USER_INACTIVE"

    def test_no_allowed_role_raises(self):
        _make_user(user_role="Wingman")
        with pytest.raises(AuthenticationError) as exc_info:
            self._call()
        assert exc_info.value.error_code == "ROLE_NOT_ALLOWED"

    def test_google_sub_mismatch_raises(self):
        user = _make_user()
        UserAuth.objects.create(
            user=user,
            auth_type="google",
            auth_identifier="different-sub",
            google_email_verified=True,
        )
        with pytest.raises(AuthenticationError) as exc_info:
            self._call()
        assert exc_info.value.error_code == "GOOGLE_SUB_MISMATCH"

    def test_case_insensitive_email_match(self):
        user = _make_user(user_login="CO@MAKEADIFF.IN", email="co@makeadiff.in")
        self._call(claims={**VALID_CLAIMS, "email": "co@makeadiff.in"})
        user.refresh_from_db()
        assert user.last_login_at is not None

    def test_admin_role_allowed(self):
        user = _make_user(user_role="Function Lead")
        result_user, _, _ = self._call()
        assert result_user.user_id == user.user_id

    def test_mixed_allowed_and_disallowed_roles_permitted(self):
        user = _make_user(user_role="CO Full Time,Wingman")
        result_user, _, _ = self._call()
        assert result_user.user_id == user.user_id


# ---------------------------------------------------------------------------
# tokens.refresh_access_token
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestRefreshAccessToken:
    def _make_refresh(self, user):
        r = RefreshToken()
        r["user_id"] = user.user_id
        r["email"] = user.email
        r["role"] = user.user_role
        r.access_token["user_id"] = user.user_id
        r.access_token["email"] = user.email
        r.access_token["role"] = user.user_role
        return str(r)

    def test_valid_token_returns_access_token(self):
        user = _make_user()
        rt = self._make_refresh(user)
        access = refresh_access_token(rt)
        assert access

    def test_inactive_user_raises(self):
        user = _make_user(is_active=False)
        rt = self._make_refresh(user)
        # SoftDeleteManager filters inactive — bypass with all_with_deleted isn't needed
        # because refresh_access_token uses User.objects.get which uses default manager.
        # Inactive user won't be found by default manager.
        with pytest.raises(AuthenticationError) as exc_info:
            refresh_access_token(rt)
        # Either USER_NOT_FOUND (filtered by manager) or USER_INACTIVE
        assert exc_info.value.error_code in ("USER_NOT_FOUND", "USER_INACTIVE")

    def test_invalid_token_raises(self):
        with pytest.raises(AuthenticationError) as exc_info:
            refresh_access_token("not-a-token")
        assert exc_info.value.error_code == "INVALID_REFRESH_TOKEN"

    def test_no_allowed_role_raises(self):
        user = _make_user(user_role="Wingman")
        rt = self._make_refresh(user)
        with pytest.raises(AuthenticationError) as exc_info:
            refresh_access_token(rt)
        assert exc_info.value.error_code == "ROLE_NOT_ALLOWED"


# ---------------------------------------------------------------------------
# tokens.logout
# ---------------------------------------------------------------------------


@pytest.mark.django_db
class TestLogout:
    def _make_refresh(self, user):
        r = RefreshToken()
        r["user_id"] = user.user_id
        return str(r)

    def test_valid_token_blacklisted(self):
        user = _make_user()
        rt = self._make_refresh(user)
        logout(rt)  # Should not raise.
        # After blacklist, refresh_access_token should fail.
        with pytest.raises(AuthenticationError):
            refresh_access_token(rt)

    def test_invalid_token_does_not_raise(self):
        logout("garbage-token")  # Idempotent — no exception.

    def test_already_blacklisted_does_not_raise(self):
        user = _make_user()
        rt = self._make_refresh(user)
        logout(rt)
        logout(rt)  # Second call silently ignored.
