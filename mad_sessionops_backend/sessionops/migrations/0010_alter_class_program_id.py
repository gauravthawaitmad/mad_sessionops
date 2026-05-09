# No-op migration: 0009 already sets db_column="program_id" correctly.
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("sessionops", "0009_academicyear_child_class_schoolacademicyear_and_more"),
    ]

    operations = []
