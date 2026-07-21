from datetime import time
from typing import Literal

from ninja import Schema


class SlotCreateSchema(Schema):
    day_of_week: Literal[
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ]
    start_time: time
    end_time: time


class SlotUpdateSchema(Schema):
    day_of_week: Literal[
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
    ] | None = None
    start_time: time | None = None
    end_time: time | None = None


class SlotDeleteResponseSchema(Schema):
    slot_id: int
    deleted: bool


class SlotReadSchema(Schema):
    slot_id: int
    slot_name: str
    day_of_week: str
    start_time: time
    end_time: time
    recurring: bool
    slot_class_count: int = 0
