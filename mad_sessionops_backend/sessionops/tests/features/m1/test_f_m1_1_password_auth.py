"""
Tests for F-M1-1: Password Authentication
Feature: set, login, forgot password (Brevo email)

Test structure:
  TC-M1-1-01  Login — success with valid credentials
  TC-M1-1-02  Login — fails with wrong password
  TC-M1-1-03  Login — fails with unknown email
  TC-M1-1-04  Login — fails for inactive user
  TC-M1-1-05  Register — creates User + UserAuth(password) and returns tokens
  TC-M1-1-06  Register — fails when email already exists
  TC-M1-1-07  Register — fails when password is too weak
  TC-M1-1-08  Token refresh — returns new access token
  TC-M1-1-09  Token refresh — fails with invalid refresh token
  TC-M1-1-10  Logout — blacklists refresh token
  TC-M1-1-11  Forgot password — creates PasswordResetToken and sends email
  TC-M1-1-12  Forgot password — silent no-op for unknown email (no enumeration)
  TC-M1-1-13  Reset password — sets new password and consumes token
  TC-M1-1-14  Reset password — fails with expired token
  TC-M1-1-15  Reset password — fails with already-used token
  TC-M1-1-16  Set password (first-time) — creates password auth for Hasura-synced user
  TC-M1-1-17  Set password (first-time) — fails if password already set
  TC-M1-1-18  Change password — success
  TC-M1-1-19  Change password — fails with wrong old password
  TC-M1-1-20  GET /me — returns profile for authenticated user
"""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.test import TestCase
from django.utils import timezone

from sessionops.models import PasswordResetToken, User, UserAuth
from sessionops.schemas.auth import (
    ChangePasswordSchema,
    ForgotPasswordSchema,
    LoginSchema,
    RegisterSchema,
    ResetPasswordSchema,
    SetPasswordSchema,
)
from sessionops.services.auth_service import AuthService, AuthenticationError


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_user(email="test@makeadiff.in", role="CO Full Time", active=True) -> User:
    return User.objects.create(
        email=email,
        user_login=email,
        user_display_name="Test User",
        user_role=role,
        is_active=active,
    )


def _make_user_with_password(email="test@makeadiff.in", password="Password1") -> tuple[User, UserAuth]:
    user = _make_user(email)
    auth = UserAuth.create_password_auth(user=user, email=email, password=password)
    return user, auth


# ---------------------------------------------------------------------------
# TC-M1-1-01: Login success
# ---------------------------------------------------------------------------

class TestLoginSuccess(TestCase):
    def test_login_returns_tokens_and_user(self):
        """TC-M1-1-01: Valid credentials → AuthResponseSchema with access + refresh tokens."""
        _make_user_with_password()

        result = AuthService.login_with_password(
            LoginSchema(email="test@makeadiff.in", password="Password1")
        )

        assert result.user.email == "test@makeadiff.in"
        assert result.tokens.access_token
        assert result.tokens.refresh_token
        assert result.tokens.token_type == "Bearer"


# ---------------------------------------------------------------------------
# TC-M1-1-02: Login — wrong password
# ---------------------------------------------------------------------------

class TestLoginWrongPassword(TestCase):
    def test_wrong_password_raises_invalid_credentials(self):
        """TC-M1-1-02: Wrong password → INVALID_CREDENTIALS error."""
        _make_user_with_password()

        with pytest.raises(AuthenticationError) as exc:
            AuthService.login_with_password(
                LoginSchema(email="test@makeadiff.in", password="WrongPass9")
            )
        assert exc.value.error_code == "INVALID_CREDENTIALS"


# ---------------------------------------------------------------------------
# TC-M1-1-03: Login — unknown email
# ---------------------------------------------------------------------------

class TestLoginUnknownEmail(TestCase):
    def test_unknown_email_raises_invalid_credentials(self):
        """TC-M1-1-03: Unknown email → INVALID_CREDENTIALS (no enumeration)."""
        with pytest.raises(AuthenticationError) as exc:
            AuthService.login_with_password(
                LoginSchema(email="nobody@makeadiff.in", password="Password1")
            )
        assert exc.value.error_code == "INVALID_CREDENTIALS"


# ---------------------------------------------------------------------------
# TC-M1-1-04: Login — inactive user
# ---------------------------------------------------------------------------

class TestLoginInactiveUser(TestCase):
    def test_inactive_user_cannot_login(self):
        """TC-M1-1-04: Deactivated user → INVALID_CREDENTIALS."""
        user = _make_user(active=False)
        UserAuth.create_password_auth(user=user, email=user.email, password="Password1")

        with pytest.raises(AuthenticationError) as exc:
            AuthService.login_with_password(
                LoginSchema(email=user.email, password="Password1")
            )
        assert exc.value.error_code == "INVALID_CREDENTIALS"


# ---------------------------------------------------------------------------
# TC-M1-1-05: Register — creates User + UserAuth
# ---------------------------------------------------------------------------

