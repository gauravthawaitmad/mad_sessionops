"""
Authentication Service - Core authentication business logic.

=============================================================================
AUTHENTICATION FLOW OVERVIEW
=============================================================================

PASSWORD REGISTRATION:
    1. Validate input (email unique, password strong)
    2. Create User record
    3. Create UserAuth(type=password) with hashed password
    4. Generate JWT tokens
    5. Return user + tokens

PASSWORD LOGIN:
    1. Find UserAuth by email + type=password
    2. Verify password hash
    3. Update last_used_at
    4. Generate JWT tokens
    5. Return user + tokens

GOOGLE OAUTH LOGIN:
    1. Verify Google ID token
    2. Find existing UserAuth by google_sub OR
    3. Find existing User by email and link Google OR
    4. Create new User + UserAuth(type=google_oauth)
    5. Generate JWT tokens
    6. Return user + tokens

TOKEN REFRESH:
    1. Validate refresh token
    2. Generate new access token
    3. Optionally rotate refresh token
    4. Return new tokens

LOGOUT:
    1. Blacklist refresh token
    2. Token can no longer be used

=============================================================================
"""

import os
from datetime import timedelta
from typing import Optional

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.tokens import RefreshToken

from sessionops.models import PasswordResetToken, User, UserAuth
from sessionops.schemas import (
    AuthResponseSchema,
    ChangePasswordSchema,
    LoginSchema,
    RegisterSchema,
    ScopeWarningSchema,
    TokenResponseSchema,
    user_to_response,
)
from sessionops.services.auth.role_helpers import get_allowed_roles
from sessionops.services.email_service import send_password_reset_email
from sessionops.services.google_oauth_service import GoogleOAuthService
from sessionops.utils.custom_logger import get_logger

logger = get_logger(__name__)


class AuthenticationError(Exception):
    """
    Custom exception for authentication errors.

    Attributes:
        message: Human-readable error message
        error_code: Machine-readable error code for frontend
    """

    def __init__(self, message: str, error_code: str = "AUTH_ERROR"):
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


