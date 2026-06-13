from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sessionops", "0020_rename_sync_run_run_type_idx_sync_run_run_typ_8ee96e_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="syncrun",
            name="cursor_end",
            field=models.DateTimeField(
                blank=True,
                null=True,
                help_text="Max Hasura updated_at seen in this run — used as updated_after for the next incremental sync.",
            ),
        ),
    ]
