from django.db import models


class SyncRun(models.Model):
    """
    Insert-only audit log for each Hasura sync run.

    Does NOT inherit SoftDeleteBaseModel — sync runs are never deactivated,
    only appended. The table is an immutable audit trail.
    """

    STATUS_RUNNING = "running"
    STATUS_SUCCESS = "success"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_RUNNING, "Running"),
        (STATUS_SUCCESS, "Success"),
        (STATUS_FAILED, "Failed"),
    ]

    # entity_sync_type: what entity set was synced in this run (legacy M1 field).
    # Renamed from sync_type in M4-4 to make room for run_type.
    ENTITY_SYNC_TYPE_USERS             = "users"
    ENTITY_SYNC_TYPE_PARTNERS          = "partners"
    ENTITY_SYNC_TYPE_PARTNER_WORKNODE  = "partner_worknode"
    ENTITY_SYNC_TYPE_ALL               = "all"

    ENTITY_SYNC_TYPE_CHOICES = [
        (ENTITY_SYNC_TYPE_USERS,            "Users"),
        (ENTITY_SYNC_TYPE_PARTNERS,         "Partners"),
        (ENTITY_SYNC_TYPE_PARTNER_WORKNODE, "Partner Worknode"),
        (ENTITY_SYNC_TYPE_ALL,              "All"),
    ]

    # run_type: how the sync was triggered (new M4 field, exposed as sync_type in API).
    RUN_TYPE_AUTO                = "auto"
    RUN_TYPE_MANUAL              = "manual"
    RUN_TYPE_MANUAL_SINGLE_USER  = "manual_single_user"

    RUN_TYPE_CHOICES = [
        (RUN_TYPE_AUTO,               "Automatic (cron)"),
        (RUN_TYPE_MANUAL,             "Manual trigger"),
        (RUN_TYPE_MANUAL_SINGLE_USER, "Single user sync"),
    ]

    # entity_type: granular per-entity tracking (new M4 field, null = all-in-one run).
    ENTITY_TYPE_USER              = "user"
    ENTITY_TYPE_PARTNER           = "partner"
    ENTITY_TYPE_PARTNER_WORKNODE  = "partner_worknode"

    ENTITY_TYPE_CHOICES = [
        (ENTITY_TYPE_USER,             "User data"),
        (ENTITY_TYPE_PARTNER,          "Partner data"),
        (ENTITY_TYPE_PARTNER_WORKNODE, "Partner Worknode"),
    ]

    id = models.BigAutoField(primary_key=True)
    started_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_RUNNING)

    # Legacy entity field (renamed from sync_type in migration 0019)
    entity_sync_type = models.CharField(
        max_length=20, choices=ENTITY_SYNC_TYPE_CHOICES, default=ENTITY_SYNC_TYPE_ALL,
    )

    # M4 fields
    run_type = models.CharField(
        max_length=30, choices=RUN_TYPE_CHOICES, null=True, blank=True,
    )
    entity_type = models.CharField(
        max_length=30, choices=ENTITY_TYPE_CHOICES, null=True, blank=True,
    )
    updated_after = models.DateTimeField(null=True, blank=True)
    cursor_end    = models.DateTimeField(null=True, blank=True)  # max Hasura updated_at seen; next run's cursor
    target_identifier = models.CharField(max_length=200, null=True, blank=True)
    triggered_by = models.ForeignKey(
        "User", on_delete=models.PROTECT, null=True, blank=True, related_name="+",
    )
    user_logins = models.JSONField(null=True, blank=True)
    partner_ids = models.JSONField(null=True, blank=True)

    users_fetched = models.IntegerField(default=0)
    users_created = models.IntegerField(default=0)
    users_updated = models.IntegerField(default=0)
    partners_fetched = models.IntegerField(default=0)
    partners_created = models.IntegerField(default=0)
    partners_updated = models.IntegerField(default=0)

    error_message = models.TextField(null=True, blank=True)

    class Meta:
        db_table = "sync_run"
        ordering = ["-started_at"]
        indexes = [
            models.Index(fields=["run_type", "entity_type", "status"]),
            models.Index(fields=["status"]),
        ]

    def __str__(self) -> str:
        return f"SyncRun {self.id} [{self.status}] @ {self.started_at}"
