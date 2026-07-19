from sessionops.models import User
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload


def apply_common_fields(user: User, payload: RealtimeSyncUserPayload, now) -> None:
    """
    Write all non-worknode user fields from payload to the local user row.
    Does NOT save — caller calls user.save() after.
    worknode_id is intentionally excluded; only F-M8a-4 flows write it.
    """
    user.user_login = payload.user_login
    # user_display_name/email/user_role are non-nullable on User, but the payload
    # types them Optional (and blanks out empty strings) — keep the existing value
    # rather than writing None into a NOT NULL column when a field is omitted.
    if payload.user_display_name is not None:
        user.user_display_name = payload.user_display_name
    if payload.user_email is not None:
        user.email = payload.user_email  # User.email ↔ payload.user_email
    user.contact = payload.user_phone  # User.contact ↔ payload.user_phone
    if payload.user_role is not None:
        user.user_role = payload.user_role
    # user_active_status renamed from is_active — None means "not specified", not
    # "inactive" (the schema's own comment documents this); the dedicated
    # deactivate.py flow handles actual deactivation and never calls this function.
    user.is_active = True if payload.user_active_status is None else payload.user_active_status
    user.synced_at = now

    # Location / org hierarchy
    user.city = payload.city
    user.center = payload.center
    user.state = payload.state
    user.reporting_manager_user_login = payload.reporting_manager_user_login
    user.reporting_manager_role_code = payload.reporting_manager_role_code
    user.reporting_manager_user_id = payload.reporting_manager_user_id
