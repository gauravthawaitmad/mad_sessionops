"""
Authentication Schemas - Request and Response Validation.

=============================================================================
WHAT ARE PYDANTIC SCHEMAS IN DJANGO NINJA?
=============================================================================

Pydantic schemas (called "Schema" in Django Ninja) serve multiple purposes:

1. REQUEST VALIDATION
   - Automatically validate incoming JSON data
   - Convert types (string "123" to integer 123)
   - Return 422 error for invalid data

2. RESPONSE SERIALIZATION
   - Define what fields to include in response
   - Control JSON output format
   - Hide sensitive fields (like password_hash)

3. DOCUMENTATION
   - Generate OpenAPI/Swagger docs automatically
   - Define field descriptions and examples
   - Show required vs optional fields

=============================================================================
DJANGO NINJA VS PYDANTIC
=============================================================================

Django Ninja uses Pydantic under the hood, but provides a "Schema" class
that works better with Django:

    from ninja import Schema  # Django Ninja's wrapper

vs

    from pydantic import BaseModel  # Raw Pydantic

Both work, but Schema has better Django ORM integration.

=============================================================================
"""

import re
from datetime import datetime
from typing import Optional

from ninja import Schema
from pydantic import EmailStr, field_validator


# =============================================================================
# REQUEST SCHEMAS - What clients send to us
# =============================================================================


class RegisterSchema(Schema):
    """
    Schema for user registration request.

    Validates:
    - Email format
    - Password strength (min 8 chars, 1 uppercase, 1 number)
    - Password confirmation match
    - Display name presence

    Example Request:
        POST /api/v1/auth/register
        {
            "email": "john@example.com",
            "password": "SecurePass123!",
            "confirm_password": "SecurePass123!",
            "user_display_name": "John Doe"
        }
    """

    email: EmailStr
    # EmailStr is a Pydantic type that validates email format
    # - Checks for @ symbol
    # - Validates domain structure
    # - Does NOT verify email exists

    password: str
    # Will be validated by custom validator below

    confirm_password: str
    # Must match password field

    user_display_name: str
    # The name to display in the UI

    # =========================================================================
    # CUSTOM VALIDATORS
    # =========================================================================
    # Pydantic v2 uses @field_validator decorator
    # - 'mode="after"' runs after type conversion
    # - Return the value to keep it, raise ValueError to reject
    # =========================================================================

    @field_validator("password")
    @classmethod
    def validate_password_strength(cls, v: str) -> str:
        """
        Validate password meets security requirements.

        Requirements:
        - At least 8 characters
        - At least 1 uppercase letter
        - At least 1 lowercase letter
        - At least 1 number

        Why these requirements?
        - 8+ chars: Prevents trivial brute force
        - Mixed case: Increases character space
        - Numbers: Further increases complexity
        """
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")

        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")

        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")

        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")

        return v

    @field_validator("confirm_password")
    @classmethod
    def validate_passwords_match(cls, v: str, info) -> str:
        """
        Validate that confirm_password matches password.

        Note: In Pydantic v2, we access other fields via info.data
        """
        # info.data contains already-validated fields
        password = info.data.get("password")
        if password and v != password:
            raise ValueError("Passwords do not match")
        return v

    @field_validator("user_display_name")
    @classmethod
    def validate_display_name(cls, v: str) -> str:
        """
        Validate and clean display name.

        - Strip whitespace
        - Ensure not empty after stripping
        """
        v = v.strip()
        if not v:
            raise ValueError("Display name cannot be empty")
        if len(v) > 255:
            raise ValueError("Display name must be 255 characters or less")
        return v


class LoginSchema(Schema):
    """
    Schema for password-based login request.

    Example Request:
        POST /api/v1/auth/login
        {
            "email": "john@example.com",
            "password": "SecurePass123!"
        }
    """

    email: EmailStr
    password: str

    @field_validator("email")
    @classmethod
    def normalize_email(cls, v: str) -> str:
        """Normalize email to lowercase for consistent lookups."""
        return v.lower()


class GoogleAuthSchema(Schema):
    """
    Schema for Google OAuth login/registration using Authorization Code Flow with PKCE.

    This flow is more secure than the implicit flow:
    1. Frontend redirects user to Google
    2. Google redirects back to frontend with authorization code
    3. Frontend sends code + codeVerifier to backend
    4. Backend exchanges code for tokens with Google
    5. Backend verifies id_token and logs in user

    Example Request:
        POST /api/v1/auth/google/oauth/callback
        {
            "code": "4/0ASc3gC21p4zbGhx...",
            "code_verifier": "Srp1ogh23_MFrr3e6Bvg70votjH...",
            "redirect_uri": "http://localhost:3000/auth/callback/google"
        }

    Why Authorization Code Flow with PKCE?
    ======================================
    - More secure: Code can only be exchanged once
    - PKCE: Prevents authorization code interception attacks
    - Works for SPAs without exposing client secret to frontend
    """

    code: str
    codeVerifier: str
    redirectUri: str

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        """Validate authorization code is not empty."""
        v = v.strip()
        if not v:
            raise ValueError("Authorization code cannot be empty")
        return v

    @field_validator("codeVerifier")
    @classmethod
    def validate_code_verifier(cls, v: str) -> str:
        """
        Validate PKCE code verifier.

        Code verifier must be:
        - 43-128 characters long
        - Only contain: [A-Z], [a-z], [0-9], "-", ".", "_", "~"
        """
        v = v.strip()
        if not v:
            raise ValueError("Code verifier cannot be empty")
        if len(v) < 43 or len(v) > 128:
            raise ValueError("Code verifier must be 43-128 characters")
        return v

    @field_validator("redirectUri")
    @classmethod
    def validate_redirect_uri(cls, v: str) -> str:
        """Validate redirect URI is not empty."""
        v = v.strip()
        if not v:
            raise ValueError("Redirect URI cannot be empty")
        return v


