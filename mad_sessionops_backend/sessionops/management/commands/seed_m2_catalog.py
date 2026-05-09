"""
Seed M2 catalog data: AcademicYear 2026-2027, Foundation Program, classes 5th-8th.

Run: python manage.py seed_m2_catalog
Idempotent: safe to run multiple times.
"""

from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = "Seed M2 catalog: academic year, program, and class catalog"

    def handle(self, *args, **options):
        with transaction.atomic():
            self._seed_academic_year()
            self._seed_program_and_classes()
        self.stdout.write(self.style.SUCCESS("M2 catalog seeded successfully."))

    def _seed_academic_year(self):
        from sessionops.models import AcademicYear, User

        if AcademicYear.objects.filter(label="2026-2027").exists():
            self.stdout.write("  AcademicYear 2026-2027 already exists — skipping.")
            return

        system_user = (
            User.objects.filter(user_login="system@makeadiff.in").first()
            or User.objects.first()
        )
        if system_user is None:
            self.stderr.write("No users in DB — cannot seed academic year. Run user setup first.")
            return

        AcademicYear.objects.create(
            label="2026-2027",
            is_active=True,
            created_by=system_user,
        )
        self.stdout.write("  Created AcademicYear 2026-2027 (active).")

    def _seed_program_and_classes(self):
        from sessionops.models import Program, Class

        program, created = Program.objects.get_or_create(
            program_name="Foundation Program",
            defaults={"is_active": True},
        )
        if created:
            self.stdout.write("  Created Program: Foundation Program.")
        else:
            self.stdout.write("  Program Foundation Program already exists — skipping.")

        classes = [
            ("5th", "5"),
            ("6th", "6"),
            ("7th", "7"),
            ("8th", "8"),
        ]
        for class_name, class_code in classes:
            obj, created = Class.objects.get_or_create(
                class_code=class_code,
                defaults={"class_name": class_name, "program_id": program, "is_active": True},
            )
            if created:
                self.stdout.write(f"  Created Class: {class_name} (code={class_code}).")
            else:
                self.stdout.write(f"  Class {class_name} already exists — skipping.")
