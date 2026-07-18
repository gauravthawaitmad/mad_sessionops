from django.core.management.base import BaseCommand

from sessionops.services.sync import run_user_sync


class Command(BaseCommand):
    help = "Pull users from Hasura and upsert into local DB."

    def handle(self, *args, **options):
        self.stdout.write("Starting user sync...")

        sync_run = run_user_sync(progress=self.stdout.write)

        if sync_run.status == "success":
            self.stdout.write(
                self.style.SUCCESS(
                    f"User sync complete — "
                    f"{sync_run.users_created} created / {sync_run.users_updated} updated"
                )
            )
        else:
            self.stderr.write(self.style.ERROR(f"User sync FAILED: {sync_run.error_message}"))
            raise SystemExit(1)
