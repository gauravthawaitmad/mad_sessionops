from django.core.management.base import BaseCommand

from sessionops.services.sync import run_partner_worknode_sync


class Command(BaseCommand):
    help = "Pull partner-worknode mappings from Hasura and upsert into local DB."

    def handle(self, *args, **options):
        self.stdout.write("Starting partner_worknode sync...")

        sync_run = run_partner_worknode_sync(progress=self.stdout.write)

        if sync_run.status == "success":
            self.stdout.write(self.style.SUCCESS(
                "Partner worknode sync complete."
            ))
        else:
            self.stderr.write(self.style.ERROR(
                f"Partner worknode sync FAILED: {sync_run.error_message}"
            ))
            raise SystemExit(1)
