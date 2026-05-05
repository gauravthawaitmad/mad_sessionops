from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("sessionops", "0007_remove_user_email_unique"),
    ]

    operations = [
        migrations.AddField(
            model_name="passwordresettoken",
            name="invalidation_reason",
            field=models.CharField(
                blank=True,
                choices=[
                    ("consumed", "Used by user"),
                    ("superseded", "Voided — newer link was requested"),
                ],
                help_text=(
                    "Why this token was closed. "
                    "'consumed' = user used it; "
                    "'superseded' = system voided it when a newer link was requested; "
                    "null = still active or timed out naturally."
                ),
                max_length=20,
                null=True,
            ),
        ),
    ]
