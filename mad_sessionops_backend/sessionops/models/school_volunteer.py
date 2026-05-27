from django.db import models


class SchoolVolunteer(models.Model):
    """
    History/de-dup record linking a volunteer (User) to a school.

    Managed implicitly by slot-class CRUD (F-M3-7) — never written directly
    from the Volunteers tab. Used for R4 enforcement: one volunteer per school.
    """

    school_volunteer_id     = models.BigAutoField(primary_key=True)
    school_id               = models.BigIntegerField(db_index=True)
    volunteer_id            = models.ForeignKey(
        "sessionops.User", on_delete=models.PROTECT, related_name="school_volunteer_entries"
    )
    school_academic_year_id = models.ForeignKey(
        "SchoolAcademicYear", on_delete=models.PROTECT
    )
    is_active               = models.BooleanField(default=True)
    removed                 = models.BooleanField(default=False)
    deleted_at              = models.DateTimeField(null=True, blank=True)
    created_at              = models.DateTimeField(auto_now_add=True)
    updated_at              = models.DateTimeField(auto_now=True)
    created_by              = models.ForeignKey(
        "sessionops.User", on_delete=models.PROTECT, related_name="+"
    )
    updated_by              = models.ForeignKey(
        "sessionops.User", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "school_volunteer"
        indexes = [
            models.Index(fields=["school_id", "is_active", "removed"]),
            models.Index(fields=["volunteer_id", "is_active", "removed"]),
        ]

    def __str__(self) -> str:
        return f"SchoolVolunteer(school={self.school_id}, volunteer={self.volunteer_id_id})"
