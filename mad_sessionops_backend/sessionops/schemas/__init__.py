"""
Schemas package for sessionops.

=============================================================================
PYDANTIC SCHEMAS OVERVIEW
=============================================================================

This package contains Pydantic schemas for request/response validation.

Structure:
    schemas/
    ├── __init__.py      <- You are here (exports all schemas)
    ├── auth.py          <- Authentication schemas (login, register, tokens)
    └── user.py          <- User CRUD schemas

Usage:
    from sessionops.schemas import LoginSchema, UserResponseSchema

=============================================================================
"""

# Auth schemas
from sessionops.schemas.auth import (
    AuthResponseSchema,
    ChangePasswordSchema,
    ErrorResponseSchema,
    GoogleAuthSchema,
    LoginSchema,
    LogoutSchema,
    MessageResponseSchema,
    RefreshTokenSchema,
    RegisterSchema,
    TokenResponseSchema,
    UserResponseSchema,
    user_to_response,
)

# User schemas
from sessionops.schemas.user import (
    UserDetailResponseSchema,
    UserListItemSchema,
    UserListResponseSchema,
    UserUpdateSchema,
    user_to_detail,
    user_to_list_item,
)

__all__ = [
    # Auth schemas
    "RegisterSchema",
    "LoginSchema",
    "GoogleAuthSchema",
    "RefreshTokenSchema",
    "ChangePasswordSchema",
    "LogoutSchema",
    "TokenResponseSchema",
    "UserResponseSchema",
    "AuthResponseSchema",
    "MessageResponseSchema",
    "ErrorResponseSchema",
    "user_to_response",
    # User schemas
    "UserUpdateSchema",
    "UserListItemSchema",
    "UserListResponseSchema",
    "UserDetailResponseSchema",
    "user_to_list_item",
    "user_to_detail",
]
