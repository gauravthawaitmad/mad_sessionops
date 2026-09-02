from django.db import IntegrityError, transaction
from django.utils import timezone

from sessionops.models import User
from sessionops.services.realtime_sync.flows import FlowResult
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload
from sessionops.services.realtime_sync.utils import apply_common_fields


def _finish(user: User, payload: RealtimeSyncUserPayload, diff, now) -> FlowResult:
    """
    Common fields are already applied/staged on `user` (and it has a pk). Delegate
    the worknode_id assignment to the cascade flows so a worknode_id present at
    insert/reactivation time creates SchoolVolunteer etc. exactly like an update
    would — otherwise a user can end up with worknode_id stamped on the row and no
    backing SchoolVolunteer until some later event happens to change worknode_id
    again.
    """
    if diff.worknode_action != "none":
        from sessionops.services.realtime_sync.flows.cascade import handle_worknode_change

        return handle_worknode_change(user, payload, diff, now)

    user.save()
    return FlowResult(status="success", action_taken="user_created")


def handle_insert(
    local_user: User | None,
    payload: RealtimeSyncUserPayload,
    diff,
    user_id: int,
) -> FlowResult:
    """
    INSERT flow: create a new User row, OR reactivate an existing soft-deleted row.

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
        #
        # The row must exist (have a pk) before _finish's cascade can create
        # SchoolVolunteer rows that FK to it, so worknode_id is intentionally left
        # unset here — _finish applies it via cascade.
        user = User(user_id=user_id)
        apply_common_fields(user, payload, now)
        try:
            with transaction.atomic():
                user.save()
        except IntegrityError:
            user = User.objects.select_for_update().get(user_id=user_id)
            apply_common_fields(user, payload, now)
            user.save()
    else:
        # Re-activation: existing row with is_active=False
        user = local_user
        user.deleted_at = None
        user.deleted_by = None
        apply_common_fields(user, payload, now)

    return _finish(user, payload, diff, now)
