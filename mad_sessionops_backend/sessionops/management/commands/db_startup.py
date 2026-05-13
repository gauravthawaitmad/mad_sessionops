"""
Startup DB check: migrate, seed catalog, and print a readable status summary.
Called from entrypoint.sh before the server starts.
Run locally: just dbcheck
"""

import os
import sys

from django.core.management import call_command
from django.core.management.base import BaseCommand
from django.db import connection
from django.db.migrations.executor import MigrationExecutor


SEP = "-" * 62


def _ok(msg):   return f"  [OK]   {msg}"
def _warn(msg): return f"  [WARN] {msg}"
def _fail(msg): return f"  [FAIL] {msg}"


class Command(BaseCommand):
    help = "Run migrations + seed catalog, print structured startup summary."

    def handle(self, *args, **options):
        self._print_header()
        self._print_db_info()

        migration_ok = self._run_migrations()
        seed_ok      = self._run_seed()

        self._print_footer(migration_ok and seed_ok)

        if not (migration_ok and seed_ok):
            sys.exit(1)

    # ── Header ─────────────────────────────────────────────────────────────────

    def _print_header(self):
        env = os.environ.get("ENVIRONMENT", "development").upper()
        self.stdout.write(f"\n{SEP}")
        self.stdout.write(f"  SESSION-OPS -- STARTUP   [{env}]")
        self.stdout.write(f"{SEP}\n")

    # ── DB info ────────────────────────────────────────────────────────────────

    def _print_db_info(self):
        cfg = connection.settings_dict
        # Read active schema from PostgreSQL directly
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT current_database(), current_schema()")
                pg_db, pg_schema = cur.fetchone()
        except Exception:
            pg_db, pg_schema = cfg['NAME'], "unknown"

        self.stdout.write(f"  Database : {pg_db}")
        self.stdout.write(f"  Schema   : {pg_schema}")
        self.stdout.write(f"  Host     : {cfg['HOST']}:{cfg.get('PORT', 5432)}\n")

    # ── Migrations ─────────────────────────────────────────────────────────────

    def _run_migrations(self) -> bool:
        self.stdout.write(f"{SEP}")
        self.stdout.write("  MIGRATIONS")
        self.stdout.write(f"{SEP}")

        try:
            executor = MigrationExecutor(connection)
            plan = executor.migration_plan(executor.loader.graph.leaf_nodes())
            pending_count = len(plan)

            if pending_count:
                self.stdout.write(f"  Pending  : {pending_count}")
                for migration, _ in plan:
                    self.stdout.write(f"    -> {migration.app_label}.{migration.name}")
                self.stdout.write("  Applying...")
                call_command("migrate", "--noinput", "--database", "migrate",
                             verbosity=0, stdout=self.stdout)
                self.stdout.write(_ok(f"Applied {pending_count} migration(s)"))
            else:
                self.stdout.write(_ok("Up to date -- no pending migrations"))

            # Count applied migrations from the loader's applied set
            executor.loader.build_graph()
            applied = len(executor.loader.applied_migrations)
            self.stdout.write(f"  Total applied : {applied}\n")
            return True

        except Exception as exc:
            self.stdout.write(_fail(f"Migration error: {exc}"))
            return False

    # ── Seed ───────────────────────────────────────────────────────────────────

    def _run_seed(self) -> bool:
        self.stdout.write(f"{SEP}")
        self.stdout.write("  CATALOG SEED")
        self.stdout.write(f"{SEP}")

        try:
            self._seed_academic_year()
            self._seed_program_and_classes()
            self.stdout.write("")
            return True
        except Exception as exc:
            self.stdout.write(_fail(f"Seed error: {exc}"))
            return False

    def _seed_academic_year(self):
        from sessionops.models import AcademicYear, User

        if AcademicYear.objects.filter(label="2026-2027", removed=False).exists():
            self.stdout.write(_ok("AcademicYear 2026-2027  (already seeded)"))
            return

        system_user = (
            User.objects.filter(user_login="system@makeadiff.in").first()
            or User.objects.first()
        )
        if system_user is None:
            self.stdout.write(_warn("AcademicYear -- no users in DB, skipping. Run user setup first."))
            return

        AcademicYear.objects.create(label="2026-2027", is_active=True, created_by=system_user)
        self.stdout.write(_ok("AcademicYear 2026-2027  (created)"))

    def _seed_program_and_classes(self):
        from sessionops.models import Class, Program

        program, created = Program.objects.get_or_create(
            program_name="Foundation Program",
            defaults={"is_active": True},
        )
        label = "(created)" if created else "(already seeded)"
        self.stdout.write(_ok(f"Program: Foundation Program  {label}"))

        catalog = [("5th", "5"), ("6th", "6"), ("7th", "7"), ("8th", "8")]
        created_count = 0
        for class_name, class_code in catalog:
            _, c = Class.objects.get_or_create(
                class_code=class_code,
                defaults={"class_name": class_name, "program_id": program, "is_active": True},
            )
            if c:
                created_count += 1

        existing = len(catalog) - created_count
        if created_count:
            self.stdout.write(_ok(f"Classes 5th-8th  ({created_count} created, {existing} already existed)"))
        else:
            self.stdout.write(_ok("Classes 5th-8th  (already seeded)"))

    # ── Footer ─────────────────────────────────────────────────────────────────

    def _print_footer(self, all_ok: bool):
        self.stdout.write(f"{SEP}")
        if all_ok:
            self.stdout.write("  [OK] DB ready -- starting server")
        else:
            self.stdout.write("  [FAIL] Startup checks failed -- aborting")
        self.stdout.write(f"{SEP}\n")