class AuthService:
    """
    Service class for authentication operations.

    All methods are static because:
    - No instance state needed
    - Easier to call: AuthService.login(...) vs AuthService().login(...)
    - Can still be mocked for testing

    For stateful operations (e.g., caching), use class methods with cls.
    """

    # =========================================================================
    # PASSWORD REGISTRATION
    # =========================================================================

    @staticmethod
    @transaction.atomic
    def register_with_password(data: RegisterSchema) -> AuthResponseSchema:
        """
        Register a new user with email and password.

        This method creates both a User record and a UserAuth record
        in a single database transaction.

        Args:
            data: Validated registration data (email, password, display_name)

        Returns:
            AuthResponseSchema: User info and JWT tokens

        Raises:
            AuthenticationError: If email already exists

        Example:
            >>> from sessionops.schemas import RegisterSchema
            >>> data = RegisterSchema(
            ...     email="john@example.com",
            ...     password="SecurePass123!",
            ...     confirm_password="SecurePass123!",
            ...     user_display_name="John Doe"
            ... )
            >>> result = AuthService.register_with_password(data)
            >>> print(result.tokens.access_token)

        Transaction Explanation:
        ========================
        @transaction.atomic ensures that BOTH User and UserAuth are
        created together. If either fails, both are rolled back.

        Without atomic:
        - User created successfully
        - UserAuth fails (e.g., constraint violation)
        - User exists without auth = broken state!

        With atomic:
        - User created
        - UserAuth fails
        - User creation rolled back
        - Database is consistent
        """
        email = data.email.lower()

        # Check if email already exists
        if User.objects.filter(email=email).exists():
            raise AuthenticationError(
                "An account with this email already exists",
                error_code="EMAIL_EXISTS",
            )

        # Check if auth identifier already used (for password type)
        if UserAuth.objects.filter(
            auth_type=UserAuth.AUTH_TYPE_PASSWORD,
            auth_identifier=email,
        ).exists():
            raise AuthenticationError(
                "An account with this email already exists",
                error_code="EMAIL_EXISTS",
            )

        logger.info(f"Registering new user: {email}")

        # Create User record
        # Using email as user_login since we're doing email-based auth
        # user_role defaults to 'user' - can be changed by admin later
        user = User.objects.create(
            email=email,
            user_login=email,  # Using email as login identifier
            user_display_name=data.user_display_name,
            user_role="user",  # Default role for self-registered users
        )

        # Create password auth record
        UserAuth.create_password_auth(
            user=user,
            email=email,
            password=data.password,
        )

        logger.info(f"User registered successfully: {user.user_id}")

        # Generate JWT tokens
        tokens = AuthService._generate_tokens(user)

        return AuthService._build_auth_response(user, tokens)

    # =========================================================================
    # PASSWORD LOGIN
    # =========================================================================

    @staticmethod
    def login_with_password(data: LoginSchema) -> AuthResponseSchema:
        """
        Authenticate user with email and password.

        Args:
            data: Validated login data (email, password)

        Returns:
            AuthResponseSchema: User info and JWT tokens

        Raises:
            AuthenticationError: If credentials are invalid

        Example:
            >>> from sessionops.schemas import LoginSchema
            >>> data = LoginSchema(email="john@example.com", password="SecurePass123!")
            >>> result = AuthService.login_with_password(data)
            >>> print(result.user.email)  # john@example.com

        Security Notes:
        ===============
        1. We don't reveal whether email exists or password is wrong
           - Both return "Invalid credentials"
           - Prevents email enumeration attacks

        2. Password check uses constant-time comparison
           - Django's check_password() handles this
           - Prevents timing attacks
        """
        email = data.email.lower()

        # Find password auth record for this email
        auth = UserAuth.find_by_password_login(email)

        if not auth:
            logger.warning(f"Login attempt for non-existent email: {email}")
            raise AuthenticationError("Invalid credentials", error_code="INVALID_CREDENTIALS")

        if not auth.user.is_active:
            logger.warning(f"Login attempt for inactive user: {email}")
            raise AuthenticationError("Invalid credentials", error_code="INVALID_CREDENTIALS")

        # Check password
        if not auth.check_password(data.password):
            logger.warning(f"Invalid password attempt for: {email}")
            raise AuthenticationError(
                "Invalid credentials",
                error_code="INVALID_CREDENTIALS",
            )

        user = auth.user

        # Role gate — same check as JWT middleware. Users whose role was removed
        # since the UserAuth was created must not be able to log in.
        if not get_allowed_roles(user.user_role):
            logger.warning(f"Login denied — no allowed role for user_id={user.user_id}")
            raise AuthenticationError("Invalid credentials", error_code="INVALID_CREDENTIALS")

        # Update last used timestamp
        auth.update_last_used()

        logger.info(f"User logged in: {user.user_id}")

        # Generate JWT tokens
        tokens = AuthService._generate_tokens(user)

        return AuthService._build_auth_response(user, tokens)

    # =========================================================================
    # GOOGLE OAUTH LOGIN
    # =========================================================================

    @staticmethod
    @transaction.atomic
    def login_with_google(
        *, code: str, code_verifier: str, redirect_uri: str
    ) -> AuthResponseSchema:
        """
        Authenticate or register user with Google OAuth.

        This method handles three scenarios:
        1. Existing user with Google linked -> Login
        2. Existing user without Google linked -> Link Google and login
        3. New user -> Create user with Google auth

        Args:
            code: Google authorization code from frontend
            code_verifier: PKCE code verifier
            redirect_uri: Redirect URI used during OAuth flow

        Returns:
            AuthResponseSchema: User info and JWT tokens

        Raises:
            AuthenticationError: If Google token is invalid

        Example:
            >>> result = AuthService.login_with_google("eyJhbGciOiJSUzI1NiIsInR5cCI...")
            >>> print(result.user.email)  # Email from Google

        Google OAuth Flow:
        ==================
        1. Frontend shows Google Sign-In button
        2. User clicks and authenticates with Google
        3. Google returns id_token to frontend
        4. Frontend sends id_token to this endpoint
        5. We verify token with Google
        6. Extract user info (email, name, google_sub)
        7. Find or create user
        8. Return JWT tokens
        """

        # Exchange code for tokens and get ID token
        token_data = GoogleOAuthService.exchange_code_for_tokens(
            code=code,
            code_verifier=code_verifier,
            redirect_uri=redirect_uri,
        )

        id_token_str = token_data.get("id_token") if token_data else None

        if not id_token_str:
            raise AuthenticationError(
                "Google did not return id_token",
                error_code="GOOGLE_ID_TOKEN_MISSING",
            )

        # Verify Google token
        google_data = GoogleOAuthService.verify_id_token(id_token_str)
        if not google_data:
            raise AuthenticationError(
                "Invalid Google token",
                error_code="INVALID_GOOGLE_TOKEN",
            )

        google_sub = google_data["sub"]
        email = google_data["email"].lower()
        email_verified = google_data.get("email_verified", False)
        name = google_data.get("name", email.split("@")[0])

        logger.info(f"Google auth for: {email}")

        # Scenario 1: Find existing Google auth by google_sub
        existing_auth = UserAuth.find_by_google_sub(google_sub)
        if existing_auth:
            existing_auth.update_last_used()
            user = existing_auth.user
            logger.info(f"Existing Google user logged in: {user.user_id}")
            tokens = AuthService._generate_tokens(user)
            return AuthService._build_auth_response(user, tokens)

        # Scenario 2: Find existing user by email (maybe has password auth)
        try:
            user = User.objects.get(email=email)
            logger.info(f"Scenario 2 - Linking Google to existing user: {user.user_id}")
            UserAuth.create_google_auth(
                user=user,
                email=email,
                google_sub=google_sub,
                email_verified=email_verified,
            )
            logger.info(f"Google linked to existing user: {user.user_id}")
            tokens = AuthService._generate_tokens(user)
            return AuthService._build_auth_response(user, tokens)
        except User.DoesNotExist:
            logger.info(f"User with email {email} does not exist, creating new user")

        # Scenario 3: Create new user with Google auth
        user = User.objects.create(
            email=email,
            user_login=email,
            user_display_name=name,
            user_role="user",
        )

        UserAuth.create_google_auth(
            user=user,
            email=email,
            google_sub=google_sub,
            email_verified=email_verified,
        )

        logger.info(f"New user created via Google: {user.user_id}")

        tokens = AuthService._generate_tokens(user)
        return AuthService._build_auth_response(user, tokens)

    # =========================================================================
    # LINK GOOGLE TO EXISTING ACCOUNT
    # =========================================================================

    @staticmethod
    @transaction.atomic
    def link_google_account(
        user: User,
        code: str,
        code_verifier: str,
        redirect_uri: str,
    ) -> UserAuth:
        """
        Link Google OAuth to an existing user account using PKCE Authorization Code Flow.

        Used when a user with password auth wants to add Google login.

        Args:
            user: The authenticated user
            code: Google authorization code from frontend
            code_verifier: PKCE code verifier
            redirect_uri: Redirect URI used during OAuth flow

        Returns:
            UserAuth: The created Google auth record

        Raises:
            AuthenticationError: If Google token invalid or already linked
        """
        # Check if user already has Google linked
        if user.has_google_auth():
            raise AuthenticationError(
                "Google account already linked",
                error_code="GOOGLE_ALREADY_LINKED",
            )

        # Exchange authorization code for tokens
        token_data = GoogleOAuthService.exchange_code_for_tokens(
            code=code,
            code_verifier=code_verifier,
            redirect_uri=redirect_uri,
        )

        id_token_str = token_data.get("id_token") if token_data else None
        if not id_token_str:
            raise AuthenticationError(
                "Google did not return id_token",
                error_code="INVALID_GOOGLE_TOKEN",
            )

        # Verify Google token
        google_data = GoogleOAuthService.verify_id_token(id_token_str)
        if not google_data:
            raise AuthenticationError(
                "Invalid Google token",
                error_code="INVALID_GOOGLE_TOKEN",
            )

        google_sub = google_data["sub"]
        google_email = google_data["email"].lower()
        email_verified = google_data.get("email_verified", False)

        # Check if this Google account is already linked to another user
        existing = UserAuth.find_by_google_sub(google_sub)
        if existing:
            raise AuthenticationError(
                "This Google account is already linked to another user",
                error_code="GOOGLE_ALREADY_USED",
            )

        # Create Google auth record
        auth = UserAuth.create_google_auth(
            user=user,
            email=google_email,
            google_sub=google_sub,
            email_verified=email_verified,
        )

        logger.info(f"Google linked to user: {user.user_id}")

        return auth

    # =========================================================================
    # TOKEN OPERATIONS
    # =========================================================================

    @staticmethod
    def refresh_tokens(refresh_token: str) -> TokenResponseSchema:
        """
        Generate new access token using refresh token.

        SimpleJWT handles token rotation if configured:
        - ROTATE_REFRESH_TOKENS: True -> New refresh token on each use
        - BLACKLIST_AFTER_ROTATION: True -> Old refresh token blacklisted

        Args:
            refresh_token: Valid refresh token

        Returns:
            TokenResponseSchema: New access (and possibly refresh) token

        Raises:
            AuthenticationError: If refresh token is invalid/expired/blacklisted

        Token Lifecycle:
        ================
        Access Token: Short-lived (default 12 hours in this project)
        - Used for API requests
        - Stored in memory or short-lived storage
        - Stateless verification (no DB lookup)

        Refresh Token: Long-lived (default 30 days in this project)
        - Used only to get new access tokens
        - Should be stored securely (httponly cookie)
        - Can be blacklisted on logout
        """
        try:
            # Parse and validate refresh token
            token = RefreshToken(refresh_token)  # type: ignore[arg-type]  # simplejwt's stub mistypes the raw-JWT-string constructor arg

            # Get access token expiry from settings
            access_lifetime = getattr(settings, "SIMPLE_JWT", {}).get(
                "ACCESS_TOKEN_LIFETIME", timedelta(hours=12)
            )

            return TokenResponseSchema(
                access_token=str(token.access_token),
                refresh_token=str(token),  # May be rotated
                token_type="Bearer",  # nosec B106 — OAuth token_type constant, not a password
                expires_in=int(access_lifetime.total_seconds()),
            )

        except TokenError as e:
            logger.warning(f"Token refresh failed: {str(e)}")
            raise AuthenticationError(
                "Invalid or expired refresh token",
                error_code="INVALID_REFRESH_TOKEN",
            )

    @staticmethod
    def logout(refresh_token: str) -> bool:
        """
        Logout user by blacklisting their refresh token.

        Once blacklisted, the refresh token cannot be used to get
        new access tokens. The access token remains valid until
        it expires (this is a limitation of JWTs).

        Args:
            refresh_token: The refresh token to blacklist

        Returns:
            bool: True if successfully blacklisted

        Raises:
            AuthenticationError: If token is invalid

        Security Note:
        ==============
        Access tokens cannot be invalidated without a blacklist check
        on every request (which defeats the purpose of JWTs).

        Options for immediate access revocation:
        1. Short access token lifetime (e.g., 15 minutes)
        2. Maintain an access token blacklist (defeats JWT benefits)
        3. Accept that access token is valid until expiry

        This project uses option 1 by default (12 hours) but you
        can adjust in settings.py SIMPLE_JWT.ACCESS_TOKEN_LIFETIME
        """
        try:
            token = RefreshToken(refresh_token)  # type: ignore[arg-type]  # simplejwt's stub mistypes the raw-JWT-string constructor arg
            # Add to blacklist
            token.blacklist()
            logger.info("User logged out, token blacklisted")
            return True

        except TokenError as e:
            logger.warning(f"Logout failed: {str(e)}")
            raise AuthenticationError(
                "Invalid refresh token",
                error_code="INVALID_REFRESH_TOKEN",
            )

    # =========================================================================
    # PASSWORD CHANGE
    # =========================================================================

    @staticmethod
    def change_password(user: User, data: ChangePasswordSchema) -> bool:
        """
        Change password for authenticated user.

        Args:
            user: The authenticated user
            data: Old and new password

        Returns:
            bool: True if password changed successfully

        Raises:
            AuthenticationError: If old password wrong or no password auth

        Example:
            >>> data = ChangePasswordSchema(
            ...     old_password="OldPass123!",
            ...     new_password="NewPass456!"
            ... )
            >>> AuthService.change_password(request.user, data)
        """
        # Find password auth for user (default manager filters is_active=True)
        try:
            auth = UserAuth.objects.get(
                user=user,
                auth_type=UserAuth.AUTH_TYPE_PASSWORD,
            )
        except UserAuth.DoesNotExist:
            raise AuthenticationError(
                "Password authentication not set up for this account",
                error_code="NO_PASSWORD_AUTH",
            )

        # Verify old password
        if not auth.check_password(data.old_password):
            raise AuthenticationError(
                "Current password is incorrect",
                error_code="WRONG_PASSWORD",
            )

        # Set new password
        auth.set_password(data.new_password)
        auth.save()

        logger.info(f"Password changed for user: {user.user_id}")

        return True

    # =========================================================================
    # FORGOT PASSWORD
    # =========================================================================

    @staticmethod
    def request_password_reset(email: str) -> None:
        """
        Initiate the forgot-password flow.

        Looks up the user by email. If found, creates a PasswordResetToken and
        sends a Brevo email with the reset link. If the email does not exist,
        returns silently (prevents email enumeration).

        Args:
            email: The user's email address (case-insensitive).
        """
        email = email.lower()
        try:
            user = User.objects.get(email=email, is_active=True)
        except User.DoesNotExist:
            logger.info(f"Password reset requested for unknown email: {email}")
            return

        # Role gate — users without login access cannot reset their password.
        if not get_allowed_roles(user.user_role):
            logger.warning(f"Password reset denied — no allowed role for user_id={user.user_id}")
            return

        # Supersede all previous unused tokens so only the newest link works.
        # Each voided token is stamped with invalidation_reason='superseded'
        # so we can distinguish "system voided" from "user consumed" in audits.
        for token_obj in PasswordResetToken.objects.filter(user=user, used_at__isnull=True):
            token_obj.supersede()

        token_obj = PasswordResetToken.objects.create(user=user)

        frontend_url = os.environ.get("FRONTEND_URL", "http://localhost:3000")
        reset_url = f"{frontend_url}/reset-password?token={token_obj.token}"

        send_password_reset_email(
            to_email=user.email,
            to_name=user.user_display_name,
            reset_url=reset_url,
        )
        logger.info(f"Password reset email dispatched for user_id={user.user_id}")

    # =========================================================================
    # VALIDATE RESET TOKEN (lightweight check — no state change)
    # =========================================================================

    @staticmethod
    def validate_reset_token(token: str) -> dict:
        """
        Return {'valid': bool, 'reason': str} — no side effects, safe to call on page load.

        reason values:
          'valid'        — token is usable right now
          'consumed'     — user already used this link
          'superseded'   — system voided it; a newer link was requested
          'time_expired' — 30-minute window passed without use
          'not_found'    — token UUID does not exist
        """
        import uuid as _uuid

        try:
            token_obj = PasswordResetToken.objects.get(token=_uuid.UUID(str(token)))
            s = token_obj.status
            return {"valid": s == "valid", "reason": s}
        except (PasswordResetToken.DoesNotExist, ValueError):
            return {"valid": False, "reason": "not_found"}

    # =========================================================================
    # RESET PASSWORD (with token from email)
    # =========================================================================

    @staticmethod
    @transaction.atomic
    def reset_password(token: str, new_password: str) -> None:
        """
        Consume a PasswordResetToken and set a new password.

        Args:
            token: UUID string from the reset link.
            new_password: Plain-text new password (already validated by schema).

        Raises:
            AuthenticationError: If token is invalid, expired, or already used.
        """
        try:
            import uuid as _uuid

            token_obj = PasswordResetToken.objects.select_related("user").get(
                token=_uuid.UUID(str(token))
            )
        except (PasswordResetToken.DoesNotExist, ValueError):
            raise AuthenticationError(
                "Invalid or expired reset link",
                error_code="INVALID_RESET_TOKEN",
            )

        if not token_obj.is_valid:
            raise AuthenticationError(
                "This reset link has expired or already been used",
                error_code="INVALID_RESET_TOKEN",
            )

        user = token_obj.user

        # Role gate — defence in depth: reject even if a token exists for a
        # user whose role was removed after the reset was requested.
        if not get_allowed_roles(user.user_role):
            logger.warning(f"Password reset rejected — no allowed role for user_id={user.user_id}")
            raise AuthenticationError(
                "This reset link has expired or already been used",
                error_code="INVALID_RESET_TOKEN",
            )

        # Upsert password auth record
        try:
            auth = UserAuth.objects.get(
                user=user,
                auth_type=UserAuth.AUTH_TYPE_PASSWORD,
                is_active=True,
            )
            auth.set_password(new_password)
            auth.save()
        except UserAuth.DoesNotExist:
            UserAuth.create_password_auth(
                user=user,
                email=user.email,
                password=new_password,
            )

        token_obj.consume()
        logger.info(f"Password reset completed for user_id={user.user_id}")

    # =========================================================================
    # SET PASSWORD (first-time, for Hasura-synced users)
    # =========================================================================

    @staticmethod
    @transaction.atomic
    def set_password_first_time(user: User, new_password: str) -> None:
        """
        Set a password for a user who was synced from Hasura and has never had one.

        Raises:
            AuthenticationError: If the user already has a password auth set up.
        """
        if UserAuth.objects.filter(
            user=user,
            auth_type=UserAuth.AUTH_TYPE_PASSWORD,
            is_active=True,
        ).exists():
            raise AuthenticationError(
                "Password is already set for this account. Use change-password instead.",
                error_code="PASSWORD_ALREADY_SET",
            )

        UserAuth.create_password_auth(
            user=user,
            email=user.email,
            password=new_password,
        )
        logger.info(f"First-time password set for user_id={user.user_id}")

    # =========================================================================
    # GET CURRENT USER
    # =========================================================================

    @staticmethod
    def get_current_user(user_id: int) -> Optional[User]:
        """
        Get user by ID with auth methods prefetched.

        Args:
            user_id: The user's ID

        Returns:
            User or None: The user if found

        Example:
            >>> user = AuthService.get_current_user(123)
            >>> if user:
            ...     print(user.get_auth_methods())
        """
        try:
            return User.objects.prefetch_related("auth_methods").get(user_id=user_id)
        except User.DoesNotExist:
            return None

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    @staticmethod
    def _build_auth_response(user: User, tokens: TokenResponseSchema) -> "AuthResponseSchema":
        """Build AuthResponseSchema, attaching scope_warning if user has no visible schools."""
        from sessionops.services.rbac.scope import schools_visible_to

        scope_warning = None
        if not schools_visible_to(user).exists():
            scope_warning = ScopeWarningSchema(
                code="no_worknode_mapping",
                message=(
                    "You are not assigned to any schools or partner. "
                    "Please contact your community organizer or admin."
                ),
            )
        return AuthResponseSchema(
            user=user_to_response(user),
            tokens=tokens,
            scope_warning=scope_warning,
        )

    @staticmethod
    def _generate_tokens(user: User) -> TokenResponseSchema:
        """
        Generate JWT tokens for a user.

        This method creates both access and refresh tokens using
        SimpleJWT. We create tokens manually (not using for_user())
        because our custom User model doesn't integrate with Django's
        built-in auth User model that SimpleJWT expects.

        Args:
            user: The user to generate tokens for

        Returns:
            TokenResponseSchema: Access and refresh tokens

        Token Contents:
        ===============
        Access Token (decoded payload):
        {
            "token_type": "access",
            "exp": 1705123456,        # Expiry timestamp
            "iat": 1705080256,        # Issued at
            "jti": "abc123...",       # Unique token ID
            "user_id": 123,           # Custom claim we add
            "email": "john@...",      # Custom claim we add
        }

        Refresh Token is similar but with token_type: "refresh"

        Why not use RefreshToken.for_user()?
        =====================================
        SimpleJWT's for_user() expects Django's built-in User model
        because it stores a reference in OutstandingToken table.
        Our custom User model (sessionops.models.User) is separate from
        Django's auth.User, so we create tokens manually.
        """
        logger.info(f"=== _generate_tokens START for user_id: {user.user_id} ===")

        # Create refresh token WITHOUT linking to Django's User model
        # This avoids the "must be a User instance" error
        refresh = RefreshToken()
        logger.info("RefreshToken created successfully")

        # Add user identifier to token payload
        # This is what identifies the user when the token is verified
        refresh["user_id"] = user.user_id
        refresh["email"] = user.email
        refresh["role"] = user.user_role
        logger.info(
            f"Added claims to refresh token: user_id={user.user_id}, email={user.email}, role={user.user_role}"
        )

        # Add same claims to access token
        refresh.access_token["user_id"] = user.user_id
        refresh.access_token["email"] = user.email
        refresh.access_token["role"] = user.user_role
        logger.info("Added claims to access token")

        # Get access token lifetime for expires_in
        access_lifetime = getattr(settings, "SIMPLE_JWT", {}).get(
            "ACCESS_TOKEN_LIFETIME", timedelta(hours=12)
        )

        access_token_str = str(refresh.access_token)
        refresh_token_str = str(refresh)

        logger.info(f"Access token generated: {access_token_str[:50]}...")
        logger.info(f"Refresh token generated: {refresh_token_str[:50]}...")
        logger.info(f"Token expires_in: {int(access_lifetime.total_seconds())} seconds")

        token_response = TokenResponseSchema(
            access_token=access_token_str,
            refresh_token=refresh_token_str,
            token_type="Bearer",  # nosec B106 — OAuth token_type constant, not a password
            expires_in=int(access_lifetime.total_seconds()),
        )

        logger.info("TokenResponseSchema created successfully")
        logger.info("=== _generate_tokens END ===")

        return token_response