class RefreshTokenSchema(Schema):
    """
    Schema for refreshing access token.

    Example Request:
        POST /api/v1/auth/refresh
        {
            "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
        }
    """

    refresh_token: str


class ChangePasswordSchema(Schema):
    """
    Schema for changing password (when logged in).

    Example Request:
        POST /api/v1/auth/password/change
        {
            "old_password": "OldPass123!",
            "new_password": "NewPass456!"
        }
    """

    old_password: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def validate_new_password_strength(cls, v: str) -> str:
        """Validate new password meets security requirements."""
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")

        if not re.search(r"[A-Z]", v):
            raise ValueError("Password must contain at least one uppercase letter")

        if not re.search(r"[a-z]", v):
            raise ValueError("Password must contain at least one lowercase letter")

        if not re.search(r"\d", v):
            raise ValueError("Password must contain at least one number")

        return v


class LogoutSchema(Schema):
    """
    Schema for logout request.

    The refresh_token is blacklisted on logout to prevent reuse.

    Example Request:
        POST /api/v1/auth/logout
        {
            "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
        }
    """

    refresh_token: str


# =============================================================================
# RESPONSE SCHEMAS - What we send to clients
# =============================================================================


class TokenResponseSchema(Schema):
    """
    Schema for authentication token response.

    Returned after successful login or registration.

    Example Response:
        {
            "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
            "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
            "token_type": "Bearer",
            "expires_in": 43200
        }

    How to use the tokens:
    1. Store access_token and refresh_token on client
    2. Include access_token in Authorization header:
       Authorization: Bearer <access_token>
    3. When access_token expires, use refresh_token to get new one
    4. On logout, send refresh_token to be blacklisted
    """

    access_token: str
    refresh_token: str
    token_type: str = "Bearer"
    expires_in: int  # Seconds until access_token expires

    class Config:
        # Pydantic v2 configuration
        # json_schema_extra adds examples to OpenAPI docs
        json_schema_extra = {
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "Bearer",
                "expires_in": 43200,
            }
        }


class UserResponseSchema(Schema):
    """
    Schema for user information in responses.

    Used when returning user data (e.g., GET /api/v1/auth/me).

    Note: NEVER include sensitive fields like password_hash!

    Example Response:
        {
            "user_id": 1,
            "email": "john@example.com",
            "user_display_name": "John Doe",
            "user_login": "john@example.com",
            "user_role": "manager",
            "city": "Mumbai",
            "state": "Maharashtra",
            "center": "HQ",
            "auth_methods": ["password", "google_oauth"],
            "user_created_datetime": "2024-01-15T10:30:00Z"
        }
    """

    user_id: int
    email: str
    user_display_name: str
    user_login: str
    user_role: str
    contact: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    center: Optional[str] = None
    auth_methods: list[str] = []
    user_created_datetime: datetime


class AuthResponseSchema(Schema):
    """
    Combined response for login/register with user info and tokens.

    Example Response:
        {
            "user": {
                "user_id": 1,
                "email": "john@example.com",
                ...
            },
            "tokens": {
                "access_token": "...",
                "refresh_token": "...",
                ...
            }
        }
    """

    user: UserResponseSchema
    tokens: TokenResponseSchema


class MessageResponseSchema(Schema):
    """
    Schema for simple message responses.

    Used for operations that don't return data, like logout.

    Example Response:
        {
            "message": "Successfully logged out",
            "success": true
        }
    """

    message: str
    success: bool = True


class ErrorResponseSchema(Schema):
    """
    Schema for error responses.

    Example Response:
        {
            "detail": "Invalid credentials",
            "error_code": "INVALID_CREDENTIALS"
        }
    """

    detail: str
    error_code: Optional[str] = None


# =============================================================================
# HELPER FUNCTION FOR CREATING USER RESPONSE
# =============================================================================


# =============================================================================
# F01a SCHEMAS — used by /api/auth/* endpoints
# =============================================================================


class GoogleCallbackSchema(Schema):
    """Request body for POST /api/auth/google/callback."""

    code: str
    code_verifier: str
    redirect_uri: str

    @field_validator("code", "code_verifier", "redirect_uri")
    @classmethod
    def not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Field cannot be blank")
        return v


class UserProfileSchema(Schema):
    """User sub-object returned in LoginResponseSchema and GET /api/auth/me."""

    id: int
    user_login: str
    display_name: str
    allowed_roles: list[str]
    is_admin: bool


class LoginResponseSchema(Schema):
    """Response for POST /api/auth/google/callback."""

    access_token: str
    refresh_token: str
    user: UserProfileSchema


class RefreshSchema(Schema):
    """Request body for POST /api/auth/refresh."""

    refresh_token: str


class RefreshResponseSchema(Schema):
    """Response for POST /api/auth/refresh."""

    access_token: str


# =============================================================================
# END F01a SCHEMAS
# =============================================================================


def user_to_response(user) -> UserResponseSchema:
    """
    Convert a User model instance to UserResponseSchema.

    This helper ensures consistent serialization of User objects.

    Args:
        user: User model instance

    Returns:
        UserResponseSchema: Serialized user data

    Example:
        >>> from sessionops.models import User
        >>> user = User.objects.get(email='john@example.com')
        >>> response = user_to_response(user)
    """
    return UserResponseSchema(
        user_id=user.user_id,
        email=user.email,
        user_display_name=user.user_display_name,
        user_login=user.user_login,
        user_role=user.user_role,
        contact=user.contact,
        city=user.city,
        state=user.state,
        center=user.center,
        auth_methods=user.get_auth_methods(),
        user_created_datetime=user.user_created_datetime,
    )
