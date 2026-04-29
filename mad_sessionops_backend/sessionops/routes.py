"""
Django Ninja API routes configuration.

=============================================================================
ROUTE ORGANIZATION
=============================================================================

This file configures all API routes for the MAD Backend.

API Structure:
    /api/v1/auth/*     -> Authentication (register, login, logout, etc.)
    /api/users/*       -> User management (requires auth)
    /health            -> Health check (public)

Two API instances:
1. `api` - Main API with JWT authentication (protected by default)
2. `public_api` - Public API without authentication

=============================================================================
"""

from django.http import JsonResponse
from ninja import NinjaAPI
from ninja.errors import ValidationError
from ninja.responses import Response
from pydantic import ValidationError as PydanticValidationError

from sessionops import auth
from sessionops.api.auth import auth_router
from sessionops.api.user_api import user_router
from sessionops.exceptions import (
    AuthenticationError,
    ConflictError,
    NotFound,
    PermissionDenied,
    ValidationError as BusinessValidationError,
)


# =============================================================================
# MAIN API (Protected by default)
# =============================================================================
# Routes here require JWT authentication unless explicitly disabled
# with auth=None on individual endpoints
# =============================================================================

api = NinjaAPI(
    urls_namespace="api",
    title="MAD Backend APIs",
    description="""
    MAD Sourcing Backend API.

    ## Authentication

    Most endpoints require JWT authentication. Include the access token
    in the Authorization header:

    ```
    Authorization: Bearer <access_token>
    ```

    ### Getting Tokens

    1. **Register**: POST /api/v1/auth/register
    2. **Login**: POST /api/v1/auth/login
    3. **Google OAuth**: POST /api/v1/auth/google

    ### Token Refresh

    When access token expires, use the refresh token:
    POST /api/v1/auth/refresh

    ## Error Responses

    All errors follow this format:
    ```json
    {
        "detail": "Error message"
    }
    ```

    Common status codes:
    - 400: Bad Request (validation error)
    - 401: Unauthorized (invalid/expired token)
    - 403: Forbidden (insufficient permissions)
    - 404: Not Found
    - 409: Conflict (resource already exists)
    - 422: Unprocessable Entity (validation failed)
    - 500: Internal Server Error
    """,
    docs_url="/api/docs",
    # Default authentication for all routes (can be overridden per route)
    auth=auth.CustomJwtAuthMiddleware(),
)


# =============================================================================
# EXCEPTION HANDLERS
# =============================================================================
# These handlers convert exceptions to consistent JSON responses
# =============================================================================


@api.exception_handler(ValidationError)
def ninja_validation_error_handler(request, exc):
    """
    Handle Django Ninja validation errors.

    These are raised when request payload doesn't match the expected schema.
    Returns 422 Unprocessable Entity with error details.
    """
    return Response({"detail": exc.errors}, status=422)


@api.exception_handler(PydanticValidationError)
def pydantic_validation_error_handler(request, exc: PydanticValidationError):
    """
    Handle Pydantic validation errors.

    These are raised during schema validation (both request and response).
    Returns 400 Bad Request with error details.
    """
    return Response({"detail": exc.errors()}, status=400)


@api.exception_handler(AuthenticationError)
def auth_error_handler(request, exc: AuthenticationError):
    return JsonResponse(
        {"error": {"code": "auth_failed", "message": "Authentication failed"}},
        status=401,
    )


@api.exception_handler(PermissionDenied)
def permission_denied_handler(request, exc: PermissionDenied):
    return JsonResponse(
        {"error": {"code": "permission_denied", "message": "Permission denied"}},
        status=403,
    )


@api.exception_handler(BusinessValidationError)
def business_validation_error_handler(request, exc: BusinessValidationError):
    return JsonResponse(
        {"error": {"code": "validation_error", "message": exc.message}},
        status=400,
    )


@api.exception_handler(NotFound)
def not_found_handler(request, exc: NotFound):
    return JsonResponse(
        {"error": {"code": "not_found", "message": exc.message}},
        status=404,
    )


@api.exception_handler(ConflictError)
def conflict_error_handler(request, exc: ConflictError):
    return JsonResponse(
        {"error": {"code": "conflict", "message": exc.message}},
        status=409,
    )


@api.exception_handler(Exception)
def ninja_default_error_handler(request, exc: Exception):
    """Catch-all — prevents raw tracebacks leaking to clients."""
    return Response({"detail": str(exc)}, status=500)


# =============================================================================
# ROUTE REGISTRATION
# =============================================================================
# Mount routers from api modules
# =============================================================================

# Authentication routes (mostly public - auth=None on individual routes)
# Prefix: /api/v1/auth/
api.add_router("/api/auth/", auth_router)

# User management routes (requires authentication)
# Prefix: /api/users/
user_router.tags = ["Users"]
api.add_router("/api/users/", user_router)


# =============================================================================
# PUBLIC API (No Authentication)
# =============================================================================
# Routes here are accessible without authentication
# Use for health checks, public endpoints, etc.
# =============================================================================

public_api = NinjaAPI(
    urls_namespace="public-api",
    title="Public MAD APIs",
    description="Public endpoints - no authentication required",
    docs_url="/api/v1/public/docs",
)


@public_api.get("/health")
def health_check(request):
    """
    Health check endpoint for load balancers and monitoring.

    Returns:
        200 OK with status information

    Example Response:
        {
            "status": "healthy",
            "service": "mad_backend"
        }
    """
    return {"status": "healthy", "service": "mad_backend"}

