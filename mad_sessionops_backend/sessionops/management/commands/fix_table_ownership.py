from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connections


class Command(BaseCommand):
    help = (
        "Reassign all tables in the app schema to DBUSER. Run as DBADMINUSER (--database migrate)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--database",
            default="migrate",
            help="Database alias to use (default: migrate — runs as DBADMINUSER who has ALTER rights).",
        )

    def handle(self, *args, **options):
        db_alias = options["database"]
        schema = settings.DBSCHEMA
        target_user = str(settings.DATABASES["default"]["USER"])

        with connections[db_alias].cursor() as cursor:
            cursor.execute(
                "SELECT tablename FROM pg_tables WHERE schemaname = %s AND tableowner != %s",
                [schema, target_user],
            )
            tables = [row[0] for row in cursor.fetchall()]

        if not tables:
            self.stdout.write(
                self.style.SUCCESS(
                    f"All tables in '{schema}' already owned by '{target_user}'. Nothing to do."
                )
            )
            return

        self.stdout.write(
            f"Fixing {len(tables)} table(s) in '{schema}' -> owner '{target_user}'..."
        )
        with connections[db_alias].cursor() as cursor:
            for table in tables:
                cursor.execute(f'ALTER TABLE "{schema}"."{table}" OWNER TO "{target_user}"')
                self.stdout.write(f"  {table}")

        self.stdout.write(self.style.SUCCESS(f"Done. {len(tables)} table(s) reassigned."))