class TestRegister(TestCase):
    def test_register_creates_user_and_auth_record(self):
        """TC-M1-1-05: Registration creates User + UserAuth(password) and returns tokens."""
        result = AuthService.register_with_password(
            RegisterSchema(
                email="new@makeadiff.in",
                password="Secure1Pass",
                confirm_password="Secure1Pass",
                user_display_name="New User",
            )
        )

        assert result.user.email == "new@makeadiff.in"
        assert result.tokens.access_token
        assert User.objects.filter(email="new@makeadiff.in").exists()
        assert UserAuth.objects.filter(
            auth_type=UserAuth.AUTH_TYPE_PASSWORD,
            auth_identifier="new@makeadiff.in",
        ).exists()


# ---------------------------------------------------------------------------
# TC-M1-1-06: Register — duplicate email
# ---------------------------------------------------------------------------

class TestRegisterDuplicateEmail(TestCase):
    def test_duplicate_email_raises_email_exists(self):
        """TC-M1-1-06: Duplicate email → EMAIL_EXISTS error."""
        _make_user_with_password()

        with pytest.raises(AuthenticationError) as exc:
            AuthService.register_with_password(
                RegisterSchema(
                    email="test@makeadiff.in",
                    password="Another1Pass",
                    confirm_password="Another1Pass",
                    user_display_name="Dup User",
                )
            )
        assert exc.value.error_code == "EMAIL_EXISTS"


# ---------------------------------------------------------------------------
# TC-M1-1-07: Register — weak password (schema-level, tested via ValueError)
# ---------------------------------------------------------------------------

class TestRegisterWeakPassword(TestCase):
    def test_schema_rejects_weak_password(self):
        """TC-M1-1-07: Password < 8 chars or no uppercase fails schema validation."""
        from pydantic import ValidationError

        with pytest.raises(ValidationError):
            RegisterSchema(
                email="weak@makeadiff.in",
                password="short",
                confirm_password="short",
                user_display_name="Weak",
            )


# ---------------------------------------------------------------------------
# TC-M1-1-08 / 09: Token refresh
# ---------------------------------------------------------------------------

class TestTokenRefresh(TestCase):
    def test_valid_refresh_token_returns_new_access_token(self):
        """TC-M1-1-08: Valid refresh token → new access token."""
        _make_user_with_password()
        login = AuthService.login_with_password(
            LoginSchema(email="test@makeadiff.in", password="Password1")
        )
        result = AuthService.refresh_tokens(login.tokens.refresh_token)
        assert result.access_token
        assert result.access_token != login.tokens.access_token

    def test_invalid_refresh_token_raises_error(self):
        """TC-M1-1-09: Invalid refresh token → INVALID_REFRESH_TOKEN."""
        with pytest.raises(AuthenticationError) as exc:
            AuthService.refresh_tokens("not.a.valid.token")
        assert exc.value.error_code == "INVALID_REFRESH_TOKEN"


# ---------------------------------------------------------------------------
# TC-M1-1-10: Logout
# ---------------------------------------------------------------------------

class TestLogout(TestCase):
    def test_logout_blacklists_refresh_token(self):
        """TC-M1-1-10: Logout blacklists the refresh token so it cannot be reused."""
        _make_user_with_password()
        login = AuthService.login_with_password(
            LoginSchema(email="test@makeadiff.in", password="Password1")
        )
        AuthService.logout(login.tokens.refresh_token)

        with pytest.raises(AuthenticationError) as exc:
            AuthService.refresh_tokens(login.tokens.refresh_token)
        assert exc.value.error_code == "INVALID_REFRESH_TOKEN"


# ---------------------------------------------------------------------------
# TC-M1-1-11: Forgot password — sends email
# ---------------------------------------------------------------------------

class TestForgotPassword(TestCase):
    @patch("sessionops.services.auth_service.send_password_reset_email")
    def test_forgot_password_creates_token_and_sends_email(self, mock_send):
        """TC-M1-1-11: Valid email → PasswordResetToken created, email sent."""
        user = _make_user()
        AuthService.request_password_reset(user.email)

        assert PasswordResetToken.objects.filter(user=user).exists()
        mock_send.assert_called_once()
        call_kwargs = mock_send.call_args
        assert str(PasswordResetToken.objects.get(user=user).token) in call_kwargs.kwargs.get(
            "reset_url", call_kwargs.args[2] if len(call_kwargs.args) > 2 else ""
        )


# ---------------------------------------------------------------------------
# TC-M1-1-12: Forgot password — unknown email (silent)
# ---------------------------------------------------------------------------

class TestForgotPasswordUnknownEmail(TestCase):
    @patch("sessionops.services.auth_service.send_password_reset_email")
    def test_unknown_email_is_silent(self, mock_send):
        """TC-M1-1-12: Unknown email → no token created, no email sent, no error raised."""
        AuthService.request_password_reset("nobody@makeadiff.in")
        mock_send.assert_not_called()
        assert not PasswordResetToken.objects.exists()


