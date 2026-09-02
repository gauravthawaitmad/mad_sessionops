"""
Internal partner-worknode-sync trigger endpoint.

Lets an external scheduler (n8n) trigger partner-worknode sync on its own
schedule. Goes through the exact same trigger_entity_sync() path the admin
"Sync now" button uses (F-M4-7), so SyncRun audit rows, per-entity
concurrency guarding, and full-resync/delete semantics all apply identically
regardless of who triggered the run — pagination/upsert logic is untouched,
only the trigger source changes.

Security model (same as sync-partner-internal, sessionops/api/partner_sync_internal_api.py):
  - auth=None disables the default CustomJwtAuthMiddleware for this route.
  - Service-token-only — no admin JWT fallback. This endpoint has exactly one
    intended caller (the n8n workflow); admins already have
    POST /api/admin/sync/trigger/?entity=partner_worknode for JWT-authenticated
    manual use.
  - The endpoint URL is a non-guessable path set via
    PARTNER_WORKNODE_SYNC_ENDPOINT_PATH env var.
  - Service token value is never logged.
  - Deliberately a separate token from INTERNAL_SYNC_SERVICE_TOKEN /
    MIGRATION_SERVICE_TOKEN / PARTNER_SYNC_SERVICE_TOKEN — a leaked one must
    not grant the others' access.
"""

import logging

from ninja import Router

from sessionops.exceptions import AuthenticationError
from sessionops.models import SyncRun
from sessionops.services.sync.auth import validate_partner_worknode_sync_service_token
from sessionops.services.sync.trigger import trigger_entity_sync

_log = logging.getLogger(__name__)

router = Router(tags=["internal-partner-worknode-sync"])


@router.post("/", auth=None)
def trigger_partner_worknode_sync_endpoint(request):
    auth_header = request.headers.get("Authorization", "")
    if not validate_partner_worknode_sync_service_token(auth_header):
        raise AuthenticationError("Valid service token required")

    _log.info(
        "partner_worknode_sync: service token auth succeeded — triggering partner_worknode sync"
    )
    run_id = trigger_entity_sync(
        entity_type="partner_worknode", triggered_by=None, run_type=SyncRun.RUN_TYPE_AUTO
    )
    return {"partner_worknode_run_id": run_id}
