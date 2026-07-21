import logging
import os
from datetime import datetime, timezone
from typing import cast

import requests

logger = logging.getLogger(__name__)


class HasuraError(Exception):
    """Raised when Hasura returns a non-200 response."""


def _base_url() -> str:
    url = os.environ.get("HASURA_API_BASE_URL", "").rstrip("/")
    if not url:
        raise RuntimeError("HASURA_API_BASE_URL is not set")
    return url


def _jwt() -> str:
    token = os.environ.get("HASURA_API_JWT", "")
    if not token:
        raise RuntimeError("HASURA_API_JWT is not set")
    return token


def _headers() -> dict:
    return {"Authorization": f"Bearer {_jwt()}"}


def _parse_user_id(raw: str) -> int:
    """Strip Hasura's decimal suffix ('2273058.000000000' → 2273058) and parse."""
    return int(float(raw))


def fetch_users() -> list[dict]:
    """
    Fetch all users from Hasura REST API.

    Returns the list of user dicts from prod_external_apps_user_data.
    Parses user_id from decimal string to int.
    Raises HasuraError on non-200 response.
    """
    url = f"{_base_url()}/api/rest/user_data"
    response = requests.get(url, headers=_headers(), timeout=60)

    if response.status_code != 200:
        raise HasuraError(
            f"Hasura /user_data returned {response.status_code}: {response.text[:500]}"
        )

    rows = response.json().get("prod_external_apps_user_data", [])

    for row in rows:
        if "user_id" in row and row["user_id"] is not None:
            row["user_id"] = _parse_user_id(str(row["user_id"]))

    return cast(list, rows)


def fetch_chapter_mapping() -> list[dict]:
    """
    Fetch all chapter → worknode mappings from Hasura REST API.

    Returns the list of dicts from prod_external_apps_chapter_mapping.
    Only rows with chapter_validation=true are returned by the query param.
    Raises HasuraError on non-200 response.
    """
    url = f"{_base_url()}/api/rest/chapter_mapping"
    params = {"chapter_validation": "true"}
    response = requests.get(url, headers=_headers(), params=params, timeout=60)

    if response.status_code != 200:
        raise HasuraError(
            f"Hasura /chapter_mapping returned {response.status_code}: {response.text[:500]}"
        )

    return cast(list, response.json().get("prod_external_apps_chapter_mapping", []))


def _fmt_cursor(ts: datetime) -> str:
    """Format a cursor timestamp for Hasura: UTC, millisecond precision, no tz offset.

    Including milliseconds ensures Hasura's strict > comparison doesn't re-fetch
    a row whose updated_at equals the cursor to the second but differs in ms.
    Timezone suffix is omitted — Hasura REST treats it inconsistently.
    """
    from datetime import timezone as _tz

    utc = ts.astimezone(_tz.utc)
    ms = utc.microsecond // 1000
    return utc.strftime("%Y-%m-%dT%H:%M:%S") + f".{ms:03d}"


def fetch_users_updated_after(timestamp=None) -> list[dict]:
    """
    Incremental user fetch from Hasura.

    GET /api/rest/getusersupdatedafter
    If timestamp is None, no updated_after param is sent → Hasura returns all records (first run).
    Parses user_id decimal string to int.
    Raises HasuraError on non-200 response.
    """
    url = f"{_base_url()}/api/rest/getusersupdatedafter"
    params = {}
    if timestamp is not None:
        params["updated_after"] = _fmt_cursor(timestamp)
        logger.info("fetch_users_updated_after cursor=%s", params["updated_after"])

    response = requests.get(url, headers=_headers(), params=params, timeout=30)
    if response.status_code != 200:
        raise HasuraError(
            f"Hasura /getusersupdatedafter returned {response.status_code}: {response.text[:500]}"
        )

    body = response.json()
    logger.info("fetch_users_updated_after response keys=%s", list(body.keys()))
    rows = body.get("prod_external_apps_user_data", [])
    if not rows:
        logger.warning(
            "fetch_users_updated_after: 'prod_external_apps_user_data' key returned empty — full keys: %s",
            list(body.keys()),
        )
    for row in rows:
        if "user_id" in row and row["user_id"] is not None:
            row["user_id"] = _parse_user_id(str(row["user_id"]))
    logger.info("fetch_users_updated_after returning %d rows", len(rows))
    return cast(list, rows)


def fetch_partners_updated_after(timestamp=None) -> list[dict]:
    """
    Incremental partner fetch from Hasura.

    GET /api/rest/partner_data — updated_after is non-nullable on the Hasura side,
    so we always send it. When timestamp is None (first ever run) we use a far-past
    fallback date to get the full dataset.
    Raises HasuraError on non-200 response.
    """
    url = f"{_base_url()}/api/rest/partner_data"
    effective_ts = timestamp if timestamp is not None else datetime(2006, 1, 1, tzinfo=timezone.utc)
    params = {"updated_after": _fmt_cursor(effective_ts)}
    logger.info(
        "fetch_partners_updated_after cursor=%s (original=%s)", params["updated_after"], timestamp
    )

    response = requests.get(url, headers=_headers(), params=params, timeout=30)
    if response.status_code != 200:
        raise HasuraError(
            f"Hasura /partner_data returned {response.status_code}: {response.text[:500]}"
        )

    body = response.json()
    logger.info("fetch_partners_updated_after response keys=%s", list(body.keys()))
    rows = body.get("prod_external_apps_partner_data", [])
    if not rows:
        logger.warning(
            "fetch_partners_updated_after: key returned empty — full keys: %s", list(body.keys())
        )
    logger.info("fetch_partners_updated_after returning %d rows", len(rows))
    return cast(list, rows)


def fetch_user_by_login(user_login: str) -> dict | None:
    """
    Find a single user from Hasura by login email (case-insensitive).

    Uses the bulk user_data endpoint and filters locally, because Hasura stores
    user_login with mixed case (e.g. 'Gaurav.Thwait@makeadiff.in') while our DB
    normalises to lowercase — a dedicated by-login endpoint would miss the match.
    Returns the user dict if found, or None.
    Raises HasuraError on non-200 response.
    """
    rows = fetch_users()
    login_lower = (user_login or "").lower().strip()
    for row in rows:
        if (row.get("user_login") or "").lower().strip() == login_lower:
            return row
    return None


def fetch_partners(updated_after: datetime | None = None) -> list[dict]:
    """
    Fetch all partners from Hasura REST API.

    For M1: updated_after defaults to 2006-01-01 to fetch the full dataset.
    Raises HasuraError on non-200 response.
    """
    if updated_after is None:
        # M1: fetch everything
        updated_after = datetime(2006, 1, 1, tzinfo=timezone.utc)

    url = f"{_base_url()}/api/rest/partner_data"
    params = {"updated_after": updated_after.isoformat()}
    response = requests.get(url, headers=_headers(), params=params, timeout=60)

    if response.status_code != 200:
        raise HasuraError(
            f"Hasura /partner_data returned {response.status_code}: {response.text[:500]}"
        )

    return cast(list, response.json().get("prod_external_apps_partner_data", []))
