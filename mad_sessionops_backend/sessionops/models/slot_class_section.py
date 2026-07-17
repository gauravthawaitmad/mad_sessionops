from django.db import models


class SlotClassSection(models.Model):
    """
    A slot teaches this section's subject. Both class_section_id and
    class_section_subject_id are stored (denormalized) to match the Bubble schema.
    """

    slot_class_section_id    = models.BigAutoField(primary_key=True)
    slot_id                  = models.ForeignKey(
        "Slot", on_delete=models.PROTECT
    )
    class_section_id         = models.ForeignKey(
        "ClassSection", on_delete=models.PROTECT
    )
    class_section_subject_id = models.ForeignKey(
        "ClassSectionSubject", on_delete=models.PROTECT
    )
    is_active                = models.BooleanField(default=True)
    removed                  = models.BooleanField(default=False)
    deleted_at               = models.DateTimeField(null=True, blank=True)
    created_at               = models.DateTimeField(auto_now_add=True)
    updated_at               = models.DateTimeField(auto_now=True)
    created_by               = models.ForeignKey(
        "sessionops.User", on_delete=models.PROTECT, related_name="+"
    )
    updated_by               = models.ForeignKey(
        "sessionops.User", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "slot_class_section"
        indexes = [
            models.Index(fields=["slot_id", "is_active", "removed"]),
        ]

    def __str__(self) -> str:
        return f"SlotClassSection(slot={self.slot_id_id}, section={self.class_section_id_id})"
