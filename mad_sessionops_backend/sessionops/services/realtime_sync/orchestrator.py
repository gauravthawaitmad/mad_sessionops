from django.db import transaction
from django.utils import timezone

from sessionops.models import RealtimeSyncLog, User
from sessionops.services.realtime_sync.allowlist import classify_event
from sessionops.services.realtime_sync.diff import compute_diff
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload


def process_sync_event(
    user_id: int,
    payload: RealtimeSyncUserPayload,
    triggered_by: User | None,
) -> RealtimeSyncLog:
    """
    Main sync flow. Runs inside a DB transaction with a select_for_update lock on
    the User row so that concurrent events for the same user_id are serialised.

    user_id comes from the URL path; payload carries all body fields.
    Returns the written RealtimeSyncLog row in all cases (success or skipped).
    """
    with transaction.atomic():
        # 1. Lock the user row; tolerate missing rows (INSERT events)
        try:
            local_user = User.objects.select_for_update().get(user_id=user_id)
        except User.DoesNotExist:
            local_user = None

        # 2. Diff
        diff = compute_diff(local_user, payload)

        # 3. Stale event check
        if diff.is_stale:
            return _write_log(
                user_id,
                payload,
                triggered_by,
                "skipped_stale",
                "no_change",
                pre_snapshot=diff.pre_snapshot,
                incoming_payload=payload.model_dump(),
            )

        # 4. Role allowlist gate
        classified_event = classify_event(payload.event_type, payload.user_role)
        if classified_event == "skipped":
            return _write_log(
                user_id,
                payload,
                triggered_by,
                "skipped_role_not_allowed",
                "no_change",
                pre_snapshot=diff.pre_snapshot,
                incoming_payload=payload.model_dump(),
            )

        # 5. No-change check (only for existing users that are not being deactivated)
        if (
            diff.user_exists_locally
            and not diff.common_fields_changed
            and diff.worknode_action == "none"
            and classified_event != "deactivate"
        ):
            return _write_log(
                user_id,
                payload,
                triggered_by,
                "skipped_no_change",
                "no_change",
                pre_snapshot=diff.pre_snapshot,
                incoming_payload=payload.model_dump(),
            )

        # 6. Dispatch to flow handler (imported late to avoid circular imports)
        from sessionops.services.realtime_sync.flows import (
            handle_deactivate,
            handle_insert,
            handle_update,
        )

        # Role-based deactivate intent takes priority over is_reactivation (a purely
        # local-state signal) — otherwise an Alumni/None-role event for a currently
        # inactive local user would be misrouted to handle_insert and reactivated.
        #
        # "not diff.user_exists_locally" catches events whose upstream event_type
        # says "update" (the row always existed in the source system) even though
        # we never created it locally — e.g. a user was skipped on first INSERT for
        # having a disallowed role, then later became allowed via an UPDATE-shaped
        # event. Without this, handle_update would run against local_user=None.
        if classified_event == "deactivate":
            result = handle_deactivate(local_user, payload, diff, user_id)
        elif classified_event == "insert" or diff.is_reactivation or not diff.user_exists_locally:
            result = handle_insert(local_user, payload, diff, user_id)
        else:
            result = handle_update(local_user, payload, diff, user_id)

        # 7. Write log
        return _write_log(
            user_id,
            payload,
            triggered_by,
            result.status,
            result.action_taken,
            pre_snapshot=diff.pre_snapshot,
            incoming_payload=payload.model_dump(),
            field_changes=diff.common_fields_changed,
            cascaded_changes=result.cascaded_changes,
            rules_fired=result.rules_fired,
            deferred_operations=result.deferred_operations,
            error_details=result.error_details,
        )


def _write_log(
    user_id: int,
    payload: RealtimeSyncUserPayload,
    triggered_by: User | None,
    status: str,
    action_taken: str,
    *,
    pre_snapshot=None,
    incoming_payload=None,
    field_changes=None,
    cascaded_changes=None,
    rules_fired=None,
    deferred_operations=None,
    error_details=None,
) -> RealtimeSyncLog:
    log = RealtimeSyncLog(
        user_id_from_source=user_id,
        sync_type=payload.sync_type,
        event_type=payload.event_type,
        triggered_by=triggered_by,
        external_event_id=payload.external_event_id,
        processed_at=timezone.now(),
        status=status,
        action_taken=action_taken,
        pre_snapshot=pre_snapshot,
        incoming_payload=incoming_payload,
        field_changes=field_changes,
        cascaded_changes=cascaded_changes,
        rules_fired=rules_fired,
        deferred_operations=deferred_operations,
        error_details=error_details,
    )
    log.save()
    return log
