from django.utils.dateparse import parse_datetime

from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload

# User model field names tracked for change detection.
# user_id is excluded — it identifies the row, not a changeable field.
TRACKED_FIELDS = [
    "user_login",
    "user_display_name",
    "email",  # User.email — payload uses user_email
    "contact",  # User.contact — payload uses user_phone
    "user_role",
    "worknode_id",
    "city",
    "center",
    "state",
    "reporting_manager_user_login",
    "reporting_manager_role_code",
    "reporting_manager_user_id",
]

# Maps User model field name → RealtimeSyncUserPayload attribute name
_FIELD_TO_PAYLOAD: dict[str, str] = {
    "user_login": "user_login",
    "user_display_name": "user_display_name",
    "email": "user_email",
    "contact": "user_phone",
    "user_role": "user_role",
    "worknode_id": "worknode_id",
    "city": "city",
    "center": "center",
    "state": "state",
    "reporting_manager_user_login": "reporting_manager_user_login",
    "reporting_manager_role_code": "reporting_manager_role_code",
    "reporting_manager_user_id": "reporting_manager_user_id",
}


class UserDiff:
    def __init__(
        self,
        *,
        user_exists_locally: bool,
        is_reactivation: bool = False,
        worknode_action: str = "none",
        common_fields_changed: list | None = None,
        role_changed: bool = False,
        incoming_role: str | None = None,
        pre_snapshot: dict | None = None,
        is_stale: bool = False,
    ):
        self.user_exists_locally = user_exists_locally
        self.is_reactivation = is_reactivation
        self.worknode_action = worknode_action
        self.common_fields_changed = common_fields_changed or []
        self.role_changed = role_changed
        self.incoming_role = incoming_role
        self.pre_snapshot = pre_snapshot or {}
        self.is_stale = is_stale


def compute_diff(local_user, payload: RealtimeSyncUserPayload) -> UserDiff:
    """
    Compare the local User row against the incoming payload and return a UserDiff.

    Returns UserDiff with user_exists_locally=False when local_user is None (INSERT case).
    Returns UserDiff with is_stale=True when the incoming event is older than synced_at.
    """
    if local_user is None:
        return UserDiff(
            user_exists_locally=False,
            incoming_role=payload.user_role,
        )

    pre_snapshot = {f: getattr(local_user, f, None) for f in TRACKED_FIELDS}
    # Store synced_at as ISO string — JSONField's default encoder doesn't handle datetime objects.
    synced_at = local_user.synced_at
    pre_snapshot["synced_at"] = synced_at.isoformat() if synced_at is not None else None

    # Stale check: incoming event older than the last successful sync
    if payload.x_modified_timestamp and local_user.synced_at:
        try:
            incoming_ts = parse_datetime(payload.x_modified_timestamp)
            if incoming_ts is not None and incoming_ts < local_user.synced_at:
                return UserDiff(
                    user_exists_locally=True,
                    pre_snapshot=pre_snapshot,
                    is_stale=True,
                    incoming_role=payload.user_role,
                )
        except (ValueError, TypeError):
            pass  # unparseable timestamp — not stale, proceed

    # Field-level change detection
    changes = []
    for field in TRACKED_FIELDS:
        old_val = getattr(local_user, field, None)
        payload_key = _FIELD_TO_PAYLOAD[field]
        new_val = getattr(payload, payload_key, None)
        if old_val != new_val:
            changes.append({"field": field, "old": old_val, "new": new_val})

    # Worknode assignment delta
    old_wn = local_user.worknode_id
    new_wn = payload.worknode_id
    if old_wn is None and new_wn is not None:
        worknode_action = "added"
    elif old_wn is not None and new_wn is None:
        worknode_action = "removed"
    elif old_wn is not None and new_wn is not None and old_wn != new_wn:
        worknode_action = "updated"
    else:
        worknode_action = "none"

    return UserDiff(
        user_exists_locally=True,
        is_reactivation=(not local_user.is_active),
        worknode_action=worknode_action,
        common_fields_changed=changes,
        role_changed=(local_user.user_role != payload.user_role),
        incoming_role=payload.user_role,
        pre_snapshot=pre_snapshot,
        is_stale=False,
    )
