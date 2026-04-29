"""
Auth service package for F01a.

Public entry points:
  complete_google_login(code, code_verifier, redirect_uri) -> tuple[User, str, str]
"""

import logging

from django.db import transaction
from django.utils import timezone
from rest_framework_simplejwt.tokens import RefreshToken

from sessionops.exceptions import AuthenticationError
from sessionops.models import User, UserAuth
from sessionops.services.auth.google_oauth import exchange_code_for_id_token
from sessionops.services.auth.role_helpers import get_allowed_roles

logger = logging.getLogger(__name__)


def complete_google_login(
    code: str,
    code_verifier: str,
    redirect_uri: str,
) -> tuple[User, str, str]:
    """
    Orchestrate a full Google OAuth login.

    Returns (user, access_token_str, refresh_token_str).
    Raises AuthenticationError for every rejection case.

    Steps 1-4 are read-only. Steps 5-7 run inside a single transaction.
    """
    # Step 1: Exchange code → verified id_token claims.
    claims = exchange_code_for_id_token(code, code_verifier, redirect_uri)
    google_sub = claims["sub"]
    google_email = claims["email"].lower()

    # Step 2: Resolve user by email matched against user_login (case-insensitive).
    try:
        user = User.objects.get(user_login__iexact=google_email)
    except User.DoesNotExist:
        logger.warning("Google login attempted for unknown user_login=%s", google_email)
        raise AuthenticationError(
            "No account found for this Google email.",
            error_code="USER_NOT_FOUND",
        )

    # Step 3: Reject inactive users.
    if not user.is_active:
        logger.warning("Google login attempted for inactive user_id=%s", user.user_id)
        raise AuthenticationError(
            "This account is deactivated.",
            error_code="USER_INACTIVE",
        )

    # Step 4: Reject users with no allowed roles.
    if not get_allowed_roles(user.user_role):
        logger.warning(
            "Google login rejected — no allowed roles for user_id=%s role=%r",
            user.user_id,
            user.user_role,
        )
        raise AuthenticationError(
            "Your account does not have access to Session-Ops.",
            error_code="ROLE_NOT_ALLOWED",
        )

    # Steps 5-7: Transactional — upsert UserAuth, update last_login_at, issue tokens.
    with transaction.atomic():
        access_str, refresh_str = _upsert_google_auth_and_issue_tokens(user, google_sub)

    return user, access_str, refresh_str


def _upsert_google_auth_and_issue_tokens(
    user: User,
    google_sub: str,
) -> tuple[str, str]:
    """
    Upsert the UserAuth google row for this user, update last_login_at, issue JWT pair.
    Must be called inside a transaction.
    """
    now = timezone.now()

    existing_auth = (
        UserAuth.objects.all_with_deleted()
        .filter(user=user, auth_type=UserAuth.AUTH_TYPE_GOOGLE)
        .first()
    )

    if existing_auth is not None:
        if existing_auth.is_active:
            # Active row — verify google_sub matches (security: detect sub mismatch).
            if existing_auth.auth_identifier != google_sub:
                logger.error(
                    "SECURITY: google_sub mismatch for user_id=%s — stored=%r incoming=%r",
                    user.user_id,
                    existing_auth.auth_identifier,
                    google_sub,
                )
                raise AuthenticationError(
                    "Authentication error. Please contact support.",
                    error_code="GOOGLE_SUB_MISMATCH",
                )
            existing_auth.last_used_at = now
            existing_auth.save(update_fields=["last_used_at", "updated_at"])
        else:
            # Soft-deleted row — create a fresh one.
            UserAuth.objects.create(
                user=user,
                auth_type=UserAuth.AUTH_TYPE_GOOGLE,
                auth_identifier=google_sub,
                google_email_verified=True,
                last_used_at=now,
            )
    else:
        # No row yet — first Google login for this user.
        UserAuth.objects.create(
            user=user,
            auth_type=UserAuth.AUTH_TYPE_GOOGLE,
            auth_identifier=google_sub,
            google_email_verified=True,
            last_used_at=now,
        )

    # Step 6: Stamp last_login_at on the User record.
    user.last_login_at = now
    user.save(update_fields=["last_login_at", "user_updated_datetime"])

    # Step 7: Issue JWT pair.
    return _issue_jwt_pair(user)


def _issue_jwt_pair(user: User) -> tuple[str, str]:
    """Create a simplejwt RefreshToken with custom claims, return (access_str, refresh_str)."""
    refresh = RefreshToken()
    refresh["user_id"] = user.user_id
    refresh["email"] = user.email
    refresh["role"] = user.user_role
    refresh.access_token["user_id"] = user.user_id
    refresh.access_token["email"] = user.email
    refresh.access_token["role"] = user.user_role
    return str(refresh.access_token), str(refresh)
