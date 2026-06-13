from datetime import date, datetime
from typing import Literal, Optional

from ninja import Schema

HolidayReason = Literal["mad_event", "holidays", "cancelled_from_school_end"]


class HolidayCreateIn(Schema):
    holiday_reason: HolidayReason
    start_date: date
    end_date: date
    holiday_description: Optional[str] = None
    remarks: Optional[str] = None


class HolidayPatchIn(Schema):
    holiday_reason: Optional[HolidayReason] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    holiday_description: Optional[str] = None
    remarks: Optional[str] = None


class HolidayOut(Schema):
    school_holiday_id: int
    school_id: int
    holiday_reason: str
    holiday_reason_display: str
    start_date: date
    end_date: date
    holiday_description: Optional[str] = None
    remarks: Optional[str] = None
    created_at: datetime
    updated_at: datetime
