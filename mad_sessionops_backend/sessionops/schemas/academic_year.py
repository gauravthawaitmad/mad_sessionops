from datetime import datetime
import re

from ninja import Schema
from pydantic import field_validator


class AcademicYearOut(Schema):
    academic_year_id: int
    label: str
    is_active: bool
    created_at: datetime


class AcademicYearCreateIn(Schema):
    label: str

    @field_validator("label")
    @classmethod
    def validate_label(cls, v: str) -> str:
        if not re.match(r"^\d{4}-\d{4}$", v):
            raise ValueError("label must be in YYYY-YYYY format (e.g. 2026-2027)")
        parts = v.split("-")
        if int(parts[1]) != int(parts[0]) + 1:
            raise ValueError("second year must be exactly one more than first year")
        return v


class AcademicYearUpdateIn(Schema):
    label: str

    @field_validator("label")
    @classmethod
    def validate_label(cls, v: str) -> str:
        if not re.match(r"^\d{4}-\d{4}$", v):
            raise ValueError("label must be in YYYY-YYYY format (e.g. 2026-2027)")
        parts = v.split("-")
        if int(parts[1]) != int(parts[0]) + 1:
            raise ValueError("second year must be exactly one more than first year")
        return v
