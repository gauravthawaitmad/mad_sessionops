"""
F-M8a-5: User deactivation flow.

Triggered when user_role changes to Alumni or null.
Cascades through all active SchoolVolunteer rows for the user (across all schools),
then soft-deletes the User row.

Runs inside the orchestrator's transaction.atomic() context.
"""

from django.utils import timezone

from sessionops.models import SchoolVolunteer, User
from sessionops.services.realtime_sync.flows import FlowResult
from sessionops.services.realtime_sync.flows.cascade import _cascade_remove_user_from_school
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload


def handle_deactivate(
    local_user: User | None,
    payload: RealtimeSyncUserPayload,
    diff,
    user_id: int,
) -> FlowResult:
    if local_user is None:
        return FlowResult(status="skipped_no_change", action_taken="no_change")

    if not local_user.is_active:
        return FlowResult(status="skipped_no_change", action_taken="no_change")

    now = timezone.now()
    cascaded_changes: list = []
    rules_fired: list = []

    # Collect all schools user is currently active at, then cascade-remove from each.
    # Snapshot school_ids before the cascade so deletes inside the loop don't affect the query.
    affected_school_ids = list(
        SchoolVolunteer.objects.filter(
            volunteer_id=local_user,
            is_active=True,
            removed=False,
        ).values_list("school_id", flat=True)
    )

    for school_id in affected_school_ids:
        _cascade_remove_user_from_school(local_user, school_id, now, cascaded_changes)
        rules_fired.append(f"cascade_remove_user_from_school:deactivation:{school_id}")

    # Soft-delete the User row
    local_user.is_active = False
    local_user.deleted_at = now
    local_user.synced_at = now
    local_user.user_role = payload.user_role or ""
    local_user.save(update_fields=["is_active", "deleted_at", "synced_at", "user_role"])
    cascaded_changes.append({"table": "user", "id": local_user.user_id, "action": "soft_deleted"})
    rules_fired.append("deactivate_user")

    return FlowResult(
        status="success",
        action_taken="user_deactivated",
        cascaded_changes=cascaded_changes,
        rules_fired=rules_fired,
    )
