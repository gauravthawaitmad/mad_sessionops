from ninja import Schema
from pydantic import field_validator

from sessionops.models.class_section import SECTION_CODES

# ── Class catalog ──────────────────────────────────────────────────────────────


class ClassCatalogItemOut(Schema):
    class_id: int
    class_name: str
    class_code: str
    program_name: str

    @staticmethod
    def resolve_class_id(obj) -> int:
        return int(obj.class_id)

    @staticmethod
    def resolve_program_name(obj) -> str:
        return str(obj.program_id.program_name)


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
        return int(obj.class_id_id)

    @staticmethod
    def resolve_class_name(obj) -> str:
        return str(obj.class_id.class_name)

    @staticmethod
    def resolve_class_code(obj) -> str:
        return str(obj.class_id.class_code)

    @staticmethod
    def resolve_program_name(obj) -> str:
        return str(obj.class_id.program_id.program_name)

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
    school_academic_year_id: int | None
    active_children_count: int

    @staticmethod
    def resolve_school_academic_year_id(obj) -> int | None:
        say_id = obj.school_academic_year_id_id
        return int(say_id) if say_id is not None else None

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


# ── Buckets (F-M6-2) ─────────────────────────────────────────────────────────────


class BucketAddIn(Schema):
    display_name: str | None = None


class BucketEditIn(Schema):
    display_name: str | None = None


class BucketOut(Schema):
    class_section_id: int
    section_name: str
    section_display_name: str | None
    school_id: int
    school_class_id: int | None  # legacy-row backward-compat only; never set by bucket writes
    school_academic_year_id: int | None
    active_children_count: int
    is_active: bool

    @staticmethod
    def resolve_school_class_id(obj) -> int | None:
        school_class_id = obj.school_class_id_id
        return int(school_class_id) if school_class_id is not None else None

    @staticmethod
    def resolve_school_academic_year_id(obj) -> int | None:
        say_id = obj.school_academic_year_id_id
        return int(say_id) if say_id is not None else None

    @staticmethod
    def resolve_active_children_count(obj) -> int:
        return getattr(obj, "active_children_count", 0)


# ── Bucket-children membership (F-M6-3) ─────────────────────────────────────────


class BucketChildAddIn(Schema):
    child_id: int


class BucketChildOut(Schema):
    child_class_section_id: int
    child_id: int
    class_section_id: int

    @staticmethod
    def resolve_child_id(obj) -> int:
        return int(obj.child_id_id)

    @staticmethod
    def resolve_class_section_id(obj) -> int:
        return int(obj.class_section_id_id)
