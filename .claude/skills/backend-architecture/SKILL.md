# Backend Architecture Skill

Session-Ops backend: Django 4.2 + Django Ninja + PostgreSQL + Celery.

## Architecture

4-layer architecture: **API → Service → Schema → Model**

- `api/` — Ninja routers. Thin: parse input, call service, return response.
- `services/` — All business logic. The unit of testing.
- `schemas/` — Pydantic v2 validation. Shape and field-level checks only.
- `models/` — Django ORM. Data shape, relationships, soft-delete base.

## Key Files

| File | Purpose |
|------|---------|
| `sessionops/auth.py` | JWT middleware for Ninja |
| `sessionops/exceptions.py` | Typed exceptions (maps to HTTP codes) |
| `sessionops/routes.py` | API router registration |
| `sessionops/models/base.py` | SoftDeleteBaseModel |
| `sessionops/models/user.py` | Custom User model |

## Patterns

See `templates.md` for code templates.
See `examples.md` for concrete implementation patterns.

## Conventions

- Pydantic v2: use `field_validator`, `model_config`, not v1 syntax
- All queries default to `is_active=True` filtering
- Every endpoint has RBAC (role guard + scope filter)
- Services raise typed exceptions, never raw Python exceptions
- Celery tasks are idempotent
- `uv` for package management, `justfile` for dev commands
