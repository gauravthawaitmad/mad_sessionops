from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from sessionops.exceptions import NotFound
from sessionops.models import (
    BatchChild,
    Child,
    ChildClass,
    ChildClassSection,
    ChildProgram,
    ChildRemovalLog,
    User,
)
from sessionops.schemas.children import DeactivateIn
from sessionops.services.rbac.scope import get_school_or_403


def deactivate_child(child_id: int, payload: DeactivateIn, user: User) -> None:
    with transaction.atomic():
        try:
            child = (
                Child.objects
                .select_for_update()
                .get(child_id=child_id, is_active=True, removed=False)
            )
        except Child.DoesNotExist:
            raise NotFound(f"Child {child_id} not found.")

        get_school_or_403(user, child.school_id)

        now = timezone.now()

        Child.objects.filter(child_id=child_id).update(
            is_active=False, updated_by_id=user.user_id
        )
        ChildClass.objects.filter(
            child_id=child_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now, updated_by_id=user.user_id)

        ChildClassSection.objects.filter(
            child_id=child_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now, updated_by_id=user.user_id)

        BatchChild.objects.filter(
            child_id=child_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now, updated_by_id=user.user_id)

        ChildProgram.objects.filter(
            child_id=child_id, is_active=True, removed=False
        ).update(is_active=False, removed=True, deleted_at=now, updated_by_id=user.user_id)

        ChildRemovalLog.objects.create(
            child_id=child,
            co_id=user.user_id,
            school_id=child.school_id,
            removed_reason=payload.removed_reason,
            other_details=payload.other_details,
            removed_datetime=now,
            is_active=True,
            removed=False,
        )
