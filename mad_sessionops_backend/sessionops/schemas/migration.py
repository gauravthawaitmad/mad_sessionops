from datetime import date, datetime, time
from typing import Optional

from pydantic import BaseModel, ConfigDict, field_validator

# Session-Ops's own audit columns exist on every migrated model. The real n8n
# export includes them (it mirrors the destination table's shape), so every
# schema must accept them.
#
# created_by_id/updated_by_id are stripped before reaching the engine (see
# migration_api.py::_handle) — they're always the migration actor
# (system_user.py), never the payload's value.
#
# created_at/updated_at are NOT stripped here — they're passed through to
# services/migration/generic.py, which pops them out of the normal
# create/update flow and reapplies them via a queryset .update() bypass, since
# Django's auto_now_add/auto_now would otherwise silently overwrite them with
# the current time on every save() regardless of what's sent.
#
# deleted_at is different again — a plain nullable field, not auto-managed —
# so it's kept and used completely normally; it may carry a real Bubble
# soft-delete timestamp worth preserving.
SYSTEM_MANAGED_FIELDS = ("created_by_id", "updated_by_id")


class MigrationRowBase(BaseModel):
    """Shared base for all migration loader input schemas.

    `extra="forbid"` so a dbt column-name typo or renamed field fails loudly as
    a 400 instead of silently being dropped (same convention as M8a's
    RealtimeSyncUserPayload). Empty strings coerce to None defensively, since
    dbt is supposed to have already done this (per M7.md decision #4) but
    Bubble/Hasura data is not always clean.
    """

    model_config = ConfigDict(extra="forbid")

    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by_id: Optional[int] = None
    updated_by_id: Optional[int] = None
    deleted_at: Optional[datetime] = None

    @field_validator("*", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        return None if v == "" else v


class ProgramRowIn(MigrationRowBase):
    program_id: int
    program_name: str
    is_active: bool = True
    removed: bool = False


class AcademicYearRowIn(MigrationRowBase):
    academic_year_id: int
    label: str
    is_active: bool = False
    removed: bool = False


class ClassRowIn(MigrationRowBase):
    class_id: int
    class_name: str
    class_code: str
    program_id: int
    is_active: bool = True
    removed: bool = False


class SchoolAcademicYearRowIn(MigrationRowBase):
    school_academic_year_id: int
    school_id: int
    academic_year_id: int
    is_active: bool = True
    removed: bool = False


class SchoolClassRowIn(MigrationRowBase):
    school_class_id: int
    school_id: int
    school_academic_year_id: int
    class_id: int
    is_active: bool = True
    removed: bool = False


class SchoolVolunteerRowIn(MigrationRowBase):
    school_volunteer_id: int
    school_id: int
    volunteer_id: int
    school_academic_year_id: Optional[int] = None
    is_active: bool = True
    removed: bool = False


class SchoolSessionDetailsRowIn(MigrationRowBase):
    session_id: int
    school_id: int
    school_academic_year: int
    start_date: date
    end_date: date
    is_active: bool = True
    removed: bool = False


class SchoolHolidayRowIn(MigrationRowBase):
    school_holiday_id: int
    school_id: int
    holiday_reason: str
    start_date: date
    end_date: date
    holiday_description: Optional[str] = None
    remarks: Optional[str] = None
    is_active: bool = True
    removed: bool = False


class ClassSectionRowIn(MigrationRowBase):
    class_section_id: int
    school_id: int
    school_class_id: Optional[int] = None  # optional post-M6 (bucket-agnostic)
    section_code: Optional[str] = None  # optional post-M6
    section_name: str  # normalized slug, computed by dbt per decision #16
    section_display_name: Optional[str] = None
    is_active: bool = True
    removed: bool = False


class ChildRowIn(MigrationRowBase):
    child_id: int
    school_id: int
    first_name: str
    last_name: str
    gender: str
    date_of_birth: Optional[date] = None
    age: Optional[int] = None
    city: Optional[str] = None
    mother_tongue: Optional[str] = None
    date_of_enrollment: Optional[date] = None
    mad_joining_date: Optional[date] = None
    is_active: bool = True
    removed: bool = False


class ChildClassRowIn(MigrationRowBase):
    child_class_id: int
    child_id: int
    school_class_id: int
    is_active: bool = True
    removed: bool = False


class ChildClassSectionRowIn(MigrationRowBase):
    child_class_section_id: int
    child_id: int
    class_section_id: int
    is_active: bool = True
    removed: bool = False


class ChildRemovalLogRowIn(MigrationRowBase):
    child_removal_log_id: int
    child_id: int
    co_id: int  # loose reference to User.user_id — warn-only, see registry.py
    school_id: int
    removed_reason: str
    other_details: Optional[str] = None
    removed_datetime: datetime
    is_active: bool = True
    removed: bool = False


class ClassSectionSubjectRowIn(MigrationRowBase):
    class_section_subject_id: int
    class_section_id: int
    subject_id: int
    is_active: bool = True
    removed: bool = False


class ChildSubjectRowIn(MigrationRowBase):
    child_subject_id: int
    child_id: int
    class_section_subject_id: int
    is_active: bool = True
    removed: bool = False


class BatchChildRowIn(MigrationRowBase):
    batch_child_id: int
    school_academic_year_id: int
    child_id: int
    school_id: int
    is_active: bool = True
    removed: bool = False


class ChildProgramRowIn(MigrationRowBase):
    child_program_id: int
    program_id: int
    child_id: int
    is_active: bool = True
    removed: bool = False


class SlotRowIn(MigrationRowBase):
    slot_id: int
    school_id: int
    school_academic_year_id: int
    slot_name: str
    day_of_week: str
    start_time: time
    end_time: time
    recurring: bool = True
    is_active: bool = True
    removed: bool = False


class SlotClassSectionRowIn(MigrationRowBase):
    slot_class_section_id: int
    slot_id: int
    class_section_id: int
    class_section_subject_id: int
    is_active: bool = True
    removed: bool = False


class SlotClassSectionVolunteerRowIn(MigrationRowBase):
    slot_class_section_volunteer_id: int
    slot_class_section_id: int
    volunteer_id: int
    is_active: bool = True
    removed: bool = False
