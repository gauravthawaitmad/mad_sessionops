from django.db import models
from django.utils import timezone


class User(models.Model):
    """
    User identity model - populated via data pipeline.

    Stores identity and organizational information. Authentication credentials
    live in the related UserAuth model, allowing multiple login methods per user.

    This model implements the same soft-delete pattern as SoftDeleteBaseModel
    directly (cannot inherit because deleted_by is a self-referential FK).
    """

    # =========================================================================
    # PRIMARY KEY
    # =========================================================================

    user_id = models.BigAutoField(
        primary_key=True,
        verbose_name="User ID",
        help_text="Unique identifier for the user (auto-generated).",
    )

    # =========================================================================
    # IDENTITY FIELDS
    # =========================================================================

    user_display_name = models.CharField(
        max_length=255,
        verbose_name="Display Name",
        help_text="The name displayed in the UI (e.g., 'John Doe').",
    )

    user_login = models.CharField(
        max_length=255,
        unique=True,
        db_index=True,
        verbose_name="Login Username",
        help_text="Unique identifier for login (often the email address).",
    )

    email = models.EmailField(
        max_length=255,
        db_index=True,
        verbose_name="Email Address",
        help_text="User's email address. Not enforced unique — Hasura source data contains duplicates.",
    )

    contact = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        verbose_name="Contact Number",
        help_text="Phone number or other contact information.",
    )

    is_active = models.BooleanField(
        default=True,
        help_text="If False, user cannot authenticate. Distinct from soft-delete.",
    )

    # =========================================================================
    # ROLE & HIERARCHY FIELDS
    # =========================================================================

    user_role = models.TextField(
        blank=True,
        default="",
        verbose_name="User Role",
        help_text=(
            "Comma-separated role string synced from Hasura. "
            "Example: 'CO Part Time,Wingman'. Parsed at runtime to determine permissions."
        ),
    )

    reporting_manager_user_login = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="Reporting Manager Login",
        help_text="Login identifier of the user's reporting manager.",
    )

    reporting_manager_role_code = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name="Reporting Manager Role",
        help_text="Role code of the reporting manager.",
    )

    reporting_manager_user_id = models.BigIntegerField(
        null=True,
        blank=True,
        verbose_name="Reporting Manager ID",
        help_text="User ID of the reporting manager.",
    )

    added_by = models.CharField(
        max_length=255,
        null=True,
        blank=True,
        verbose_name="Added By",
        help_text="Who added this user to the system.",
    )

    # =========================================================================
    # LOCATION FIELDS
    # =========================================================================

    city = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="City",
        help_text="City where the user is located.",
    )

    state = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="State",
        help_text="State or province where the user is located.",
    )

    center = models.CharField(
        max_length=100,
        null=True,
        blank=True,
        verbose_name="Center",
        help_text="Office center or branch location.",
    )

    # =========================================================================
    # TIMESTAMP FIELDS
    # =========================================================================

    user_created_datetime = models.DateTimeField(
        auto_now_add=True,
        verbose_name="Created At",
        help_text="When this user record was created.",
    )

    user_updated_datetime = models.DateTimeField(
        auto_now=True,
        verbose_name="Updated At",
        help_text="When this user record was last modified.",
    )

    last_login_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Last Login At",
        help_text="Updated on each successful authentication.",
    )

    synced_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Synced At",
        help_text="When this row was last refreshed from Hasura.",
    )

    # =========================================================================
    # SOFT-DELETE FIELDS  (implements SoftDeleteBaseModel pattern directly;
    #                       User can't inherit because deleted_by is self-ref)
    # =========================================================================

    deleted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name="Deleted At",
        help_text="When this user record was soft-deleted.",
    )

    deleted_by = models.ForeignKey(
        "self",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
        verbose_name="Deleted By",
        help_text="The user who performed the soft-delete operation.",
    )

    # =========================================================================
    # META OPTIONS
    # =========================================================================

    class Meta:
        db_table = "users"
        verbose_name = "User"
        verbose_name_plural = "Users"
        ordering = ["-user_created_datetime"]
        indexes = [
            models.Index(fields=["email"], name="idx_user_email"),
            models.Index(fields=["user_login"], name="idx_user_login"),
            models.Index(fields=["user_role"], name="idx_user_role"),
            models.Index(fields=["state", "city"], name="idx_user_location"),
        ]

    # =========================================================================
    # STRING REPRESENTATION
    # =========================================================================

    def __str__(self) -> str:
        return f"{self.user_display_name} ({self.email})"

    # =========================================================================
    # PROPERTIES
    # =========================================================================

    @property
    def id(self) -> int:
        """Alias for user_id for compatibility with libraries expecting 'id'."""
        return self.user_id

    @property
    def full_name(self) -> str:
        return self.user_display_name

    @property
    def is_manager(self) -> bool:
        role_lower = self.user_role.lower() if self.user_role else ""
        return "manager" in role_lower or "admin" in role_lower

    # =========================================================================
    # SOFT-DELETE METHODS (mirrors SoftDeleteBaseModel.delete() exactly)
    # =========================================================================

    def delete(self, deleted_by=None, *args, **kwargs):
        self.is_active = False
        self.deleted_at = timezone.now()
        if deleted_by is not None:
            self.deleted_by = deleted_by
        self.save(update_fields=["is_active", "deleted_at", "deleted_by", "user_updated_datetime"])

    def hard_delete(self, *args, **kwargs):
        raise NotImplementedError(
            "Hard deletes are not allowed. Use delete() for soft-delete. "
            "If you genuinely need to purge data, do it via a one-off migration "
            "with explicit review."
        )

    # =========================================================================
    # HELPER METHODS
    # =========================================================================

    def get_reporting_manager(self) -> "User | None":
        if not self.reporting_manager_user_id:
            return None
        try:
            return User.objects.get(user_id=self.reporting_manager_user_id)
        except User.DoesNotExist:
            return None

    def get_direct_reports(self):
        return User.objects.filter(reporting_manager_user_id=self.user_id)

    def get_auth_methods(self) -> list[str]:
        """List of active auth types for this user (e.g. ['google', 'password'])."""
        return list(self.auth_methods.values_list("auth_type", flat=True))

    def has_password_auth(self) -> bool:
        return self.auth_methods.filter(auth_type="password").exists()

    def has_google_auth(self) -> bool:
        return self.auth_methods.filter(auth_type="google").exists()
