"""
User Schemas - Request and Response validation for User operations.

=============================================================================
SCHEMA ORGANIZATION
=============================================================================

This file contains schemas for User CRUD operations (separate from auth).

For authentication schemas (login, register, tokens), see auth.py

Schemas in this file:
- UserUpdateSchema: For updating user profile
- UserListResponseSchema: For paginated user listings
- UserDetailResponseSchema: For detailed user view

=============================================================================
"""

from datetime import datetime
from typing import Optional

from ninja import Schema
from pydantic import field_validator


class UserUpdateSchema(Schema):
    """
    Schema for updating user profile.

    All fields are optional - only provided fields will be updated.

    Example Request:
        PUT /api/v1/auth/me
        {
            "user_display_name": "John Smith",
            "contact": "+91-9876543210",
            "city": "Delhi"
        }
    """

    user_display_name: Optional[str] = None
    contact: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    center: Optional[str] = None

    @field_validator("user_display_name")
    @classmethod
    def validate_display_name(cls, v: Optional[str]) -> Optional[str]:
        """Validate and clean display name if provided."""
        if v is None:
            return v
        v = v.strip()
        if not v:
            raise ValueError("Display name cannot be empty")
        if len(v) > 255:
            raise ValueError("Display name must be 255 characters or less")
        return v

    @field_validator("contact")
    @classmethod
    def validate_contact(cls, v: Optional[str]) -> Optional[str]:
        """Validate contact number if provided."""
        if v is None:
            return v
        v = v.strip()
        if len(v) > 20:
            raise ValueError("Contact must be 20 characters or less")
        return v


class UserListItemSchema(Schema):
    """
    Schema for user in list views.

    Contains minimal information for list displays.
    """

    user_id: int
    email: str
    user_display_name: str
    user_role: str
    city: Optional[str] = None
    state: Optional[str] = None


class UserListResponseSchema(Schema):
    """
    Schema for paginated user list response.

    Example Response:
        {
            "items": [
                {"user_id": 1, "email": "john@example.com", ...},
                {"user_id": 2, "email": "jane@example.com", ...}
            ],
            "total": 100,
            "page": 1,
            "page_size": 20,
            "pages": 5
        }
    """

    items: list[UserListItemSchema]
    total: int
    page: int
    page_size: int
    pages: int


class UserDetailResponseSchema(Schema):
    """
    Schema for detailed user view.

    Includes all user fields plus computed properties.
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

    # Manager info
    reporting_manager_user_login: Optional[str] = None
    reporting_manager_role_code: Optional[str] = None
    reporting_manager_user_id: Optional[int] = None
    added_by: Optional[str] = None

    # Auth info
    auth_methods: list[str] = []
    has_password: bool = False
    has_google: bool = False

    # Timestamps
    user_created_datetime: datetime
    user_updated_datetime: datetime


# =============================================================================
# HELPER FUNCTIONS
# =============================================================================


def user_to_list_item(user) -> UserListItemSchema:
    """
    Convert User model to list item schema.

    Args:
        user: User model instance

    Returns:
        UserListItemSchema: Minimal user data for lists
    """
    return UserListItemSchema(
        user_id=user.user_id,
        email=user.email,
        user_display_name=user.user_display_name,
        user_role=user.user_role,
        city=user.city,
        state=user.state,
    )


def user_to_detail(user) -> UserDetailResponseSchema:
    """
    Convert User model to detailed schema.

    Args:
        user: User model instance

    Returns:
        UserDetailResponseSchema: Full user data
    """
    return UserDetailResponseSchema(
        user_id=user.user_id,
        email=user.email,
        user_display_name=user.user_display_name,
        user_login=user.user_login,
        user_role=user.user_role,
        contact=user.contact,
        city=user.city,
        state=user.state,
        center=user.center,
        reporting_manager_user_login=user.reporting_manager_user_login,
        reporting_manager_role_code=user.reporting_manager_role_code,
        reporting_manager_user_id=user.reporting_manager_user_id,
        added_by=user.added_by,
        auth_methods=user.get_auth_methods(),
        has_password=user.has_password_auth(),
        has_google=user.has_google_auth(),
        user_created_datetime=user.user_created_datetime,
        user_updated_datetime=user.user_updated_datetime,
    )
