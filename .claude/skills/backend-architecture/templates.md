# Backend Code Templates

## Module Structure

When adding a new feature module:

```
sessionops/
├── models/{module}.py      # Django models
├── schemas/{module}.py     # Pydantic v2 schemas
├── services/{module}.py    # Business logic
├── api/{module}_api.py     # Ninja router
└── tests/features/m{X}/    # Tests organized by milestone
```

## Model Template

```python
from django.db import models
from sessionops.models.base import SoftDeleteBaseModel


class Example(SoftDeleteBaseModel):
    """
    Domain model description.
    """
    name = models.CharField(max_length=255)
    school = models.ForeignKey(
        "sessionops.Partner",
        on_delete=models.CASCADE,
        related_name="examples",
    )

    class Meta:
        db_table = "examples"
        ordering = ["-created_at"]

    def __str__(self):
        return self.name
```

Key points:
- Always extend `SoftDeleteBaseModel` (provides `is_active`, `created_at`, `updated_at`)
- Use explicit `db_table`
- Use `related_name` on ForeignKeys
- No business logic in models

## Schema Template

```python
from pydantic import BaseModel, field_validator, model_config


class ExampleCreateSchema(BaseModel):
    """Request schema for creating an example."""
    model_config = {"str_strip_whitespace": True}

    name: str
    school_id: int

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v:
            raise ValueError("Name cannot be empty")
        return v


class ExampleReadSchema(BaseModel):
    """Response schema for reading an example."""
    model_config = {"from_attributes": True}

    id: int
    name: str
    school_id: int
    is_active: bool
    created_at: str
```

Key points:
- Pydantic v2 syntax only (`model_config` dict, `@field_validator` with `@classmethod`)
- Separate Create/Update/Read schemas
- `from_attributes = True` on read schemas for ORM compatibility
- Strip whitespace on string inputs

## Service Template

```python
from sessionops.models.user import User
from sessionops.models.partner import Partner
from sessionops.exceptions import NotFound, ValidationError, PermissionDenied


class ExampleService:
    """Business logic for examples."""

    @staticmethod
    def get(*, user: User, example_id: int) -> "Example":
        """Get a single example, respecting RBAC scope."""
        qs = ExampleService._scoped_queryset(user)
        try:
            return qs.get(id=example_id, is_active=True)
        except Example.DoesNotExist:
            raise NotFound("Example not found")

    @staticmethod
    def list(*, user: User, school_id: int | None = None) -> list:
        """List examples within user's RBAC scope."""
        qs = ExampleService._scoped_queryset(user).filter(is_active=True)
        if school_id:
            qs = qs.filter(school_id=school_id)
        return list(qs)

    @staticmethod
    def create(*, user: User, payload) -> "Example":
        """Create an example. Enforces business rules."""
        # 1. Validate scope
        school = Partner.objects.filter(
            id=payload.school_id, is_active=True
        ).first()
        if not school:
            raise NotFound("School not found")

        # 2. Enforce business rules
        # (e.g., max count, uniqueness, etc.)

        # 3. Create
        return Example.objects.create(
            name=payload.name,
            school=school,
        )

    @staticmethod
    def _scoped_queryset(user: User):
        """Apply RBAC scope filtering."""
        from sessionops.services.rbac import RBACService
        return RBACService.filter_by_scope(
            user=user,
            queryset=Example.objects.filter(is_active=True),
        )
```

Key points:
- Static methods with keyword-only arguments
- Every public method takes `user` for RBAC
- `_scoped_queryset` helper for consistent scope filtering
- Raises typed exceptions, never returns None for not-found
- Comments mark the steps: validate → enforce rules → execute

## API Endpoint Template

```python
from ninja import Router
from sessionops.auth import AuthBearer
from sessionops.schemas.example import (
    ExampleCreateSchema,
    ExampleReadSchema,
)
from sessionops.services.example import ExampleService

router = Router(tags=["Examples"])


@router.get(
    "/schools/{school_id}/examples",
    response=list[ExampleReadSchema],
    auth=AuthBearer(),
)
def list_examples(request, school_id: int):
    """List examples for a school (RBAC-scoped)."""
    return ExampleService.list(user=request.auth, school_id=school_id)


@router.post(
    "/schools/{school_id}/examples",
    response={201: ExampleReadSchema},
    auth=AuthBearer(),
)
def create_example(request, school_id: int, payload: ExampleCreateSchema):
    """Create an example (RBAC-enforced)."""
    return 201, ExampleService.create(user=request.auth, payload=payload)
```

Key points:
- `auth=AuthBearer()` on every endpoint
- Response type annotation for OpenAPI docs
- Thin: parse → delegate → return
- No try/except in views (exception handler maps typed errors to HTTP)

## Test Template

```python
import pytest
from sessionops.models.user import User
from sessionops.services.example import ExampleService
from sessionops.exceptions import NotFound, ValidationError


@pytest.fixture
def admin_user(db):
    return User.objects.create(
        email="admin@test.com",
        role="admin",
        is_active=True,
    )


@pytest.fixture
def co_user(db):
    return User.objects.create(
        email="co@test.com",
        role="co_full_time",
        is_active=True,
    )


class TestExampleService:
    def test_list_returns_active_only(self, admin_user, example_factory):
        """Soft-deleted examples are excluded."""
        active = example_factory(is_active=True)
        deleted = example_factory(is_active=False)
        result = ExampleService.list(user=admin_user)
        assert active in result
        assert deleted not in result

    def test_create_enforces_max_count(self, co_user, school):
        """Cannot exceed maximum example count per school."""
        # ... setup max examples
        with pytest.raises(ValidationError):
            ExampleService.create(user=co_user, payload=payload)

    def test_get_respects_rbac_scope(self, co_user, other_cos_school):
        """CO cannot access examples from another CO's school."""
        with pytest.raises(NotFound):
            ExampleService.get(user=co_user, example_id=other_example.id)
```

Key points:
- Test the service layer, not the view
- Always test RBAC (authorized + unauthorized)
- Always test soft-delete filtering
- Always test business rule enforcement
- Use fixtures for setup
- Tests in `sessionops/tests/features/m{X}/`
