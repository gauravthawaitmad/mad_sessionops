from django.db import models


class PartnerWorknode(models.Model):
    """
    Sync mirror of Hasura's chapter_mapping table.

    Maps a Session-Ops school (Partner) to a Worknode ID.
    Read-only from Session-Ops; written only by the cron sync.
    Hard-delete on removal is intentional — this is a sync mirror, not domain data.
    """

    partner_worknode_id = models.BigAutoField(primary_key=True)
    partner_id = models.CharField(max_length=100, db_index=True)
    worknode_id = models.IntegerField(db_index=True)
    city_name = models.CharField(max_length=200, null=True, blank=True)
    state = models.CharField(max_length=200, null=True, blank=True)
    co_name = models.TextField(null=True, blank=True)
    chapter_name = models.CharField(max_length=200, null=True, blank=True)
    engine = models.CharField(max_length=100, null=True, blank=True)
    chapter_status = models.CharField(max_length=50, null=True, blank=True)
    sourcing_campaign_code = models.TextField(null=True, blank=True)
    campaign_name = models.CharField(max_length=200, null=True, blank=True)
    fundraiser_id = models.CharField(max_length=100, null=True, blank=True)
    fundraiser_name = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "partner_worknode"
        indexes = [
            models.Index(fields=["partner_id"]),
            models.Index(fields=["worknode_id"]),
        ]

    def __str__(self) -> str:
        return f"PartnerWorknode(partner_id={self.partner_id}, worknode_id={self.worknode_id})"
