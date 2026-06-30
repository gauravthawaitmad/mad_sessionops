"""
Realtime sync flow handlers.

Each function receives (local_user, payload, diff, user_id) and returns a FlowResult.
The orchestrator calls the correct handler based on the classified event type.

Thin wrappers live here; real implementations are in insert.py, update.py, cascade.py, deactivate.py.
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class FlowResult:
    status: str
    action_taken: str
    cascaded_changes: list = field(default_factory=list)
    rules_fired: list = field(default_factory=list)
    deferred_operations: Optional[dict] = None
    error_details: Optional[str] = None


def handle_insert(local_user, payload, diff, user_id: int) -> FlowResult:
    from sessionops.services.realtime_sync.flows.insert import handle_insert as _real

    return _real(local_user, payload, diff, user_id)


def handle_update(local_user, payload, diff, user_id: int) -> FlowResult:
    from sessionops.services.realtime_sync.flows.update import handle_update as _real

    return _real(local_user, payload, diff, user_id)


def handle_deactivate(local_user, payload, diff, user_id: int) -> FlowResult:
    from sessionops.services.realtime_sync.flows.deactivate import handle_deactivate as _real

    return _real(local_user, payload, diff, user_id)
