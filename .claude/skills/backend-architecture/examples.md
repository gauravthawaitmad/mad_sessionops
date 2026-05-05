# Backend Examples

Real patterns from the Session-Ops codebase.

## Request-Response Flow

```
Client Request
    ↓
Ninja Router (api/{module}_api.py)
    → auth=AuthBearer() validates JWT
    → Pydantic schema validates request body
    ↓
Service Layer (services/{module}.py)
    → RBAC scope check
    → Business rule enforcement
    → Database operations
    ↓
Response
    → Read schema serializes output
    → Status code set by router
    → Exception handler maps errors to HTTP codes
```

## Exception → HTTP Status Mapping

```python
# sessionops/exceptions.py pattern:
AuthenticationError → 401
PermissionDenied   → 403
NotFound           → 404
ValidationError    → 400 (with details)
ConflictError      → 409
```

## RBAC Scope Pattern

The RBAC service filters querysets based on the user's role:

```python
class RBACService:
    @staticmethod
    def filter_by_scope(*, user: User, queryset):
        """Filter queryset to user's visible scope."""
        if user.role in ("admin", "functional_lead", "project_associate"):
            return queryset  # See everything
        elif user.role in ("co_full_time", "co_part_time"):
            return queryset.filter(school__co_id=user.id)
        elif user.role == "cho":
            school_ids = SchoolVolunteer.objects.filter(
                user=user, is_active=True
            ).values_list("school_id", flat=True)
            return queryset.filter(school_id__in=school_ids)
        else:
            return queryset.none()
```

## Soft Delete Pattern

```python
# Never do this:
instance.delete()

# Always do this:
instance.is_active = False
instance.removed_reason = reason  # mandatory for children
instance.save()
```

For queries:
```python
# Default (what most code uses):
Example.objects.filter(is_active=True)

# Admin bypass (explicit):
Example.objects.all()  # Only in admin-specific views
```

## Celery Task Pattern

```python
from sessionops.celery import app


@app.task(bind=True, max_retries=3, default_retry_delay=60)
def sync_users_from_hasura(self):
    """
    Idempotent: running twice produces same state.
    """
    try:
        # Use get_or_create / update_or_create
        # Never blindly .create() — duplicates on retry
        for user_data in fetch_from_hasura():
            User.objects.update_or_create(
                hasura_id=user_data["id"],
                defaults={...},
            )
    except Exception as exc:
        self.retry(exc=exc)
```

## Migration Naming Convention

```bash
just makemigrations sessionops --name f_m2_3_add_section_model
#                                     ^ feature ID prefix
```

Format: `f_m{milestone}_{feature_number}_{description}`

## Environment-Aware Settings

```python
# In settings.py:
ENVIRONMENT = os.environ.get("ENVIRONMENT", "development")
DEBUG = ENVIRONMENT == "development"

# Secrets — no default, fail loud:
JWT_SECRET_KEY = os.environ["JWT_SECRET_KEY"]

# Optional with sane defaults:
CELERY_BROKER_URL = os.environ.get("CELERY_BROKER_URL", "redis://localhost:6379/0")
```
