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

    SYNC_TYPE_USERS = "users"
    SYNC_TYPE_PARTNERS = "partners"
    SYNC_TYPE_ALL = "all"

    SYNC_TYPE_CHOICES = [
        (SYNC_TYPE_USERS, "Users"),
        (SYNC_TYPE_PARTNERS, "Partners"),
        (SYNC_TYPE_ALL, "All"),
    ]

    id = models.BigAutoField(primary_key=True)
    started_at = models.DateTimeField(auto_now_add=True, db_index=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_RUNNING)
    sync_type = models.CharField(max_length=16, choices=SYNC_TYPE_CHOICES, default=SYNC_TYPE_ALL)

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

    def __str__(self) -> str:
        return f"SyncRun {self.id} [{self.status}] @ {self.started_at}"
