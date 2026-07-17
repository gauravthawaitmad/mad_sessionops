from django.db import models

DAYS_OF_WEEK = [
    ("monday",    "Monday"),
    ("tuesday",   "Tuesday"),
    ("wednesday", "Wednesday"),
    ("thursday",  "Thursday"),
    ("friday",    "Friday"),
    ("saturday",  "Saturday"),
    ("sunday",    "Sunday"),
]

DAY_ORDER = {d: i for i, (d, _) in enumerate(DAYS_OF_WEEK)}


class Slot(models.Model):
    """
    Weekly recurring time window at a school.

    A slot says "Monday 11:00-12:00 at School X" — it applies to every
    Monday in the academic year. Per-date materialization is M4.
    """

    slot_id                 = models.BigAutoField(primary_key=True)
    school_id               = models.BigIntegerField(db_index=True)
    school_academic_year_id = models.ForeignKey(
        "SchoolAcademicYear", on_delete=models.PROTECT
    )
    slot_name               = models.CharField(max_length=100)
    day_of_week             = models.CharField(max_length=10, choices=DAYS_OF_WEEK)
    start_time              = models.TimeField()
    end_time                = models.TimeField()
    recurring               = models.BooleanField(default=True)
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
        db_table = "slot"
        indexes = [
            models.Index(fields=["school_id", "is_active", "removed"]),
            models.Index(fields=["school_id", "day_of_week"]),
        ]

    def __str__(self) -> str:
        return f"Slot({self.slot_name}, {self.day_of_week}, {self.start_time}-{self.end_time})"
