from django.db import models


class ChildSubject(models.Model):
    """
    History-only record. Never used for current-state queries.
    Always derive current subjects via child → child_class_section → class_section → class_section_subject.
    """

    child_subject_id         = models.BigAutoField(primary_key=True)
    child_id                 = models.ForeignKey(
        "Child", on_delete=models.PROTECT
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
        db_table = "child_subject"
        indexes = [
            models.Index(fields=["child_id", "is_active", "removed"]),
            models.Index(fields=["class_section_subject_id", "is_active", "removed"]),
        ]

    def __str__(self) -> str:
        return f"ChildSubject(child={self.child_id_id}, css={self.class_section_subject_id_id})"
