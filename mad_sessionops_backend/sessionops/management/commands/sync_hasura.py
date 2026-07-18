from django.core.management.base import BaseCommand

from sessionops.models import SyncRun
from sessionops.services.sync.incremental import run_incremental_sync


class Command(BaseCommand):
    help = "Run incremental Hasura sync for all entities (user, partner, partner_worknode)."

    def handle(self, *args, **options):
        self.stdout.write("Starting incremental Hasura sync...")

        results = run_incremental_sync(run_type=SyncRun.RUN_TYPE_AUTO, triggered_by=None)

        all_ok = True
        for entity_type, run in results.items():
            if run is None:
                self.stderr.write(self.style.ERROR(f"  {entity_type}: FAILED (see sync_run table)"))
                all_ok = False
            else:
                count = (
                    run.users_fetched
                    if entity_type == SyncRun.ENTITY_TYPE_USER
                    else run.partners_fetched
                    if entity_type == SyncRun.ENTITY_TYPE_PARTNER
                    else 0
                )
                self.stdout.write(
                    self.style.SUCCESS(f"  {entity_type}: {run.status} ({count} records fetched)")
                )

        if not all_ok:
            raise SystemExit(1)
