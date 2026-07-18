# Fixes class_section_slug_per_school: it was scoped to (NOT removed), which
# incorrectly blocked reusing a section_name across a currently-inactive
# (is_active=false, removed=false) historical row and a new active row —
# legitimate data per Bubble's history. Rescoped to (is_active AND NOT removed)
# so uniqueness is enforced among active rows only.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("sessionops", "0028_m7_fix_fk_double_suffix_columns"),
    ]

    operations = [
        migrations.RemoveConstraint(
            model_name="classsection",
            name="class_section_slug_per_school",
        ),
        migrations.AddConstraint(
            model_name="classsection",
            constraint=models.UniqueConstraint(
                condition=models.Q(("is_active", True), ("removed", False)),
                fields=("school_id", "section_name"),
                name="class_section_slug_per_school",
            ),
        ),
    ]
