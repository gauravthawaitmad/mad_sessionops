from pydantic import field_validator
from ninja import Schema

from sessionops.models.class_section import SECTION_CODES


# ── Class catalog ──────────────────────────────────────────────────────────────

class ClassCatalogItemOut(Schema):
    class_id: int
    class_name: str
    class_code: str
    program_name: str

    @staticmethod
    def resolve_class_id(obj) -> int:
        return obj.class_id

    @staticmethod
    def resolve_program_name(obj) -> str:
        return obj.program_id.program_name


class ClassAddIn(Schema):
    class_id: int


# ── School class (per-school class instance) ───────────────────────────────────

class SchoolClassOut(Schema):
    school_class_id: int
    class_id: int
    class_name: str
    class_code: str
    program_name: str
    sections_count: int
    sections: list = []

    @staticmethod
    def resolve_class_id(obj) -> int:
        return obj.class_id_id

    @staticmethod
    def resolve_class_name(obj) -> str:
        return obj.class_id.class_name

    @staticmethod
    def resolve_class_code(obj) -> str:
        return obj.class_id.class_code

    @staticmethod
    def resolve_program_name(obj) -> str:
        return obj.class_id.program_id.program_name

    @staticmethod
    def resolve_sections_count(obj) -> int:
        return getattr(obj, "sections_count", 0)

    @staticmethod
    def resolve_sections(obj) -> list:
        return []


# ── Section ────────────────────────────────────────────────────────────────────

class SectionOut(Schema):
    class_section_id: int
    section_code: str
    section_name: str
    active_children_count: int

    @staticmethod
    def resolve_active_children_count(obj) -> int:
        return getattr(obj, "active_children_count", 0)


class SectionAddIn(Schema):
    section_code: str

    @field_validator("section_code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        if v not in SECTION_CODES:
            raise ValueError(f"section_code must be one of {SECTION_CODES}")
        return v


class AvailableCodesOut(Schema):
    codes: list[str]
