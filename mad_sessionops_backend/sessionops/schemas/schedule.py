from ninja import Schema


class ScheduleVolunteerSchema(Schema):
    user_id: int
    user_display_name: str
    user_role: str


class ScheduleSlotClassSchema(Schema):
    slot_class_section_id: int
    section_name: str
    section_display_name: str | None
    subject_name: str
    volunteers: list[ScheduleVolunteerSchema]
    active_children_count: int


class ScheduleSlotSchema(Schema):
    slot_id: int
    slot_name: str
    start_time: str
    end_time: str
    slot_classes: list[ScheduleSlotClassSchema]


class ScheduleDaySchema(Schema):
    day_of_week: str
    slots: list[ScheduleSlotSchema]


class ScheduleResponseSchema(Schema):
    school_id: int
    school_name: str
    academic_year: str
    days: list[ScheduleDaySchema]
