from ninja import Schema
from pydantic import field_validator


def _validate_volunteer_ids(v: list[int]) -> list[int]:
    if len(v) < 1:
        raise ValueError("At least 1 volunteer required.")
    if len(v) > 5:
        raise ValueError("Maximum 5 volunteers allowed.")
    if len(v) != len(set(v)):
        raise ValueError("Volunteer IDs must be unique.")
    return v


class SlotClassCreateSchema(Schema):
    class_section_id: int
    volunteer_ids: list[int]

    @field_validator("volunteer_ids")
    @classmethod
    def validate_volunteer_ids(cls, v: list[int]) -> list[int]:
        return _validate_volunteer_ids(v)


class SlotClassUpdateSchema(Schema):
    class_section_id: int | None = None
    volunteer_ids: list[int] | None = None

    @field_validator("volunteer_ids")
    @classmethod
    def validate_volunteer_ids(cls, v: list[int] | None) -> list[int] | None:
        if v is None:
            return v
        return _validate_volunteer_ids(v)


class VolunteerInSlotClassSchema(Schema):
    user_id: int
    user_display_name: str
    user_role: str


class SlotClassReadSchema(Schema):
    slot_class_section_id: int
    class_section_id: int
    section_name: str
    section_display_name: str | None
    subject_name: str
    volunteers: list[VolunteerInSlotClassSchema]
    active_children_count: int


class SlotClassDeleteResponseSchema(Schema):
    slot_class_section_id: int
    deleted: bool
