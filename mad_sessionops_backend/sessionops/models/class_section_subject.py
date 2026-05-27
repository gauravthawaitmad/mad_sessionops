from django.db import models


class ClassSectionSubject(models.Model):
    class_section_subject_id = models.BigAutoField(primary_key=True)
    class_section_id         = models.ForeignKey(
        "ClassSection", on_delete=models.PROTECT
    )
    subject_id               = models.ForeignKey(
        "Subject", on_delete=models.PROTECT
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
        db_table = "class_section_subject"
        indexes = [
            models.Index(fields=["class_section_id", "is_active", "removed"]),
        ]

    def __str__(self) -> str:
        return f"ClassSectionSubject(section={self.class_section_id_id}, subject={self.subject_id_id})"
