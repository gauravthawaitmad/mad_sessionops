"""
M7 migration loader endpoints.

Security model:
  - auth=None disables the default CustomJwtAuthMiddleware for this router.
  - Every route manually validates the migration service token.
  - Fixed, predictable URL prefix (/api/internal/migrate/) — unlike M8a's
    non-guessable path, access control here is the token alone (per the
    milestone spec: no legitimate human-driven use case outside manual testing).
  - Response envelope is hand-built (not the global exception handlers) so the
    201/200/422/400 shapes match docs/milestones/M7.md exactly. Only a genuine
    server error (IntegrityError, bug) is left to propagate to the existing
    generic Exception -> 500 handler in routes.py.

Routes are registered in a loop from TABLE_CONFIGS/_SCHEMAS rather than
hand-written per table — 20 near-identical route functions would be exactly
the duplication the plan's HLD argues against for the service layer; the same
reasoning applies here.
"""

import json

from ninja import Router
from pydantic import ValidationError as PydanticValidationError

from sessionops.schemas.migration import (
    SYSTEM_MANAGED_FIELDS,
    AcademicYearRowIn,
    BatchChildRowIn,
    ChildClassRowIn,
    ChildClassSectionRowIn,
    ChildProgramRowIn,
    ChildRemovalLogRowIn,
    ChildRowIn,
    ChildSubjectRowIn,
    ClassRowIn,
    ClassSectionRowIn,
    ClassSectionSubjectRowIn,
    MigrationRowBase,
    ProgramRowIn,
    SchoolAcademicYearRowIn,
    SchoolClassRowIn,
    SchoolHolidayRowIn,
    SchoolSessionDetailsRowIn,
    SchoolVolunteerRowIn,
    SlotClassSectionRowIn,
    SlotClassSectionVolunteerRowIn,
    SlotRowIn,
)
from sessionops.services.migration.auth import validate_migration_token
from sessionops.services.migration.generic import migrate_row
from sessionops.services.migration.registry import TABLE_CONFIGS

router = Router(tags=["internal-migration"])

# Ninja rejects any (status_code, data) tuple whose status isn't pre-declared
# here — every route below returns one of these five, so this is shared rather
# than repeated per route.
_RESPONSE_SPEC = {200: dict, 201: dict, 400: dict, 401: dict, 422: dict}

# URL path segment -> Pydantic input schema. Must have exactly the same keys
# as TABLE_CONFIGS (registry.py) — the parametrized registry test and the
# route-registration loop below both assume that.
_SCHEMAS: dict[str, type[MigrationRowBase]] = {
    "programs": ProgramRowIn,
    "academic-years": AcademicYearRowIn,
    "classes": ClassRowIn,
    "school-academic-years": SchoolAcademicYearRowIn,
    "school-classes": SchoolClassRowIn,
    "school-volunteers": SchoolVolunteerRowIn,
    "school-session-details": SchoolSessionDetailsRowIn,
    "school-holidays": SchoolHolidayRowIn,
    "class-sections": ClassSectionRowIn,
    "children": ChildRowIn,
    "child-classes": ChildClassRowIn,
    "child-class-sections": ChildClassSectionRowIn,
    "child-removal-logs": ChildRemovalLogRowIn,
    "class-section-subjects": ClassSectionSubjectRowIn,
    "child-subjects": ChildSubjectRowIn,
    "batch-children": BatchChildRowIn,
    "child-programs": ChildProgramRowIn,
    "slots": SlotRowIn,
    "slot-class-sections": SlotClassSectionRowIn,
    "slot-class-section-volunteers": SlotClassSectionVolunteerRowIn,
}

assert _SCHEMAS.keys() == TABLE_CONFIGS.keys(), (
    "migration_api._SCHEMAS and registry.TABLE_CONFIGS must cover exactly the "
    f"same tables. Mismatch: {_SCHEMAS.keys() ^ TABLE_CONFIGS.keys()}"
)


def _handle(request, table: str):
    auth_header = request.headers.get("Authorization", "")
    if not validate_migration_token(auth_header):
        return 401, {
            "status": "error",
            "error": "Valid migration service token required",
        }

    # Parsed manually (not via a typed `payload: Schema` param) so a schema
    # violation returns exactly the milestone spec's 400 shape, rather than
    # Ninja's own request-validation 422 from the global exception handler.
    try:
        raw_body = json.loads(request.body)
    except (json.JSONDecodeError, UnicodeDecodeError):
        return 400, {
            "status": "invalid",
            "table": table,
            "error": "Request body is not valid JSON",
            "action": "skip",
        }

    schema_cls = _SCHEMAS[table]
    try:
        payload = schema_cls.model_validate(raw_body)
    except PydanticValidationError as exc:
        return 400, {
            "status": "invalid",
            "table": table,
            "error": str(exc),
            "action": "skip",
        }

    # created_by_id/updated_by_id are accepted (the real n8n export includes
    # them) but never handed to the engine — always the migration actor, not
    # the payload's value. created_at/updated_at are handled specially inside
    # migrate_row() itself (see SYSTEM_MANAGED_FIELDS' docstring in
    # schemas/migration.py for the full reasoning).
    dump = payload.model_dump()
    for field_name in SYSTEM_MANAGED_FIELDS:
        dump.pop(field_name, None)

    result = migrate_row(TABLE_CONFIGS[table], dump)

    if result.status == "inserted":
        return 201, {
            "status": "inserted",
            "table": table,
            "pk": result.pk,
            "warnings": result.warnings,
        }
    if result.status == "updated":
        return 200, {
            "status": "updated",
            "table": table,
            "pk": result.pk,
            "changes": result.changes,
            "warnings": result.warnings,
        }
    # skipped -> orphan_fk (the only other MigrationResult.status the engine returns
    # without raising; a real exception still propagates to the 500 handler)
    return 422, {
        "status": "skipped",
        "table": table,
        "pk": result.pk,
        "reason": result.reason,
        "detail": result.detail,
        "action": "skip",
    }


def _register_route(table: str) -> None:
    def handler(request):
        return _handle(request, table)

    handler.__name__ = f"migrate_{table.replace('-', '_')}"
    router.post(f"/{table}/", auth=None, response=_RESPONSE_SPEC)(handler)


for _table in TABLE_CONFIGS:
    _register_route(_table)
