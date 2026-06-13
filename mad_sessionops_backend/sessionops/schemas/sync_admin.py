"""Pydantic v2 schemas for the sync admin dashboard endpoints."""

from datetime import datetime
from typing import Optional

from ninja import Schema
from pydantic import Field


class SyncRunListItemOut(Schema):
    sync_run_id: int
    sync_type: Optional[str] = None    # model: run_type
    entity_type: Optional[str] = None
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    records_fetched: int

    @staticmethod
    def resolve_sync_run_id(obj) -> int:
        return obj.id

    @staticmethod
    def resolve_sync_type(obj) -> Optional[str]:
        return obj.run_type

    @staticmethod
    def resolve_records_fetched(obj) -> int:
        return (obj.users_fetched or 0) + (obj.partners_fetched or 0)


class SyncRunDetailOut(Schema):
    sync_run_id: int
    sync_type: Optional[str] = None
    entity_type: Optional[str] = None
    updated_after: Optional[datetime] = None
    cursor_end:    Optional[datetime] = None
    target_identifier: Optional[str] = None
    status: str
    started_at: datetime
    completed_at: Optional[datetime] = None
    records_fetched: int
    # Per-entity counts (exposed individually for activity log in frontend)
    users_fetched: int = 0
    users_created: int = 0
    users_updated: int = 0
    partners_fetched: int = 0
    partners_created: int = 0
    partners_updated: int = 0
    error_details: Optional[str] = None
    triggered_by_name: Optional[str] = None
    user_logins: Optional[list] = None
    partner_ids: Optional[list] = None

    @staticmethod
    def resolve_sync_run_id(obj) -> int:
        return obj.id

    @staticmethod
    def resolve_sync_type(obj) -> Optional[str]:
        return obj.run_type

    @staticmethod
    def resolve_records_fetched(obj) -> int:
        return (obj.users_fetched or 0) + (obj.partners_fetched or 0)

    @staticmethod
    def resolve_error_details(obj) -> Optional[str]:
        return obj.error_message

    @staticmethod
    def resolve_triggered_by_name(obj) -> Optional[str]:
        if obj.triggered_by_id is None:
            return None
        return obj.triggered_by.user_display_name


class EntityStatOut(Schema):
    total: int
    active: int
    inactive: int
    removed: int
    last_successful_sync: Optional[datetime] = None


class EntityStatsOut(Schema):
    user: EntityStatOut
    partner: EntityStatOut
    partner_worknode: EntityStatOut


class CronHealthOut(Schema):
    healthy: bool
    last_successful_sync_at: Optional[datetime] = None
    hours_since_last_success: Optional[float] = None
    next_expected_run: Optional[datetime] = None
    reason: Optional[str] = None


class AdminStatsOut(Schema):
    entity_stats: EntityStatsOut
    cron_health: CronHealthOut


class SyncUserByLoginIn(Schema):
    user_login: str = Field(max_length=254, description="User's login email address")


class SyncUserByLoginOut(Schema):
    sync_run_id: int
    user_login: str
    user_name: str


class SyncTriggerOut(Schema):
    user_run_id:             Optional[int] = None
    partner_run_id:          Optional[int] = None
    partner_worknode_run_id: Optional[int] = None
