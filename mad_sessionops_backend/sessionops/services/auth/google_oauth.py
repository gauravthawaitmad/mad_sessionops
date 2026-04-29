"""
Google OAuth helper for F01a — Authorization Code + PKCE flow.

Single public entry point: exchange_code_for_id_token(code, code_verifier, redirect_uri)
Returns the verified id_token claims dict.
Raises AuthenticationError on every failure — callers never see raw OAuth errors.
"""

import os

import requests
from google.auth.transport import requests as google_requests
from google.oauth2 import id_token as google_id_token

from sessionops.exceptions import AuthenticationError

_GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token"


def exchange_code_for_id_token(code: str, code_verifier: str, redirect_uri: str) -> dict:
    """
    Exchange a PKCE authorization code for a verified id_token claims dict.

    Raises AuthenticationError if:
    - Google rejects the code exchange
    - The id_token is missing or fails verification
    - email_verified is not True
    """
    client_id = os.environ["GOOGLE_CLIENT_ID"]
    client_secret = os.environ["GOOGLE_CLIENT_SECRET"]

    # Step 1: Exchange code for tokens at Google's token endpoint.
    try:
        resp = requests.post(
            _GOOGLE_TOKEN_URL,
            data={
                "code": code,
                "client_id": client_id,
                "client_secret": client_secret,
                "redirect_uri": redirect_uri,
                "grant_type": "authorization_code",
                "code_verifier": code_verifier,
            },
            timeout=10,
        )
    except requests.RequestException as exc:
        raise AuthenticationError(
            "Could not reach Google authentication servers.",
            error_code="GOOGLE_UNREACHABLE",
        ) from exc

    if not resp.ok:
        error = resp.json().get("error", "unknown")
        raise AuthenticationError(
            f"Google rejected the authorization code: {error}",
            error_code="GOOGLE_CODE_REJECTED",
        )

    token_data = resp.json()
    id_token_str = token_data.get("id_token")
    if not id_token_str:
        raise AuthenticationError(
            "Google did not return an id_token.",
            error_code="GOOGLE_ID_TOKEN_MISSING",
        )

    # Step 2: Verify the id_token signature and claims against Google's certs.
    try:
        claims = google_id_token.verify_oauth2_token(
            id_token_str,
            google_requests.Request(),
            client_id,
        )
    except ValueError as exc:
        raise AuthenticationError(
            "Google id_token failed verification.",
            error_code="GOOGLE_TOKEN_INVALID",
        ) from exc

    # Step 3: Require a Google-verified email (rejects unverified Gmail accounts).
    if not claims.get("email_verified"):
        raise AuthenticationError(
            "Google account email is not verified.",
            error_code="GOOGLE_EMAIL_UNVERIFIED",
        )

    return claims
