from django.db import models


class SchoolSessionDetails(models.Model):
    """
    Per-school academic session boundary — start and end date for the year.

    One-time set per (school, academic_year) in M4; immutable once created.
    M5 year progression will archive by setting is_active=False, removed=False
    and creating a new row for the new academic year.
    """

    session_id = models.BigAutoField(primary_key=True)
    school_id = models.BigIntegerField(db_index=True)
    school_academic_year = models.ForeignKey("SchoolAcademicYear", on_delete=models.PROTECT)
    start_date = models.DateField()
    end_date = models.DateField()
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
        db_table = "school_session_details"
        indexes = [
            models.Index(fields=["school_id", "is_active", "removed"]),
            models.Index(fields=["school_academic_year"]),
        ]

    def __str__(self) -> str:
        return f"Session(school={self.school_id}, {self.start_date}–{self.end_date})"
