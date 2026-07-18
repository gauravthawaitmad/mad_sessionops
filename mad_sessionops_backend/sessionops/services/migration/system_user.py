from sessionops.models import User

MIGRATION_ACTOR_USER_ID = 1924616  # gaurav.thwait@makeadiff.in


def get_migration_actor() -> User:
    """The real user recorded as created_by/updated_by on every migration-mode write.

    Not cached: this is a single indexed PK lookup, and caching across requests
    would go stale under pytest's per-test transaction rollback (each test gets
    a fresh row with the same PK, not the same Python object).
    """
    return User.objects.get(user_id=MIGRATION_ACTOR_USER_ID)
