from __future__ import annotations

from dataclasses import dataclass
from dataclasses import field as dc_field
from typing import Any, cast

from django.db import models, transaction

from sessionops.models import Partner, User
from sessionops.services.migration.registry import FkCheck, TableConfig
from sessionops.services.migration.system_user import get_migration_actor


@dataclass
class MigrationResult:
    status: str  # "inserted" | "updated" | "skipped"
    pk: Any = None
    changes: list[str] = dc_field(default_factory=list)
    warnings: list[str] = dc_field(default_factory=list)
    reason: str | None = None
    detail: str | None = None


def _fk_exists(check: FkCheck, value: Any) -> bool:
    if check.kind == "raw_int_to_partner":
        return Partner.objects.filter(partner_id=value).exists()
    if check.kind == "raw_int_to_user":
        return User.objects.filter(user_id=value).exists()
    assert check.target_model is not None, f"real_fk check for {check.field!r} missing target_model"
    return bool(cast(Any, check.target_model).objects.filter(pk=value).exists())


def _attname(model: type[models.Model], field_name: str) -> str:
    """
    Translate a payload/column key to the model's real Python attribute name.

    ForeignKey fields in this codebase are declared with a `name` that already
    matches the DB column (e.g. `program_id = ForeignKey(...)`), which differs
    from Django's `attname` (`program_id_id`) used to assign a raw integer PK
    directly. Assigning through `.name` instead raises
    `ValueError: must be a "<Model>" instance` — verified empirically against
    `Class(program_id=1)` before writing this. Non-relational fields have
    `attname == name`, so this is safe to apply uniformly.
    """
    try:
        return str(cast(Any, model._meta.get_field(field_name)).attname)
    except Exception:
        return field_name


def migrate_row(config: TableConfig, payload: dict) -> MigrationResult:
    payload = dict(payload)  # never mutate the caller's dict
    warnings: list[str] = []

    for check in config.required_fks:
        value = payload.get(check.field)
        if not _fk_exists(check, value):
            return MigrationResult(
                status="skipped",
                pk=payload.get(config.pk_field),
                reason="orphan_fk",
                detail=f"{check.field} {value!r} does not exist",
            )

    for check in config.optional_fks:
        value = payload.get(check.field)
        if value is not None and not _fk_exists(check, value):
            if check.null_on_missing:
                warnings.append(f"{check.field} {value!r} does not exist; set to null")
                payload[check.field] = None
            else:
                # e.g. child_removal_log.co_id — a NOT NULL "loose FK"; nulling
                # it would violate the column constraint, so warn and keep it.
                warnings.append(
                    f"{check.field} {value!r} does not exist; kept as-is (not a strict reference)"
                )

    pk_value = payload[config.pk_field]
    actor = get_migration_actor() if config.has_audit_fields else None

    attr_payload = {_attname(config.model, key): val for key, val in payload.items()}
    pk_attr = _attname(config.model, config.pk_field)

    # created_at/updated_at are Django auto_now_add/auto_now fields — Django
    # silently overwrites them with the current time on every save() regardless
    # of what's assigned on the instance, so leaving them in the normal
    # create/update flow can never actually preserve Bubble's original
    # timestamps. Pop them out here and apply them via a follow-up .update()
    # queryset call instead, which issues a direct SQL UPDATE and bypasses
    # those auto_now hooks entirely. This also keeps them out of the "changes"
    # comparison loop below, which would otherwise flag them as changed on
    # every idempotent re-run (Django already auto-stamped a different value
    # than whatever historical value Bubble provides).
    historical_created_at = attr_payload.pop("created_at", None)
    historical_updated_at = attr_payload.pop("updated_at", None)

    with transaction.atomic():
        existing = cast(Any, config.model).objects.filter(**{pk_attr: pk_value}).first()
        if existing:
            changes = []
            for key, new_val in attr_payload.items():
                if key == pk_attr or key in config.immutable_on_update:
                    continue
                if getattr(existing, key, None) != new_val:
                    setattr(existing, key, new_val)
                    changes.append(key)
            if changes:
                if actor is not None:
                    existing.updated_by_id = actor.pk
                existing.save()
            # created_at is immutable after first insert — only updated_at is
            # ever re-applied on an update.
            if historical_updated_at is not None:
                cast(Any, config.model).objects.filter(**{pk_attr: pk_value}).update(
                    updated_at=historical_updated_at
                )
            return MigrationResult(
                status="updated", pk=pk_value, changes=changes, warnings=warnings
            )
        else:
            create_kwargs = dict(attr_payload)
            if actor is not None:
                create_kwargs["created_by_id"] = actor.pk
            obj = config.model(**create_kwargs)
            obj.save(force_insert=True)
            bypass_updates = {}
            if historical_created_at is not None:
                bypass_updates["created_at"] = historical_created_at
            if historical_updated_at is not None:
                bypass_updates["updated_at"] = historical_updated_at
            if bypass_updates:
                cast(Any, config.model).objects.filter(**{pk_attr: pk_value}).update(
                    **bypass_updates
                )
            return MigrationResult(status="inserted", pk=pk_value, warnings=warnings)
