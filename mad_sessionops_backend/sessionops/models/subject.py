from django.db import models


class Subject(models.Model):
    """
    Universal catalog of teachable subjects. Seeded once; never deactivated.
    Like Class — no is_active/removed lifecycle.
    """

    subject_id   = models.BigAutoField(primary_key=True)
    subject_name = models.CharField(max_length=100, unique=True)
    program_id   = models.ForeignKey(
        "Program", on_delete=models.PROTECT, db_column="program_id", db_constraint=False
    )
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)
    created_by   = models.ForeignKey(
        "sessionops.User", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    updated_by   = models.ForeignKey(
        "sessionops.User", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "subject"

    def __str__(self) -> str:
        return self.subject_name
