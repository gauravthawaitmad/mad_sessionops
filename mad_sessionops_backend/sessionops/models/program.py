from django.db import models


class Program(models.Model):
    program_id   = models.BigAutoField(primary_key=True)
    program_name = models.CharField(max_length=100, unique=True)
    is_active    = models.BooleanField(default=True)
    removed      = models.BooleanField(default=False)
    deleted_at   = models.DateTimeField(null=True, blank=True)
    created_at   = models.DateTimeField(auto_now_add=True)
    updated_at   = models.DateTimeField(auto_now=True)
    created_by   = models.ForeignKey(
        "sessionops.User", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )
    updated_by   = models.ForeignKey(
        "sessionops.User", on_delete=models.PROTECT, null=True, blank=True, related_name="+"
    )

    class Meta:
        db_table = "program"

    def __str__(self) -> str:
        return self.program_name
