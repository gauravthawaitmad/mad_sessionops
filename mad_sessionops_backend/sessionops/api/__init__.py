"""
API package for sessionops.

Contains all API route handlers organized by domain:
- auth_api: Authentication endpoints (login, register, etc.)
- user_api: User management endpoints
"""

from sessionops.api.auth import auth_router
from sessionops.api.user_api import user_router

__all__ = [
    "auth_router",
    "user_router",
]
