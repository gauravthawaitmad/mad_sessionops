"""
Management command: set_user_password

Creates or updates a password-auth record for a Hasura-synced user.
Use this to set up test credentials on dev/staging without going through
the email-reset flow.

Usage:
    just shell
    >>> # Or run as a command:
    uv run python manage.py set_user_password --email co@example.com --password Secret123!
"""

from django.core.management.base import BaseCommand, CommandError

from sessionops.models import User, UserAuth


class Command(BaseCommand):
    help = "Create or update password auth for a user (dev/staging only)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--email",
            required=True,
            help="The user's user_login (email address).",
        )
        parser.add_argument(
            "--password",
            required=True,
            help="Plain-text password to hash and store.",
        )

    def handle(self, *args, **options):
        email = options["email"].strip().lower()
        password = options["password"]

        try:
            user = User.objects.get(user_login=email)
        except User.DoesNotExist:
            raise CommandError(
                f"No user found with user_login='{email}'. "
                "Run 'sync_hasura' first if the user should exist."
            )

        if not user.is_active:
            raise CommandError(f"User '{email}' (user_id={user.user_id}) is inactive.")

        existing = UserAuth.objects.filter(
            user=user,
            auth_type=UserAuth.AUTH_TYPE_PASSWORD,
        ).first()

        if existing:
            existing.set_password(password)
            existing.save(update_fields=["password_hash", "updated_at"])
            self.stdout.write(
                self.style.SUCCESS(
                    f"Updated password for {email} (user_id={user.user_id})"
                )
            )
        else:
            UserAuth.create_password_auth(user=user, email=email, password=password)
            self.stdout.write(
                self.style.SUCCESS(
                    f"Created password auth for {email} (user_id={user.user_id})"
                )
            )

        self.stdout.write(
            f"  Display name : {user.user_display_name}\n"
            f"  Role         : {user.user_role}\n"
            f"  City         : {user.city or '—'}"
        )
