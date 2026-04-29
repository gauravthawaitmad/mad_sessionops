"""
UserAuth — per-method authentication credentials.

One row per (user, auth_type). A user may have a 'google' row, a 'password'
row, or both. F01a creates only 'google' rows. F01b creates 'password' rows.

Design: D022 — Multi-method authentication (UserAuth as one-to-many).
Soft-delete: inherited from SoftDeleteBaseModel (is_active flag, never SQL DELETE).
"""

from django.contrib.auth.hashers import check_password, make_password
from django.db import models
from django.utils import timezone

from sessionops.models.base import SoftDeleteBaseModel


class UserAuth(SoftDeleteBaseModel):
    """
    Authentication credentials for a User. One row per auth method per user.

    auth_type discriminates which credential is stored:
      auth_type="google"   → auth_identifier = google_sub, password_hash = NULL
      auth_type="password" → auth_identifier = user_login.lower(), password_hash = argon2 hash

    Lookup pattern (uniform across both methods):
      UserAuth.objects.get(auth_type="google",   auth_identifier=google_sub)
      UserAuth.objects.get(auth_type="password", auth_identifier=user_login.lower())
    Default manager filters is_active=True, so active-only lookups need no extra filter.
    """

    AUTH_TYPE_GOOGLE = "google"
    AUTH_TYPE_PASSWORD = "password"

    AUTH_TYPE_CHOICES = [
        ("password", "Password"),
        ("google", "Google"),
    ]

    # ── Relationship to User ──────────────────────────────────────────────────

    user = models.ForeignKey(
        "sessionops.User",
        on_delete=models.PROTECT,
        related_name="auth_methods",
        verbose_name="User",
        help_text="The user this authentication method belongs to.",
    )

    # ── Discriminator ─────────────────────────────────────────────────────────

    auth_type = models.CharField(
        max_length=16,
        choices=AUTH_TYPE_CHOICES,
        verbose_name="Auth Type",
        help_text="Type of authentication: 'google' or 'password'.",
    )

    # ── Unified lookup field ───────────────────────────────────────────────────
    # google rows:   auth_identifier = google_sub from id_token
    # password rows: auth_identifier = user_login.lower()

    auth_identifier = models.CharField(
        max_length=255,
        verbose_name="Auth Identifier",
        help_text=(
            "Lookup key for this auth method. "
            "Google: google_sub from id_token. Password: lowercased user_login."
        ),
    )

    # ── Type-specific fields ───────────────────────────────────────────────────

    password_hash = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="Password Hash",
        help_text="Argon2id hash of the user's password. Populated only for auth_type='password'.",
    )

    google_email_verified = models.BooleanField(
        null=True,
        blank=True,
        verbose_name="Google Email Verified",
        help_text="Whether Google verified the email. Populated only for auth_type='google'.",
    )

    # ── Usage tracking ────────────────────────────────────────────────────────

    last_used_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Last Used At",
        help_text="When this auth method was last used to sign in.",
    )

    # Inherited from SoftDeleteBaseModel:
    #   is_active, created_at, updated_at, deleted_at, deleted_by

    # ── Meta ──────────────────────────────────────────────────────────────────

    class Meta:
        db_table = "user_auth"
        verbose_name = "User Auth"
        verbose_name_plural = "User Auth Methods"
        ordering = ["-created_at"]

        indexes = [
            models.Index(fields=["user", "auth_type"]),
        ]

        constraints = [
            # No two active rows share the same (auth_type, auth_identifier) pair.
            # Allows soft-deleted history (is_active=False rows are excluded).
            models.UniqueConstraint(
                fields=["auth_type", "auth_identifier"],
                condition=models.Q(is_active=True),
                name="uniq_active_auth_lookup",
            ),
            # At most one active method of each type per user.
            models.UniqueConstraint(
                fields=["user", "auth_type"],
                condition=models.Q(is_active=True),
                name="uniq_active_auth_per_user_per_type",
            ),
            # Field integrity: google rows have no password_hash; password rows have it.
            models.CheckConstraint(
                check=(
                    models.Q(auth_type="google", password_hash__isnull=True)
                    | models.Q(auth_type="password", password_hash__isnull=False)
                ),
                name="auth_type_field_integrity",
            ),
        ]

    # ── String representation ─────────────────────────────────────────────────

    def __str__(self) -> str:
        status = "" if self.is_active else " (inactive)"
        return f"{self.auth_type} auth for user_id={self.user_id}{status}"

    # ── Password methods (used by F01b) ───────────────────────────────────────

    def set_password(self, raw_password: str) -> None:
        """Hash and store a password. Only valid for auth_type='password'."""
        if self.auth_type != self.AUTH_TYPE_PASSWORD:
            raise ValueError("set_password() only valid for password auth type")
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password: str) -> bool:
        """Verify a password against the stored hash. Constant-time comparison."""
        if self.auth_type != self.AUTH_TYPE_PASSWORD:
            raise ValueError("check_password() only valid for password auth type")
        if not self.password_hash:
            return False
        return check_password(raw_password, self.password_hash)

    # ── Usage tracking ────────────────────────────────────────────────────────

    def update_last_used(self) -> None:
        """Record that this auth method was just used to sign in."""
        self.last_used_at = timezone.now()
        self.save(update_fields=["last_used_at", "updated_at"])

    # ── Lookup helpers ────────────────────────────────────────────────────────

    @classmethod
    def find_google_auth(cls, google_sub: str) -> "UserAuth | None":
        """Find the active Google auth record by Google subject ID."""
        try:
            return cls.objects.select_related("user").get(
                auth_type=cls.AUTH_TYPE_GOOGLE,
                auth_identifier=google_sub,
            )
        except cls.DoesNotExist:
            return None

    @classmethod
    def find_password_auth(cls, user_login: str) -> "UserAuth | None":
        """Find the active password auth record by user_login (lowercased)."""
        try:
            return cls.objects.select_related("user").get(
                auth_type=cls.AUTH_TYPE_PASSWORD,
                auth_identifier=user_login.lower(),
            )
        except cls.DoesNotExist:
            return None
