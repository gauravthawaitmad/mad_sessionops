"""
Authentication and authorization module for sessionops.
"""

import logging
from functools import wraps

from ninja.errors import HttpError
from ninja.security import HttpBearer
from rest_framework.authtoken.models import Token
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer, TokenRefreshSerializer
from rest_framework_simplejwt.tokens import AccessToken
from django.contrib.auth.models import User as DjangoUser

from sessionops.models import User as MadUser
from sessionops.utils.custom_logger import CustomLogger

logger = CustomLogger("sessionops")
_log = logging.getLogger(__name__)

UNAUTHORIZED = "unauthorized"


def has_permission(permission_slugs: list):
    """
    Decorator to check if a user has the required permissions.
    
    Args:
        permission_slugs: List of permission slugs required for the endpoint
    
    Returns:
        Decorated function that checks permissions
    """
    def decorator(api_endpoint):
        @wraps(api_endpoint)
        def wrapper(*args, **kwargs):
            request = args[0]
            try:
                if not hasattr(request, 'permissions') or not request.permissions:
                    raise HttpError(403, "not allowed")

                if not set(request.permissions).issuperset(set(permission_slugs)):
                    raise HttpError(403, "not allowed")
            except Exception:
                raise HttpError(404, UNAUTHORIZED)

            return api_endpoint(*args, **kwargs)

        return wrapper

    return decorator


class CustomAuthMiddleware(HttpBearer):
    """Token-based authentication middleware (legacy support)"""

    def authenticate(self, request, token):
        tokenrecord = Token.objects.filter(key=token).first()
        if tokenrecord and tokenrecord.user:
            request.user = tokenrecord.user
            # Add organization-based authentication logic here
            # Following the pattern from Dalgo backend
            request.permissions = []
            return request

        raise HttpError(400, UNAUTHORIZED)


class CustomJwtAuthMiddleware(HttpBearer):
    """
    JWT middleware for F01a endpoints.

    Validates the Bearer token, looks up the active MadUser, and re-checks
    that the user still holds at least one allowed role (guards against
    role removal via Hasura sync between login and the next request).

    Returns the MadUser instance; endpoints access it via request.auth.
    Raises AuthenticationError for every failure — the global exception
    handler converts it to 401.
    """

    def __call__(self, request):
        # Ninja's default HttpBearer.__call__ returns None (not raises) when
        # the Authorization header is absent or malformed. We override to
        # raise AuthenticationError so the global handler issues our envelope.
        from sessionops.exceptions import AuthenticationError

        result = super().__call__(request)
        if result is None:
            raise AuthenticationError("Authentication failed.")
        return result

    def authenticate(self, request, token):
        # Import here to avoid circular import (auth.py ← exceptions.py ← auth.py chain).
        from sessionops.exceptions import AuthenticationError
        from sessionops.services.auth.role_helpers import get_allowed_roles

        _FAIL = "Authentication failed."

        if not token:
            raise AuthenticationError(_FAIL)

        try:
            payload = AccessToken(token).payload
        except Exception:
            raise AuthenticationError(_FAIL)

        user_id = payload.get("user_id")
        if not user_id:
            raise AuthenticationError(_FAIL)

        user = MadUser.objects.filter(user_id=user_id, is_active=True).first()
        if user is None:
            raise AuthenticationError(_FAIL)

        if not get_allowed_roles(user.user_role):
            raise AuthenticationError(_FAIL)

        request.user = user  # Django compatibility (admin, session middleware)
        return user


# Public alias used by F01a endpoints.
JwtAuth = CustomJwtAuthMiddleware


class CustomTokenObtainSerializer(TokenObtainPairSerializer):
    """
    Custom token serializer for JWT authentication.
    Adds custom claims to the token payload.
    """

    @classmethod
    def get_token(cls, user):
        token = super().get_token(user)
        
        # TODO: Implement role-based logic when needed
        # For now, we'll just add basic user info
        token["username"] = user.username
        token["email"] = user.email
        
        return token

    def validate(self, attrs):
        data = super().validate(attrs)
        return {"access": data["access"], "refresh": data["refresh"]}


class CustomTokenRefreshSerializer(TokenRefreshSerializer):
    """Custom token refresh serializer"""

    def validate(self, attrs):
        data = super().validate(attrs)
        # Get the user from the refresh token
        refresh = self.token_class(attrs["refresh"])
        user_id = refresh.payload.get("user_id")
        user = DjangoUser.objects.filter(id=user_id).first()
        if user:
            # Generate a new refresh token with custom claims
            refresh_token = CustomTokenObtainSerializer.get_token(user)
            access_token = refresh_token.access_token
            data["access"] = str(access_token)
        return data