# ---------------------------------------------------------------------------
# TC-M1-1-13: Reset password — success
# ---------------------------------------------------------------------------

class TestResetPassword(TestCase):
    @patch("sessionops.services.auth_service.send_password_reset_email")
    def test_valid_token_sets_new_password(self, _mock):
        """TC-M1-1-13: Valid token → password updated, token consumed."""
        user = _make_user()
        AuthService.request_password_reset(user.email)
        token_obj = PasswordResetToken.objects.get(user=user)

        AuthService.reset_password(str(token_obj.token), "NewPass1Word")

        token_obj.refresh_from_db()
        assert token_obj.used_at is not None

        # Can now log in with new password
        result = AuthService.login_with_password(
            LoginSchema(email=user.email, password="NewPass1Word")
        )
        assert result.user.email == user.email


# ---------------------------------------------------------------------------
# TC-M1-1-14: Reset password — expired token
# ---------------------------------------------------------------------------

class TestResetPasswordExpiredToken(TestCase):
    def test_expired_token_raises_error(self):
        """TC-M1-1-14: Expired token → INVALID_RESET_TOKEN."""
        user = _make_user()
        token_obj = PasswordResetToken.objects.create(
            user=user,
            expires_at=timezone.now() - timedelta(minutes=1),
        )
        with pytest.raises(AuthenticationError) as exc:
            AuthService.reset_password(str(token_obj.token), "NewPass1Word")
        assert exc.value.error_code == "INVALID_RESET_TOKEN"


# ---------------------------------------------------------------------------
# TC-M1-1-15: Reset password — already-used token
# ---------------------------------------------------------------------------

class TestResetPasswordUsedToken(TestCase):
    def test_used_token_raises_error(self):
        """TC-M1-1-15: Already-used token → INVALID_RESET_TOKEN."""
        user = _make_user()
        token_obj = PasswordResetToken.objects.create(
            user=user,
            expires_at=timezone.now() + timedelta(minutes=30),
        )
        token_obj.consume()

        with pytest.raises(AuthenticationError) as exc:
            AuthService.reset_password(str(token_obj.token), "NewPass1Word")
        assert exc.value.error_code == "INVALID_RESET_TOKEN"


# ---------------------------------------------------------------------------
# TC-M1-1-16: Set password first-time — success
# ---------------------------------------------------------------------------

class TestSetPasswordFirstTime(TestCase):
    def test_hasura_synced_user_can_set_password(self):
        """TC-M1-1-16: User with no password auth → creates password auth record."""
        user = _make_user()
        assert not user.has_password_auth()

        AuthService.set_password_first_time(user, "FirstPass1")

        user.refresh_from_db()
        assert user.has_password_auth()

        result = AuthService.login_with_password(
            LoginSchema(email=user.email, password="FirstPass1")
        )
        assert result.user.email == user.email


# ---------------------------------------------------------------------------
# TC-M1-1-17: Set password first-time — already set
# ---------------------------------------------------------------------------

class TestSetPasswordAlreadySet(TestCase):
    def test_fails_when_password_already_exists(self):
        """TC-M1-1-17: User with existing password auth → PASSWORD_ALREADY_SET error."""
        user, _ = _make_user_with_password()

        with pytest.raises(AuthenticationError) as exc:
            AuthService.set_password_first_time(user, "AnotherPass1")
        assert exc.value.error_code == "PASSWORD_ALREADY_SET"


# ---------------------------------------------------------------------------
# TC-M1-1-18 / 19: Change password
# ---------------------------------------------------------------------------

class TestChangePassword(TestCase):
    def test_change_password_success(self):
        """TC-M1-1-18: Correct old password → password updated."""
        user, _ = _make_user_with_password(password="OldPass1")
        AuthService.change_password(
            user,
            ChangePasswordSchema(old_password="OldPass1", new_password="NewPass1"),
        )
        result = AuthService.login_with_password(
            LoginSchema(email=user.email, password="NewPass1")
        )
        assert result.user.email == user.email

    def test_change_password_wrong_old(self):
        """TC-M1-1-19: Wrong old password → WRONG_PASSWORD error."""
        user, _ = _make_user_with_password(password="OldPass1")
        with pytest.raises(AuthenticationError) as exc:
            AuthService.change_password(
                user,
                ChangePasswordSchema(old_password="WrongOld1", new_password="NewPass1"),
            )
        assert exc.value.error_code == "WRONG_PASSWORD"


# ---------------------------------------------------------------------------
# TC-M1-1-20: GET /me returns correct profile
# ---------------------------------------------------------------------------

class TestGetCurrentUser(TestCase):
    def test_get_current_user_by_id(self):
        """TC-M1-1-20: get_current_user returns User object for valid user_id."""
        user = _make_user()
        result = AuthService.get_current_user(user.user_id)
        assert result is not None
        assert result.email == user.email
