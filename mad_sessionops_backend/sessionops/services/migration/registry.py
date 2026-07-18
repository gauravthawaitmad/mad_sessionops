from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

from django.db import models

from sessionops.models import (
    AcademicYear,
    BatchChild,
    Child,
    ChildClass,
    ChildClassSection,
    ChildProgram,
    ChildRemovalLog,
    ChildSubject,
    Class,
    ClassSection,
    ClassSectionSubject,
    Program,
    SchoolAcademicYear,
    SchoolClass,
    SchoolHoliday,
    SchoolSessionDetails,
    SchoolVolunteer,
    Slot,
    SlotClassSection,
    SlotClassSectionVolunteer,
    Subject,
    User,
)


@dataclass(frozen=True)
class FkCheck:
    field: str
    kind: Literal["real_fk", "raw_int_to_partner", "raw_int_to_user"]
    target_model: type[models.Model] | None = None  # required when kind == "real_fk"
    # For optional_fks only: whether an unresolved value gets nulled out (the
    # usual case — the underlying column is nullable, e.g. school_class_id on
    # class_section) or just warned about while the original value is kept
    # (e.g. child_removal_log.co_id, a NOT NULL "loose FK" per its own model
    # comment — nulling it would violate the column's NOT NULL constraint).
    null_on_missing: bool = True


@dataclass(frozen=True)
class TableConfig:
    model: type[models.Model]
    pk_field: str
    required_fks: tuple[FkCheck, ...] = ()
    optional_fks: tuple[FkCheck, ...] = ()
    immutable_on_update: frozenset[str] = frozenset()
    has_audit_fields: bool = True  # False only for child_removal_log (no created_by/updated_by)


