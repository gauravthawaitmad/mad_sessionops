from ninja import Schema
from pydantic import model_validator


class SlotClassCreateSchema(Schema):
    class_section_id: int
    subject_id: int
    volunteer_1_id: int
    volunteer_2_id: int | None = None

    @model_validator(mode="after")
    def vol1_ne_vol2(self):
        if self.volunteer_2_id and self.volunteer_1_id == self.volunteer_2_id:
            raise ValueError("Vol1 and Vol2 cannot be the same volunteer.")
        return self


class SlotClassUpdateSchema(Schema):
    volunteer_1_id:   int | None = None
    volunteer_2_id:   int | None = None
    class_section_id: int | None = None
    subject_id:       int | None = None


class VolunteerInSlotClassSchema(Schema):
    user_id: int
    user_display_name: str
    user_role: str


class SlotClassReadSchema(Schema):
    slot_class_section_id: int
    class_section_id: int
    section_name: str
    subject_name: str
    volunteers: list[VolunteerInSlotClassSchema]
    active_children_count: int


class SlotClassDeleteResponseSchema(Schema):
    slot_class_section_id: int
    deleted: bool
