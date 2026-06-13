from django.db import migrations, models
import django.db.models.deletion


def backfill_run_type(apps, schema_editor):
    """Set run_type='auto' on all pre-M4 rows (they were all cron-triggered)."""
    SyncRun = apps.get_model("sessionops", "SyncRun")
    SyncRun.objects.filter(run_type__isnull=True).update(run_type="auto")


class Migration(migrations.Migration):

    dependencies = [
        ("sessionops", "0018_school_holiday"),
    ]

    operations = [
        # Rename the legacy sync_type column to entity_sync_type
        migrations.RenameField(
            model_name="SyncRun",
            old_name="sync_type",
            new_name="entity_sync_type",
        ),

        # New M4 fields
        migrations.AddField(
            model_name="SyncRun",
            name="run_type",
            field=models.CharField(
                max_length=30,
                choices=[
                    ("auto", "Automatic (cron)"),
                    ("manual", "Manual trigger"),
                    ("manual_single_user", "Single user sync"),
                ],
                null=True,
                blank=True,
            ),
        ),
        migrations.AddField(
            model_name="SyncRun",
            name="entity_type",
            field=models.CharField(
                max_length=30,
                choices=[
                    ("user", "User data"),
                    ("partner", "Partner data"),
                    ("partner_worknode", "Partner Worknode"),
                ],
                null=True,
                blank=True,
            ),
        ),
        migrations.AddField(
            model_name="SyncRun",
            name="updated_after",
            field=models.DateTimeField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="SyncRun",
            name="target_identifier",
            field=models.CharField(max_length=200, null=True, blank=True),
        ),
        migrations.AddField(
            model_name="SyncRun",
            name="triggered_by",
            field=models.ForeignKey(
                to="sessionops.User",
                on_delete=django.db.models.deletion.PROTECT,
                null=True,
                blank=True,
                related_name="+",
            ),
        ),
        migrations.AddField(
            model_name="SyncRun",
            name="user_logins",
            field=models.JSONField(null=True, blank=True),
        ),
        migrations.AddField(
            model_name="SyncRun",
            name="partner_ids",
            field=models.JSONField(null=True, blank=True),
        ),

        # Indexes
        migrations.AddIndex(
            model_name="SyncRun",
            index=models.Index(fields=["run_type", "entity_type", "status"], name="sync_run_run_type_idx"),
        ),
        migrations.AddIndex(
            model_name="SyncRun",
            index=models.Index(fields=["status"], name="sync_run_status_idx"),
        ),

        # Backfill: all pre-M4 rows were cron-triggered
        migrations.RunPython(backfill_run_type, migrations.RunPython.noop),
    ]
