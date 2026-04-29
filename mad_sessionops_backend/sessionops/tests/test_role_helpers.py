import pytest

from sessionops.services.auth.role_helpers import (
    ADMIN_ROLES,
    ALLOWED_ROLES,
    get_allowed_roles,
    is_admin_role,
    parse_user_roles,
    user_has_admin_access,
)


class TestParseUserRoles:
    def test_single_role(self):
        assert parse_user_roles("CO Full Time") == ["CO Full Time"]

    def test_multiple_roles(self):
        assert parse_user_roles("CO Part Time,Wingman") == ["CO Part Time", "Wingman"]

    def test_strips_whitespace(self):
        assert parse_user_roles("  CO Full Time , CHO  ") == ["CO Full Time", "CHO"]

    def test_empty_string(self):
        assert parse_user_roles("") == []

    def test_blank_string(self):
        assert parse_user_roles("   ") == []

    def test_skips_empty_segments(self):
        assert parse_user_roles("CO Full Time,,CHO") == ["CO Full Time", "CHO"]


class TestGetAllowedRoles:
    def test_co_full_time_allowed(self):
        assert get_allowed_roles("CO Full Time") == ["CO Full Time"]

    def test_disallowed_role_excluded(self):
        assert get_allowed_roles("Wingman") == []

    def test_mixed_returns_only_allowed(self):
        result = get_allowed_roles("CO Part Time,Wingman,Fellow")
        assert result == ["CO Part Time"]

    def test_all_allowed(self):
        result = get_allowed_roles("CO Full Time,Function Lead")
        assert set(result) == {"CO Full Time", "Function Lead"}

    def test_empty_role_string(self):
        assert get_allowed_roles("") == []

    def test_unassigned_user_excluded(self):
        assert get_allowed_roles("Unassigned User") == []


class TestIsAdminRole:
    def test_function_lead_is_admin(self):
        assert is_admin_role("Function Lead") is True

    def test_project_associate_is_admin(self):
        assert is_admin_role("Project Associate") is True

    def test_project_lead_is_admin(self):
        assert is_admin_role("Project Lead") is True

    def test_co_is_not_admin(self):
        assert is_admin_role("CO Full Time") is False

    def test_cho_is_not_admin(self):
        assert is_admin_role("CHO") is False

    def test_wingman_is_not_admin(self):
        assert is_admin_role("Wingman") is False


class TestUserHasAdminAccess:
    def test_admin_role_grants_access(self):
        assert user_has_admin_access("Function Lead") is True

    def test_co_with_admin_role_grants_access(self):
        assert user_has_admin_access("CO Full Time,Project Lead") is True

    def test_co_alone_no_admin(self):
        assert user_has_admin_access("CO Full Time") is False

    def test_empty_no_admin(self):
        assert user_has_admin_access("") is False

    def test_disallowed_roles_no_admin(self):
        assert user_has_admin_access("Wingman,Fellow") is False
