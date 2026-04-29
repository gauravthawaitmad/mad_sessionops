"""
Token operations for F01a: refresh and logout.
"""

import logging

from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from sessionops.exceptions import AuthenticationError
from sessionops.models import User
from sessionops.services.auth.role_helpers import get_allowed_roles

logger = logging.getLogger(__name__)


def refresh_access_token(refresh_token_str: str) -> str:
    """
    Validate a refresh token, re-check user liveness + roles, return a new access token.

    Raises AuthenticationError if the token is invalid/expired/blacklisted,
    the user is inactive, or the user has lost all allowed roles.
    """
    try:
        token = RefreshToken(refresh_token_str)
    except TokenError as exc:
        raise AuthenticationError(
            "Refresh token is invalid or expired.",
            error_code="INVALID_REFRESH_TOKEN",
        ) from exc

    user_id = token.get("user_id")
    if not user_id:
        raise AuthenticationError(
            "Refresh token is missing user_id claim.",
            error_code="INVALID_REFRESH_TOKEN",
        )

    try:
        user = User.objects.get(user_id=user_id)
    except User.DoesNotExist:
        raise AuthenticationError(
            "User no longer exists.",
            error_code="USER_NOT_FOUND",
        )

    if not user.is_active:
        raise AuthenticationError(
            "This account is deactivated.",
            error_code="USER_INACTIVE",
        )

    if not get_allowed_roles(user.user_role):
        raise AuthenticationError(
            "Your account does not have access to Session-Ops.",
            error_code="ROLE_NOT_ALLOWED",
        )

    # Stamp fresh role claim so it reflects any role changes since last login.
    access = token.access_token
    access["user_id"] = user.user_id
    access["email"] = user.email
    access["role"] = user.user_role
    return str(access)


def logout(refresh_token_str: str) -> None:
    """
    Blacklist a refresh token. Idempotent — already-blacklisted tokens are silently ignored.
    """
    try:
        token = RefreshToken(refresh_token_str)
        token.blacklist()
    except TokenError:
        # Token already blacklisted or invalid — treat as successful logout.
        logger.debug("logout: token was already invalid/blacklisted, ignoring")
