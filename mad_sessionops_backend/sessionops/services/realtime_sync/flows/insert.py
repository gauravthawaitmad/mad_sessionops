from django.db import IntegrityError, transaction
from django.utils import timezone

from sessionops.models import User
from sessionops.services.realtime_sync.flows import FlowResult
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload
from sessionops.services.realtime_sync.utils import apply_common_fields


def handle_insert(
    local_user: User | None,
    payload: RealtimeSyncUserPayload,
    diff,
    user_id: int,
) -> FlowResult:
    """
    INSERT flow: create a new User row, OR reactivate an existing soft-deleted row.

    worknode_id is set from the payload (no cascade — F-M8a-4 handles cascade).
    Runs inside the orchestrator's transaction.atomic() context.
    """
    now = timezone.now()

    if local_user is None:
        # True INSERT — user_id from URL path, not payload.
        # The orchestrator's select_for_update() has nothing to lock until this
        # row exists, so two concurrent insert events for the same not-yet-created
        # user_id can both reach here. Use a nested atomic (savepoint) so a losing
        # INSERT's IntegrityError only rolls back this savepoint, not the whole
        # request — then re-fetch and apply the payload as an update instead of
        # surfacing a raw 500 for what is, from the caller's perspective, a
        # successful sync of that user.
        user = User(user_id=user_id)
        apply_common_fields(user, payload, now)
        user.worknode_id = payload.worknode_id
        try:
            with transaction.atomic():
                user.save()
        except IntegrityError:
            user = User.objects.select_for_update().get(user_id=user_id)
            apply_common_fields(user, payload, now)
            user.worknode_id = payload.worknode_id
            user.save()
    else:
        # Re-activation: existing row with is_active=False
        apply_common_fields(local_user, payload, now)
        local_user.worknode_id = payload.worknode_id
        local_user.save()

    return FlowResult(status="success", action_taken="user_created")
