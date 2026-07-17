from typing import Optional

from pydantic import BaseModel, field_validator


class RealtimeSyncUserPayload(BaseModel):
    # Hasura source identity — user_id comes from the URL path, not the body
    user_login: str
    user_display_name: Optional[str] = None
    user_email: Optional[str] = None
    user_phone: Optional[str] = None
    user_role: Optional[str] = None
    worknode_id: Optional[int] = None
    # Renamed from is_active. Bool (or bool-like string). None treated as True in service layer.
    user_active_status: Optional[bool] = None

    # Location / org hierarchy fields
    city: Optional[str] = None
    center: Optional[str] = None
    state: Optional[str] = None
    reporting_manager_user_login: Optional[str] = None
    reporting_manager_role_code: Optional[str] = None
    reporting_manager_user_id: Optional[int] = None

    # Sync metadata
    event_type: str  # "insert" | "update" | "deactivate"
    x_modified_timestamp: Optional[str] = None  # ISO8601 from Hasura updated_at
    external_event_id: Optional[str] = None  # M8b dedup key
    sync_type: str = "manual_admin"  # "manual_admin" | "realtime_webhook"

    # Caller identity
    triggered_by_user_id: Optional[int] = None

    @field_validator("*", mode="before")
    @classmethod
    def empty_string_to_none(cls, v):
        if v == "":
            return None
        return v

    @field_validator("worknode_id", mode="before")
    @classmethod
    def coerce_worknode_id(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, int):
            return v
        if isinstance(v, str):
            try:
                return int(v.strip())
            except (ValueError, AttributeError):
                raise ValueError(f"worknode_id must be a valid integer, got: {v!r}")
        return v

    @field_validator("user_active_status", mode="before")
    @classmethod
    def coerce_user_active_status(cls, v):
        if v is None or v == "":
            return None
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            lower = v.strip().lower()
            if lower in ("true", "1", "yes"):
                return True
            if lower in ("false", "0", "no"):
                return False
            raise ValueError(f"user_active_status must be boolean-like, got: {v!r}")
        return v

    @field_validator("event_type", mode="before")
    @classmethod
    def validate_event_type(cls, v):
        valid = ("insert", "update", "deactivate")
        if isinstance(v, str) and v in valid:
            return v
        raise ValueError(f"event_type must be one of {valid}, got: {v!r}")
