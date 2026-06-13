from datetime import date, datetime
from typing import Optional

from ninja import Schema


class SessionDefaultsOut(Schema):
    default_start_date: Optional[date] = None
    default_end_date: Optional[date] = None
    academic_year_label: str


class SessionCreateIn(Schema):
    start_date: date
    end_date: date


class SessionOut(Schema):
    session_id: int
    school_id: int
    school_academic_year_id: int
    start_date: date
    end_date: date
    created_at: datetime