# Keyed by URL path segment (matches docs/milestones/M7.md's endpoint list exactly).
# `subject` has no entry — it's not migrated (M7.md decision #18); class-section-subjects
# checks its subject_id against whatever Subject rows already exist.
TABLE_CONFIGS: dict[str, TableConfig] = {
    # ── Layer 0 ──────────────────────────────────────────────────────────────
    "programs": TableConfig(
        model=Program,
        pk_field="program_id",
    ),
    "academic-years": TableConfig(
        model=AcademicYear,
        pk_field="academic_year_id",
    ),
    "classes": TableConfig(
        model=Class,
        pk_field="class_id",
        required_fks=(FkCheck("program_id", "real_fk", Program),),
    ),
    "school-academic-years": TableConfig(
        model=SchoolAcademicYear,
        pk_field="school_academic_year_id",
        required_fks=(
            FkCheck("academic_year_id", "real_fk", AcademicYear),
            FkCheck("school_id", "raw_int_to_partner"),
        ),
    ),
    # ── Layer 1 ──────────────────────────────────────────────────────────────
    "school-classes": TableConfig(
        model=SchoolClass,
        pk_field="school_class_id",
        required_fks=(
            FkCheck("school_academic_year_id", "real_fk", SchoolAcademicYear),
            FkCheck("class_id", "real_fk", Class),
            FkCheck("school_id", "raw_int_to_partner"),
        ),
    ),
    "school-volunteers": TableConfig(
        model=SchoolVolunteer,
        pk_field="school_volunteer_id",
        required_fks=(
            FkCheck("volunteer_id", "real_fk", User),
            FkCheck("school_id", "raw_int_to_partner"),
        ),
        optional_fks=(FkCheck("school_academic_year_id", "real_fk", SchoolAcademicYear),),
    ),
    "school-session-details": TableConfig(
        model=SchoolSessionDetails,
        pk_field="session_id",
        required_fks=(
            # Field is named "school_academic_year" (no _id suffix) on this model —
            # verified directly against sessionops/models/session_details.py.
            FkCheck("school_academic_year", "real_fk", SchoolAcademicYear),
            FkCheck("school_id", "raw_int_to_partner"),
        ),
    ),
    "school-holidays": TableConfig(
        model=SchoolHoliday,
        pk_field="school_holiday_id",
        required_fks=(FkCheck("school_id", "raw_int_to_partner"),),
    ),
    "class-sections": TableConfig(
        model=ClassSection,
        pk_field="class_section_id",
        required_fks=(FkCheck("school_id", "raw_int_to_partner"),),
        # school_class_id is optional post-M6 (buckets are class-agnostic).
        optional_fks=(FkCheck("school_class_id", "real_fk", SchoolClass),),
    ),
    # ── Layer 2 ──────────────────────────────────────────────────────────────
    "children": TableConfig(
        model=Child,
        pk_field="child_id",
        required_fks=(FkCheck("school_id", "raw_int_to_partner"),),
    ),
    "child-classes": TableConfig(
        model=ChildClass,
        pk_field="child_class_id",
        required_fks=(
            FkCheck("child_id", "real_fk", Child),
            FkCheck("school_class_id", "real_fk", SchoolClass),
        ),
    ),
    "child-class-sections": TableConfig(
        model=ChildClassSection,
        pk_field="child_class_section_id",
        required_fks=(
            FkCheck("child_id", "real_fk", Child),
            FkCheck("class_section_id", "real_fk", ClassSection),
        ),
    ),
    "child-removal-logs": TableConfig(
        model=ChildRemovalLog,
        pk_field="child_removal_log_id",
        # school_id is NOT nullable on this model (same as every other table's
        # school_id) — required, per decision #15, same as everywhere else.
        required_fks=(
            FkCheck("child_id", "real_fk", Child),
            FkCheck("school_id", "raw_int_to_partner"),
        ),
        # co_id is the one exception: a documented "loose FK" to User (the
        # model's own comment) that is ALSO not nullable — warn-only, keep the
        # original value rather than null it out (decision #19).
        optional_fks=(FkCheck("co_id", "raw_int_to_user", null_on_missing=False),),
        has_audit_fields=False,  # this model has no created_by/updated_by fields at all
    ),
    "class-section-subjects": TableConfig(
        model=ClassSectionSubject,
        pk_field="class_section_subject_id",
        required_fks=(
            FkCheck("class_section_id", "real_fk", ClassSection),
            # Subject itself isn't migrated (decision #18) — this checks against
            # whatever Subject rows already exist (M6's seed + any manual additions).
            FkCheck("subject_id", "real_fk", Subject),
        ),
    ),
    "child-subjects": TableConfig(
        model=ChildSubject,
        pk_field="child_subject_id",
        required_fks=(
            FkCheck("child_id", "real_fk", Child),
            FkCheck("class_section_subject_id", "real_fk", ClassSectionSubject),
        ),
    ),
    "batch-children": TableConfig(
        model=BatchChild,
        pk_field="batch_child_id",
        required_fks=(
            FkCheck("school_academic_year_id", "real_fk", SchoolAcademicYear),
            FkCheck("child_id", "real_fk", Child),
            FkCheck("school_id", "raw_int_to_partner"),
        ),
    ),
    "child-programs": TableConfig(
        model=ChildProgram,
        pk_field="child_program_id",
        required_fks=(
            FkCheck("program_id", "real_fk", Program),
            FkCheck("child_id", "real_fk", Child),
        ),
    ),
    # ── Layer 3 ──────────────────────────────────────────────────────────────
    "slots": TableConfig(
        model=Slot,
        pk_field="slot_id",
        required_fks=(
            FkCheck("school_academic_year_id", "real_fk", SchoolAcademicYear),
            FkCheck("school_id", "raw_int_to_partner"),
        ),
    ),
    "slot-class-sections": TableConfig(
        model=SlotClassSection,
        pk_field="slot_class_section_id",
        required_fks=(
            FkCheck("slot_id", "real_fk", Slot),
            FkCheck("class_section_id", "real_fk", ClassSection),
            FkCheck("class_section_subject_id", "real_fk", ClassSectionSubject),
        ),
    ),
    "slot-class-section-volunteers": TableConfig(
        model=SlotClassSectionVolunteer,
        pk_field="slot_class_section_volunteer_id",
        required_fks=(
            FkCheck("slot_class_section_id", "real_fk", SlotClassSection),
            FkCheck("volunteer_id", "real_fk", User),
        ),
    ),
}
