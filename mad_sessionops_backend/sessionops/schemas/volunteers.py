from ninja import Schema


class VolunteerCardSchema(Schema):
    user_id: int
    user_display_name: str
    user_login: str
    user_role: str
    email: str
    contact: str | None = None
    city: str | None = None
    state: str | None = None
    active_slot_class_count: int


class VolunteerListResponseSchema(Schema):
    status: str
    message: str | None = None
    volunteers: list[VolunteerCardSchema]
