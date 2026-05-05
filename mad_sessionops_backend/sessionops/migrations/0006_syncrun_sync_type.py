from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("sessionops", "0005_f_m1_2_partner_syncrun_synced_at"),
    ]

    operations = [
        migrations.AddField(
            model_name="syncrun",
            name="sync_type",
            field=models.CharField(
                choices=[
                    ("users", "Users"),
                    ("partners", "Partners"),
                    ("all", "All"),
                ],
                default="all",
                max_length=16,
            ),
        ),
    ]
