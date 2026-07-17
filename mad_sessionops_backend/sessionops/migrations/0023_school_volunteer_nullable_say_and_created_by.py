from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    """
    M8a: school_volunteer lifecycle moves to realtime sync.
    Realtime sync may not have a SAY context or a triggered_by user,
    so both fields are relaxed to nullable.
    """

    dependencies = [
        ("sessionops", "0022_realtime_sync_log"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="schoolvolunteer",
            name="school_academic_year_id",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.PROTECT,
                to="sessionops.schoolacademicyear",
            ),
        ),
        migrations.AlterField(
            model_name="schoolvolunteer",
            name="created_by",
            field=models.ForeignKey(
                null=True,
                blank=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="+",
                to="sessionops.user",
            ),
        ),
    ]
