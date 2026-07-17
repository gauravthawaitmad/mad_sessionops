from sessionops.models import User
from sessionops.services.realtime_sync.schema import RealtimeSyncUserPayload


def apply_common_fields(user: User, payload: RealtimeSyncUserPayload, now) -> None:
    """
    Write all non-worknode user fields from payload to the local user row.
    Does NOT save — caller calls user.save() after.
    worknode_id is intentionally excluded; only F-M8a-4 flows write it.
    """
    user.user_login = payload.user_login
    user.user_display_name = payload.user_display_name
    user.email = payload.user_email  # User.email ↔ payload.user_email
    user.contact = payload.user_phone  # User.contact ↔ payload.user_phone
    user.user_role = payload.user_role
    user.synced_at = now

    # Location / org hierarchy
    user.city = payload.city
    user.center = payload.center
    user.state = payload.state
    user.reporting_manager_user_login = payload.reporting_manager_user_login
    user.reporting_manager_role_code = payload.reporting_manager_role_code
    user.reporting_manager_user_id = payload.reporting_manager_user_id
