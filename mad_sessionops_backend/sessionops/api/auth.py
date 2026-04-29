"""
F01a auth endpoints: Google callback, refresh, logout, me.
"""

from ninja import Router
from ninja.responses import Response

from sessionops.auth import JwtAuth
from sessionops.schemas.auth import (
    GoogleCallbackSchema,
    LoginResponseSchema,
    LogoutSchema,
    RefreshResponseSchema,
    RefreshSchema,
    UserProfileSchema,
)
from sessionops.services.auth import complete_google_login
from sessionops.services.auth.role_helpers import get_allowed_roles, user_has_admin_access
from sessionops.services.auth.tokens import logout, refresh_access_token

auth_router = Router(tags=["Auth"])
_jwt = JwtAuth()


def _profile(user) -> UserProfileSchema:
    return UserProfileSchema(
        id=user.user_id,
        user_login=user.user_login,
        display_name=user.user_display_name,
        allowed_roles=get_allowed_roles(user.user_role),
        is_admin=user_has_admin_access(user.user_role),
    )


@auth_router.post("/google/callback", auth=None, response=LoginResponseSchema)
def google_callback(request, body: GoogleCallbackSchema):
    user, access, refresh_tok = complete_google_login(
        body.code, body.code_verifier, body.redirect_uri
    )
    return LoginResponseSchema(
        access_token=access,
        refresh_token=refresh_tok,
        user=_profile(user),
    )


@auth_router.post("/refresh", auth=None, response=RefreshResponseSchema)
def token_refresh(request, body: RefreshSchema):
    access = refresh_access_token(body.refresh_token)
    return RefreshResponseSchema(access_token=access)


@auth_router.post("/logout", auth=_jwt, response={204: None})
def do_logout(request, body: LogoutSchema):
    logout(body.refresh_token)
    return 204, None


@auth_router.get("/me", auth=_jwt, response=UserProfileSchema)
def me(request):
    return _profile(request.auth)
