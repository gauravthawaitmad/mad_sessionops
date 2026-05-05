"""
PasswordResetToken — single-use tokens for the forgot-password flow.

One row per reset request. Tokens expire after EXPIRY_MINUTES and can only
be used once. Old rows are never hard-deleted — kept for audit.

invalidation_reason distinguishes HOW a token became invalid:
  consumed   — the user clicked the link and successfully set a password
  superseded — the user requested a new link before using this one;
               the system voided this token automatically
  (null)     — token is still active OR expired naturally (30-min window)
"""

import uuid
from datetime import timedelta

from django.db import models
from django.utils import timezone

EXPIRY_MINUTES = 30


class PasswordResetToken(models.Model):

    class InvalidationReason(models.TextChoices):
        CONSUMED = "consumed", "Used by user"
        SUPERSEDED = "superseded", "Voided — newer link was requested"

    user = models.ForeignKey(
        "sessionops.User",
        on_delete=models.CASCADE,
        related_name="password_reset_tokens",
        help_text="The user this reset token belongs to.",
    )

    token = models.UUIDField(
        default=uuid.uuid4,
        unique=True,
        db_index=True,
        help_text="Opaque token sent in the reset email link.",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(
        help_text="Token is invalid after this timestamp.",
    )
    used_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="Set when the token is closed (consumed by user or superseded by system).",
    )
    invalidation_reason = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        choices=InvalidationReason.choices,
        help_text=(
            "Why this token was closed. "
            "'consumed' = user used it; "
            "'superseded' = system voided it when a newer link was requested; "
            "null = still active or timed out naturally."
        ),
    )

    class Meta:
        db_table = "password_reset_tokens"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return (
            f"PasswordResetToken(user_id={self.user_id}, status={self.status})"
        )

    def save(self, *args, **kwargs):
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=EXPIRY_MINUTES)
        super().save(*args, **kwargs)

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def is_valid(self) -> bool:
        """True if the token is still usable right now."""
        return self.used_at is None and timezone.now() < self.expires_at

    @property
    def status(self) -> str:
        """
        Human-readable state of this token:

        'valid'        — token is usable right now
        'consumed'     — user clicked the link and set their password
        'superseded'   — system voided it; a newer link was requested
        'time_expired' — 30-minute window passed without use
        """
        if self.used_at is not None:
            return self.invalidation_reason or self.InvalidationReason.CONSUMED
        if timezone.now() >= self.expires_at:
            return "time_expired"
        return "valid"

    # ------------------------------------------------------------------
    # Mutations
    # ------------------------------------------------------------------

    def consume(self) -> None:
        """Mark token as used by the user. Call inside an atomic block."""
        self.used_at = timezone.now()
        self.invalidation_reason = self.InvalidationReason.CONSUMED
        self.save(update_fields=["used_at", "invalidation_reason"])

    def supersede(self) -> None:
        """Void this token because a newer link was requested."""
        self.used_at = timezone.now()
        self.invalidation_reason = self.InvalidationReason.SUPERSEDED
        self.save(update_fields=["used_at", "invalidation_reason"])
