"""Unit tests for sessionops/admin.py display helpers."""

import pytest

from sessionops.admin import UserAuthAdmin
from sessionops.models import User, UserAuth


@pytest.mark.django_db
def test_user_auth_admin_user_link_renders_link_for_linked_user():
    user = User.objects.create(
        user_login="admin-link@test.com",
        user_display_name="Admin Link User",
        email="admin-link@test.com",
        user_role="Function Lead",
        is_active=True,
    )
    auth = UserAuth.objects.create(user=user, auth_type="google", auth_identifier="sub-123")

    html = UserAuthAdmin(UserAuth, None).user_link(auth)

    assert f"/django-admin/sessionops/user/{user.user_id}/change/" in html
    assert user.email in html


def test_user_auth_admin_user_link_returns_dash_when_user_is_none():
    class _FakeAuth:
        user = None

    html = UserAuthAdmin(UserAuth, None).user_link(_FakeAuth())

    assert html == "-"
