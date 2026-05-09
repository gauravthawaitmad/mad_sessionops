from django.db import models

SECTION_CODES = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]


class ClassSection(models.Model):
    class_section_id = models.BigAutoField(primary_key=True)
    school_class_id  = models.ForeignKey(
        "sessionops.SchoolClass", on_delete=models.PROTECT, db_column="school_class_id"
    )
    school_id        = models.BigIntegerField(db_index=True)
    section_code     = models.CharField(
        max_length=1, choices=[(c, c) for c in SECTION_CODES]
    )
    section_name     = models.CharField(max_length=20)  # "5th - A" — stored for query convenience
    is_active        = models.BooleanField(default=True)
    removed          = models.BooleanField(default=False)
    deleted_at       = models.DateTimeField(null=True, blank=True)
    created_at       = models.DateTimeField(auto_now_add=True)
    updated_at       = models.DateTimeField(auto_now=True)
    created_by       = models.ForeignKey(
        "sessionops.User", on_delete=models.PROTECT, related_name="+"
    )
    updated_by       = models.ForeignKey(
        "sessionops.User", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "class_section"
        constraints = [
            models.UniqueConstraint(
                fields=["school_class_id", "section_code"],
                condition=models.Q(removed=False),
                name="uniq_section_per_school_class",
            ),
        ]

    def __str__(self) -> str:
        return self.section_name
