from django.db import models


class SlotClassSectionVolunteer(models.Model):
    """
    A volunteer is teaching in this slot-class-section. One row per volunteer
    (no vol1/vol2 column — separate rows). Each slot-class has 1-2 rows (R2).
    """

    slot_class_section_volunteer_id = models.BigAutoField(primary_key=True)
    slot_class_section_id = models.ForeignKey(
        "SlotClassSection", on_delete=models.PROTECT, db_column="slot_class_section_id"
    )
    volunteer_id = models.ForeignKey(
        "sessionops.User",
        on_delete=models.PROTECT,
        related_name="slot_class_assignments",
        db_column="volunteer_id",
    )
    is_active = models.BooleanField(default=True)
    removed = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey("sessionops.User", on_delete=models.PROTECT, related_name="+")
    updated_by = models.ForeignKey(
        "sessionops.User", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "slot_class_section_volunteer"
        indexes = [
            models.Index(fields=["slot_class_section_id", "is_active", "removed"]),
            models.Index(fields=["volunteer_id", "is_active", "removed"]),
        ]

    def __str__(self) -> str:
        return (
            f"SlotClassSectionVolunteer("
            f"scs={self.slot_class_section_id_id}, "
            f"volunteer={self.volunteer_id_id})"
        )
