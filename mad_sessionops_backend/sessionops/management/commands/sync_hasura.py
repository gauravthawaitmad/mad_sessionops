from django.core.management.base import BaseCommand

from sessionops.services.sync import run_sync


class Command(BaseCommand):
    help = "Pull users and partners from Hasura and upsert into local DB."

    def handle(self, *args, **options):
        self.stdout.write("Starting Hasura sync...")

        sync_run = run_sync(progress=self.stdout.write)

        if sync_run.status == "success":
            self.stdout.write(self.style.SUCCESS(
                f"Sync complete (all) — "
                f"users: {sync_run.users_created} created / {sync_run.users_updated} updated | "
                f"partners: {sync_run.partners_created} created / {sync_run.partners_updated} updated"
            ))
        else:
            self.stderr.write(self.style.ERROR(
                f"Sync FAILED: {sync_run.error_message}"
            ))
            raise SystemExit(1)
