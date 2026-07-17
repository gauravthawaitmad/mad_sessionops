from django.db import models


SYNC_TYPES = [
    ("manual_admin", "Manual trigger by admin"),
    ("realtime_webhook", "Realtime via n8n / webhook"),
    ("cron_fallback", "Cron-based fallback sync"),
]

EVENT_TYPES = [
    ("insert", "User created"),
    ("update", "User updated"),
    ("deactivate", "User deactivated"),
]

SYNC_STATUSES = [
    ("success", "Success"),
    ("partial_success", "Partial — common fields only, worknode cascade skipped"),
    ("failed", "Failed"),
    ("skipped_role_not_allowed", "Skipped — role not in allowlist"),
    ("skipped_no_change", "Skipped — no meaningful changes"),
    ("skipped_stale", "Skipped — incoming data older than stored"),
]

ACTIONS_TAKEN = [
    ("user_created", "New user inserted"),
    ("common_fields_updated", "Common field update only"),
    ("worknode_added", "Worknode_id added with cascade"),
    ("worknode_updated", "Worknode_id updated with cascade"),
    ("worknode_removed", "Worknode_id removed with cascade"),
    ("user_deactivated", "User deactivated with cascade"),
    ("no_change", "No action — same as before"),
    ("no_school_found_for_worknode", "Common fields updated, worknode cascade skipped"),
    ("failed", "Failed mid-processing"),
]


class RealtimeSyncLog(models.Model):
    """
    Append-only audit log for every realtime sync event processed by M8a flows.

    user_id_from_source is NOT a FK — Hasura's user_id may arrive before the
    local User row exists (INSERT events). triggered_by is the admin who manually
    triggered the sync; null for automated callers (M8b+).
    """

    realtime_sync_log_id = models.BigAutoField(primary_key=True)

    user_id_from_source = models.IntegerField(db_index=True)
    sync_type           = models.CharField(max_length=30, choices=SYNC_TYPES)
    event_type          = models.CharField(max_length=20, choices=EVENT_TYPES)
    triggered_by        = models.ForeignKey(
        "User",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )
    external_event_id   = models.CharField(max_length=200, null=True, blank=True, db_index=True)

    received_at         = models.DateTimeField(auto_now_add=True, db_index=True)
    processed_at        = models.DateTimeField(null=True, blank=True)

    status              = models.CharField(max_length=30, choices=SYNC_STATUSES)
    action_taken        = models.CharField(max_length=40, choices=ACTIONS_TAKEN)
    error_details       = models.TextField(null=True, blank=True)

    pre_snapshot        = models.JSONField(null=True, blank=True)
    incoming_payload    = models.JSONField(null=True, blank=True)
    field_changes       = models.JSONField(null=True, blank=True)
    cascaded_changes    = models.JSONField(null=True, blank=True)
    rules_fired         = models.JSONField(null=True, blank=True)
    deferred_operations = models.JSONField(null=True, blank=True)

    created_at          = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "realtime_sync_log"
        indexes = [
            models.Index(fields=["user_id_from_source", "received_at"]),
            models.Index(fields=["status", "received_at"]),
            models.Index(fields=["sync_type", "received_at"]),
            models.Index(fields=["external_event_id"]),
        ]
