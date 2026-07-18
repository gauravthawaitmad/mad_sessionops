from django.core.management.base import BaseCommand

from sessionops.services.sync import run_partner_sync


class Command(BaseCommand):
    help = "Pull partners from Hasura and upsert into local DB."

    def handle(self, *args, **options):
        self.stdout.write("Starting partner sync...")

        sync_run = run_partner_sync(progress=self.stdout.write)

        if sync_run.status == "success":
            self.stdout.write(
                self.style.SUCCESS(
                    f"Partner sync complete — "
                    f"{sync_run.partners_created} created / {sync_run.partners_updated} updated"
                )
            )
        else:
            self.stderr.write(self.style.ERROR(f"Partner sync FAILED: {sync_run.error_message}"))
            raise SystemExit(1)
