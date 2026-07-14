from __future__ import annotations

from datetime import date
from typing import Literal

from ninja import Schema
from pydantic import model_validator


class ChildEnrollIn(Schema):
    first_name:         str
    last_name:          str
    gender:             Literal["male", "female", "other"]
    age:                int
    school_class_id:    int
    class_section_id:   int | None = None
    date_of_birth:      date | None = None
    city:               str | None = None
    mother_tongue:      str | None = None
    date_of_enrollment: date | None = None
    mad_joining_date:   date | None = None


class ChildEditIn(Schema):
    first_name:         str | None = None
    last_name:          str | None = None
    gender:             Literal["male", "female", "other"] | None = None
    age:                int | None = None
    school_class_id:    int | None = None
    class_section_id:   int | None = None
    date_of_birth:      date | None = None
    city:               str | None = None
    mother_tongue:      str | None = None
    date_of_enrollment: date | None = None
    mad_joining_date:   date | None = None


class DeactivateIn(Schema):
    removed_reason: Literal[
        "inactive", "duplicate_entry", "wrong_school_class", "transferred",
        "dropped_out", "family_declined", "child_declined", "other",
    ]
    other_details: str | None = None

    @model_validator(mode="after")
    def require_details_for_other(self):
        if self.removed_reason == "other" and not self.other_details:
            raise ValueError("other_details is required when reason is 'other'")
        return self


class ReactivateIn(Schema):
    school_class_id:   int
    class_section_id:  int | None = None


class CurrentSectionOut(Schema):
    class_section_id: int
    section_display_name: str | None
    section_name: str


class CurrentSchoolClassOut(Schema):
    school_class_id: int
    class_name: str


class ChildOut(Schema):
    child_id:             int
    first_name:           str
    last_name:            str
    gender:               str
    age:                  int | None
    city:                 str | None
    mother_tongue:        str | None
    date_of_birth:        date | None
    date_of_enrollment:   date | None
    mad_joining_date:     date | None
    is_active:            bool
    current_section:      CurrentSectionOut | None
    current_school_class: CurrentSchoolClassOut | None

    @staticmethod
    def resolve_current_section(obj) -> CurrentSectionOut | None:
        sid = getattr(obj, "_current_section_id", None)
        if not sid:
            return None
        return CurrentSectionOut(
            class_section_id=sid,
            section_display_name=getattr(obj, "current_section_display_name", None),
            section_name=getattr(obj, "current_section_name", "") or "",
        )

    @staticmethod
    def resolve_current_school_class(obj) -> CurrentSchoolClassOut | None:
        cid = getattr(obj, "_current_school_class_id", None)
        if not cid:
            return None
        return CurrentSchoolClassOut(
            school_class_id=cid,
            class_name=getattr(obj, "current_class_name", "") or "",
        )
