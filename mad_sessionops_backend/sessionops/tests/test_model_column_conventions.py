"""
Guardrail for the FK "double-suffix" column bug (M7 schema-audit finding).

Django always exposes a ForeignKey's raw value in Python as `<field_name>_id`
regardless of `db_column`. If a field is itself already named `..._id`
(a convention used throughout this codebase, e.g. `child_id`, `slot_id`), and
no explicit `db_column` is set, Django silently doubles the suffix in
Postgres (e.g. `child_id_id`). This test fails if that ever happens again.
"""
from django.apps import apps


def _fk_fields_with_id_suffixed_name():
    for model in apps.get_app_config("sessionops").get_models():
        for field in model._meta.get_fields():
            if getattr(field, "many_to_one", False) and field.name.endswith("_id"):
                yield model, field


def test_no_double_suffixed_fk_columns():
    offenders = []
    for model, field in _fk_fields_with_id_suffixed_name():
        if field.column != field.name:
            offenders.append(
                f"{model.__name__}.{field.name} -> db column '{field.column}' "
                f"(expected '{field.name}'); add db_column=\"{field.name}\" to the field."
            )
    assert not offenders, (
        "Found FK field(s) with an auto-doubled Postgres column name. "
        "Any ForeignKey field named '..._id' must set db_column explicitly, "
        "or Django appends another '_id' to the real column:\n  " + "\n  ".join(offenders)
    )
