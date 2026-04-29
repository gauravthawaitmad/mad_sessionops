"""
Services package for sessionops.

=============================================================================
SERVICE LAYER PATTERN
=============================================================================

The service layer sits between the API routes (views) and models.

WHY USE A SERVICE LAYER?
========================

1. SEPARATION OF CONCERNS
   - Routes handle HTTP (request/response)
   - Services handle BUSINESS LOGIC
   - Models handle DATA STORAGE

2. REUSABILITY
   - Same business logic can be used by:
     - API routes
     - Management commands
     - Background tasks (Celery)
     - Other services

3. TESTABILITY
   - Services can be unit tested without HTTP
   - Mock dependencies easily
   - Test business logic in isolation

4. TRANSACTION MANAGEMENT
   - Services can wrap multiple model operations
   - Ensure atomicity (all or nothing)

WITHOUT SERVICE LAYER (anti-pattern):
=====================================

    # views.py - Business logic in route handler (BAD)
    @api.post("/register")
    def register(request, data: RegisterSchema):
        # Validation...
        user = User.objects.create(...)
        auth = UserAuth.objects.create(...)
        # Send email...
        tokens = generate_tokens(user)
        return {"user": user, "tokens": tokens}

Problem: Route handler does too much, hard to test/reuse.

WITH SERVICE LAYER (recommended):
=================================

    # services/auth_service.py
    class AuthService:
        @staticmethod
        def register_user(data):
            # All business logic here
            ...

    # views.py - Route handler stays thin
    @api.post("/register")
    def register(request, data: RegisterSchema):
        result = AuthService.register_user(data)
        return result

=============================================================================
"""

from sessionops.services.auth_service import AuthService
from sessionops.services.google_oauth_service import GoogleOAuthService

__all__ = [
    "AuthService",
    "GoogleOAuthService",
]
