"""
Sync a single user by login (email) from Hasura.

Admin-only. Creates a SyncRun row with run_type='manual_single_user'.
"""

from datetime import datetime, timezone

from django.utils import timezone as dj_timezone

from sessionops.exceptions import ConflictError, NotFound, PermissionDenied
from sessionops.models import SyncRun, User
from sessionops.services.auth.role_helpers import user_has_admin_access
from sessionops.services.hasura.client import HasuraError, fetch_user_by_login
from sessionops.services.sync.upsert import bulk_upsert_users as _bulk_upsert_users


def sync_user_by_login(user_login: str, triggered_by: User) -> dict:
    """
    Fetch a single user from Hasura by login and upsert into Session-Ops.

    Returns {"synced_user": <User instance>, "sync_run_id": <int>}.
    Raises PermissionDenied (403), ConflictError (409), or NotFound (404).
    """
    if not user_has_admin_access(triggered_by.user_role):
        raise PermissionDenied()

    if SyncRun.objects.filter(status=SyncRun.STATUS_RUNNING).exists():
        raise ConflictError("Another sync is already in progress. Please wait.")

    run = SyncRun.objects.create(
        status=SyncRun.STATUS_RUNNING,
        run_type=SyncRun.RUN_TYPE_MANUAL_SINGLE_USER,
        entity_type=SyncRun.ENTITY_TYPE_USER,
        entity_sync_type=SyncRun.ENTITY_SYNC_TYPE_USERS,
        target_identifier=user_login,
        triggered_by=triggered_by,
    )

    now = dj_timezone.now()

    try:
        row = fetch_user_by_login(user_login)

        if row is None:
            run.status = SyncRun.STATUS_FAILED
            run.error_message = f"No user found with login '{user_login}' in Hasura"
            run.completed_at = now
            run.save(update_fields=["status", "error_message", "completed_at"])
            raise NotFound(f"No user found with login '{user_login}' in Hasura")

        created, updated = _bulk_upsert_users([row], now)

        normalized_login = (user_login or "").lower().strip()
        synced_user = User.objects.get(user_login=normalized_login)

        run.status = SyncRun.STATUS_SUCCESS
        run.users_fetched = 1
        run.users_created = created
        run.users_updated = updated
        run.user_logins = [
            {"user_login": synced_user.user_login, "user_name": synced_user.user_display_name}
        ]
        run.completed_at = dj_timezone.now()
        run.save(
            update_fields=[
                "status",
                "users_fetched",
                "users_created",
                "users_updated",
                "user_logins",
                "completed_at",
            ]
        )

        return {"synced_user": synced_user, "sync_run_id": run.id}

    except (NotFound, PermissionDenied, ConflictError):
        raise
    except Exception as exc:
        run.status = SyncRun.STATUS_FAILED
        run.error_message = str(exc)
        run.completed_at = dj_timezone.now()
        run.save(update_fields=["status", "error_message", "completed_at"])
        raise
