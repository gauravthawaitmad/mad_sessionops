import os
import logging
from datetime import datetime, timezone

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

    return rows


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

    return response.json().get("prod_external_apps_chapter_mapping", [])


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

    return response.json().get("prod_external_apps_partner_data", [])
