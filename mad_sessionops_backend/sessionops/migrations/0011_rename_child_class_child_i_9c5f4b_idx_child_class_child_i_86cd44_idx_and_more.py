# State-only migration: index names changed when db_column was added to FK fields.
# Dev DB was created with db_column set (new names); DB ops are skipped.
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("sessionops", "0010_alter_class_program_id"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.RenameIndex(
                    model_name="childclass",
                    new_name="child_class_child_i_86cd44_idx",
                    old_name="child_class_child_i_9c5f4b_idx",
                ),
                migrations.RenameIndex(
                    model_name="childclass",
                    new_name="child_class_school__1abc40_idx",
                    old_name="child_class_school__bc3e06_idx",
                ),
                migrations.RenameIndex(
                    model_name="childclasssection",
                    new_name="child_class_child_i_8f9d23_idx",
                    old_name="child_class_child_i_3985b3_idx",
                ),
                migrations.RenameIndex(
                    model_name="childclasssection",
                    new_name="child_class_class_s_ac4ba0_idx",
                    old_name="child_class_class_s_c9c479_idx",
                ),
                migrations.RenameIndex(
                    model_name="childremovallog",
                    new_name="child_remov_child_i_4be93e_idx",
                    old_name="child_remov_child_i_079ca1_idx",
                ),
            ],
        )
    ]
