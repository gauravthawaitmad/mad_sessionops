from django.contrib import admin
from django.utils import timezone
from django.utils.html import format_html

from sessionops.models import User, UserAuth


class UserAuthInline(admin.TabularInline):
    model = UserAuth
    fk_name = "user"  # required: UserAuth has two FKs to User (user + deleted_by)
    extra = 0
    can_delete = False  # use soft-delete, not hard-delete

    fields = [
        "auth_type",
        "auth_identifier",
        "google_email_verified",
        "is_active",
        "last_used_at",
        "created_at",
    ]
    readonly_fields = ["auth_identifier", "created_at", "last_used_at"]
    exclude = ["password_hash"]


@admin.register(User)
class UserAdmin(admin.ModelAdmin):
    list_display = [
        "user_id",
        "email",
        "user_display_name",
        "user_role",
        "city",
        "state",
        "auth_methods_display",
        "is_active",
        "user_created_datetime",
    ]
    list_display_links = ["user_id", "email"]
    list_filter = ["is_active", "user_role", "state", "city", "user_created_datetime"]
    search_fields = ["email", "user_display_name", "user_login", "contact"]
    ordering = ["-user_created_datetime"]
    list_per_page = 25

    fieldsets = [
        (
            "Identity",
            {"fields": ["email", "user_login", "user_display_name", "contact", "is_active"]},
        ),
        (
            "Role & Organization",
            {"fields": ["user_role", "added_by"]},
        ),
        (
            "Reporting Manager",
            {
                "fields": [
                    "reporting_manager_user_login",
                    "reporting_manager_role_code",
                    "reporting_manager_user_id",
                ],
                "classes": ["collapse"],
            },
        ),
        (
            "Location",
            {"fields": ["city", "state", "center"]},
        ),
        (
            "Soft-delete audit",
            {
                "fields": ["deleted_at", "deleted_by"],
                "classes": ["collapse"],
            },
        ),
        (
            "Timestamps",
            {
                "fields": ["user_created_datetime", "user_updated_datetime", "last_login_at"],
                "classes": ["collapse"],
            },
        ),
    ]

    readonly_fields = [
        "user_id",
        "user_created_datetime",
        "user_updated_datetime",
        "last_login_at",
        "deleted_at",
        "deleted_by",
    ]

    inlines = [UserAuthInline]

    @admin.display(description="Auth Methods")
    def auth_methods_display(self, obj):
        methods = obj.get_auth_methods()
        if not methods:
            return format_html('<span style="color: red;">None</span>')
        colours = {"password": "#28a745", "google": "#4285f4"}
        badges = []
        for method in methods:
            colour = colours.get(method, "#6c757d")
            badges.append(
                f'<span style="background:{colour};color:white;padding:2px 6px;'
                f'border-radius:3px;margin-right:4px;">{method}</span>'
            )
        return format_html("".join(badges))


@admin.register(UserAuth)
class UserAuthAdmin(admin.ModelAdmin):
    list_display = [
        "id",
        "user_link",
        "auth_type",
        "auth_identifier",
        "status_display",
        "last_used_at",
        "created_at",
    ]
    list_display_links = ["id"]
    list_filter = ["auth_type", "is_active", "google_email_verified", "created_at"]
    search_fields = ["user__email", "user__user_display_name", "auth_identifier"]
    ordering = ["-created_at"]
    list_per_page = 25

    fieldsets = [
        (
            "User Link",
            {"fields": ["user"]},
        ),
        (
            "Authentication",
            {"fields": ["auth_type", "auth_identifier", "google_email_verified"]},
        ),
        (
            "Status & Usage",
            {"fields": ["is_active", "last_used_at"]},
        ),
        (
            "Soft-delete audit",
            {
                "fields": ["deleted_at", "deleted_by"],
                "classes": ["collapse"],
            },
        ),
        (
            "Timestamps",
            {
                "fields": ["created_at", "updated_at"],
                "classes": ["collapse"],
            },
        ),
    ]

    exclude = ["password_hash"]
    readonly_fields = ["auth_identifier", "created_at", "updated_at", "last_used_at", "deleted_at", "deleted_by"]

    @admin.display(description="User")
    def user_link(self, obj):
        if obj.user:
            url = f"/admin/sessionops/user/{obj.user.user_id}/change/"
            return format_html('<a href="{}">{}</a>', url, obj.user.email)
        return "-"

    @admin.display(description="Status")
    def status_display(self, obj):
        if obj.is_active:
            return format_html(
                '<span style="background:#28a745;color:white;padding:2px 6px;border-radius:3px;">Active</span>'
            )
        return format_html(
            '<span style="background:#dc3545;color:white;padding:2px 6px;border-radius:3px;">Inactive</span>'
        )

    actions = ["soft_delete_selected", "restore_selected"]

    @admin.action(description="Soft-delete selected auth methods")
    def soft_delete_selected(self, request, queryset):
        count = queryset.filter(is_active=True).update(
            is_active=False,
            deleted_at=timezone.now(),
        )
        self.message_user(request, f"{count} auth method(s) soft-deleted.")

    @admin.action(description="Restore selected auth methods")
    def restore_selected(self, request, queryset):
        count = queryset.filter(is_active=False).update(
            is_active=True,
            deleted_at=None,
        )
        self.message_user(request, f"{count} auth method(s) restored.")


admin.site.site_header = "MAD Backend Administration"
admin.site.site_title = "MAD Admin"
admin.site.index_title = "Welcome to MAD Backend Admin"
