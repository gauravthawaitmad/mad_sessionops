from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("sessionops", "0006_syncrun_sync_type"),
    ]

    operations = [
        migrations.AlterField(
            model_name="user",
            name="email",
            field=models.EmailField(
                db_index=True,
                max_length=255,
                verbose_name="Email Address",
                help_text="User's email address. Not enforced unique — Hasura source data contains duplicates.",
            ),
        ),
    ]
