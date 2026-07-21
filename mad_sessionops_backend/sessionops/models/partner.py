from django.db import models

from sessionops.models.base import SoftDeleteBaseModel


class Partner(SoftDeleteBaseModel):
    """
    School/partner record synced from Hasura CRM.

    "Partner" is the Hasura/CRM term; the frontend calls these "schools."
    This model is the single source of truth for school data in M1.

    co_id is NOT a DB-level FK to User (D024) — Hasura IDs may reference
    users that haven't synced yet, so db_constraint=False is required.
    """

    # Unfiltered manager for sync upserts — needed to find soft-deleted rows
    all_objects = models.Manager()

    # -----------------------------------------------------------------------
    # Identity
    # -----------------------------------------------------------------------
    partner_id = models.BigIntegerField(unique=True, db_index=True)
    partner_name = models.CharField(max_length=255)

    # -----------------------------------------------------------------------
    # CO assignment (no DB FK — Hasura ID may outpace local User table)
    # -----------------------------------------------------------------------
    co_id = models.BigIntegerField(null=True, blank=True, db_index=True)
    co_name = models.CharField(max_length=255, null=True, blank=True)

    # -----------------------------------------------------------------------
    # Location
    # -----------------------------------------------------------------------
    address_line_1 = models.TextField(null=True, blank=True)
    address_line_2 = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=100, null=True, blank=True)
    city_id = models.IntegerField(null=True, blank=True)
    state = models.CharField(max_length=100, null=True, blank=True)
    state_id = models.IntegerField(null=True, blank=True)
    pincode = models.IntegerField(null=True, blank=True)

    # -----------------------------------------------------------------------
    # School info
    # -----------------------------------------------------------------------
    school_type = models.CharField(max_length=100, null=True, blank=True)
    partner_affiliation_type = models.CharField(max_length=100, null=True, blank=True)

    # -----------------------------------------------------------------------
    # Point of contact
    # -----------------------------------------------------------------------
    poc_name = models.CharField(max_length=255, null=True, blank=True)
    poc_email = models.CharField(max_length=255, null=True, blank=True)
    poc_designation = models.CharField(max_length=255, null=True, blank=True)
    poc_contact = models.CharField(max_length=50, null=True, blank=True)

    # -----------------------------------------------------------------------
    # MOU
    # -----------------------------------------------------------------------
    mou_sign_date = models.DateField(null=True, blank=True)
    mou_start_date = models.DateField(null=True, blank=True)
    mou_end_date = models.DateField(null=True, blank=True)
    mou_url = models.TextField(null=True, blank=True)

    # -----------------------------------------------------------------------
    # Lifecycle / CRM flags
    # -----------------------------------------------------------------------
    converted = models.BooleanField(default=False)
    crm_partner_removed = models.BooleanField(default=False)
    latest_conversion_stage = models.CharField(max_length=50, null=True, blank=True)
    lead_source = models.CharField(max_length=100, null=True, blank=True)
    date_of_first_contact = models.DateTimeField(null=True, blank=True)

    # -----------------------------------------------------------------------
    # Counts (denormalized from Hasura — M1 stores raw)
    # -----------------------------------------------------------------------
    confirmed_child_count = models.IntegerField(null=True, blank=True)
    total_child_count = models.IntegerField(null=True, blank=True)
    classes = models.TextField(null=True, blank=True)

    # -----------------------------------------------------------------------
    # Sync tracking timestamps
    # -----------------------------------------------------------------------
    partner_created_date = models.DateTimeField(null=True, blank=True)  # from Hasura
    partner_updated_date = models.DateTimeField(null=True, blank=True)  # from Hasura
    synced_at = models.DateTimeField(null=True, blank=True)  # our sync time

    class Meta:
        db_table = "partner"
        indexes = [
            models.Index(fields=["co_id"]),
            models.Index(fields=["partner_updated_date"]),
        ]

    def __str__(self) -> str:
        return f"{self.partner_name} (id={self.partner_id})"
