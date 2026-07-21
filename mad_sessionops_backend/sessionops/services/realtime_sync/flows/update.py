from django.utils import timezone

from sessionops.models import User
from sessionops.services.realtime_sync.flows import FlowResult
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload
from sessionops.services.realtime_sync.utils import apply_common_fields


def handle_update(
    local_user: User,
    payload: RealtimeSyncUserPayload,
    diff,
    user_id: int,
) -> FlowResult:
    """
    UPDATE flow: apply common field changes to an existing User row.

    worknode_id changes are delegated to the cascade stub (F-M8a-4).
    Runs inside the orchestrator's transaction.atomic() context.
    """
    now = timezone.now()

    if diff.worknode_action != "none":
        from sessionops.services.realtime_sync.flows.cascade import handle_worknode_change

        return handle_worknode_change(local_user, payload, diff, now)

    apply_common_fields(local_user, payload, now)
    local_user.save()

    return FlowResult(status="success", action_taken="common_fields_updated")
