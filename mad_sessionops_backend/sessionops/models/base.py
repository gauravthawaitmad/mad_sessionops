from django.db import models
from django.utils import timezone


class SoftDeleteManager(models.Manager):
    """Default manager for soft-deletable models. Filters is_active=True by default."""

    def get_queryset(self):
        return super().get_queryset().filter(is_active=True)

    def all_with_deleted(self):
        return super().get_queryset()


class SoftDeleteBaseModel(models.Model):
    """
    Abstract base for all domain models. Provides soft-delete semantics.

    Every domain model (except User, which implements the pattern directly)
    inherits from this class. User can't inherit here because its deleted_by
    is a self-referential FK — a forward reference at class definition time.

    delete() performs a soft-delete (sets is_active=False). Never issues SQL DELETE.
    hard_delete() always raises NotImplementedError — intentional defense against
    accidentally bypassing the no-hard-delete rule (R9, D025).
    """

    is_active = models.BooleanField(default=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        "sessionops.User",
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name="+",
    )

    objects = SoftDeleteManager()

    class Meta:
        abstract = True

    def delete(self, deleted_by=None, *args, **kwargs):
        self.is_active = False
        self.deleted_at = timezone.now()
        if deleted_by is not None:
            self.deleted_by = deleted_by
        self.save(update_fields=["is_active", "deleted_at", "deleted_by", "updated_at"])

    def hard_delete(self, *args, **kwargs):
        raise NotImplementedError(
            "Hard deletes are not allowed. Use delete() for soft-delete. "
            "If you genuinely need to purge data, do it via a one-off migration "
            "with explicit review."
        )
