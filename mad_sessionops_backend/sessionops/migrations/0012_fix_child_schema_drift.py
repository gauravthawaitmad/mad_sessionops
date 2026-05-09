"""
Corrective migration: aligns DB to model state after migration 0009 was
rewritten in-place but not re-applied.

What changed vs. the version that was previously applied:

child table
  - ADDED   : age, city, mother_tongue, date_of_enrollment, mad_joining_date
  - REMOVED : admission_number, guardian_name, guardian_phone  (old draft fields)

batch_child table
  - ADDED   : school_id (backfilled from child.school_id)

child_removal_log table
  - Completely different schema (old draft had removal_log_id, removal_reason,
    removed_at, removed_by_id).
  - Dropped and recreated with the model-correct schema.
  - 2 existing dev rows are lost (accepted).
"""

from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("sessionops", "0011_rename_child_class_child_i_9c5f4b_idx_child_class_child_i_86cd44_idx_and_more"),
    ]

    operations = [
        # ── child ─────────────────────────────────────────────────────────────
        migrations.SeparateDatabaseAndState(
            database_operations=[
                # Add new columns (match model — all nullable)
                migrations.RunSQL(
                    "ALTER TABLE child ADD COLUMN IF NOT EXISTS age INTEGER",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "ALTER TABLE child ADD COLUMN IF NOT EXISTS city VARCHAR(100)",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "ALTER TABLE child ADD COLUMN IF NOT EXISTS mother_tongue VARCHAR(50)",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "ALTER TABLE child ADD COLUMN IF NOT EXISTS date_of_enrollment DATE",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "ALTER TABLE child ADD COLUMN IF NOT EXISTS mad_joining_date DATE",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                # Remove old draft columns (data in these is intentionally discarded)
                migrations.RunSQL(
                    "ALTER TABLE child DROP COLUMN IF EXISTS admission_number",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "ALTER TABLE child DROP COLUMN IF EXISTS guardian_name",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "ALTER TABLE child DROP COLUMN IF EXISTS guardian_phone",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[],
        ),

        # ── batch_child ───────────────────────────────────────────────────────
        migrations.SeparateDatabaseAndState(
            database_operations=[
                # Add nullable first so existing rows don't violate NOT NULL
                migrations.RunSQL(
                    "ALTER TABLE batch_child ADD COLUMN IF NOT EXISTS school_id BIGINT",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                # Backfill from child table
                migrations.RunSQL(
                    """
                    UPDATE batch_child bc
                    SET school_id = c.school_id
                    FROM child c
                    WHERE bc.child_id = c.child_id
                    """,
                    reverse_sql=migrations.RunSQL.noop,
                ),
                # Now enforce NOT NULL
                migrations.RunSQL(
                    "ALTER TABLE batch_child ALTER COLUMN school_id SET NOT NULL",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "CREATE INDEX IF NOT EXISTS batch_child_school_id_idx ON batch_child(school_id)",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[],
        ),

        # ── child_removal_log ─────────────────────────────────────────────────
        migrations.SeparateDatabaseAndState(
            database_operations=[
                # Drop the old-draft table entirely (2 dev rows — accepted data loss)
                migrations.RunSQL(
                    "DROP TABLE IF EXISTS child_removal_log CASCADE",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                # Recreate with the model-correct schema
                migrations.RunSQL(
                    """
                    CREATE TABLE child_removal_log (
                        child_removal_log_id BIGSERIAL PRIMARY KEY,
                        child_id             BIGINT NOT NULL
                                             REFERENCES child(child_id) DEFERRABLE INITIALLY DEFERRED,
                        co_id                BIGINT NOT NULL,
                        school_id            BIGINT NOT NULL,
                        removed_reason       VARCHAR(20) NOT NULL,
                        other_details        TEXT,
                        removed_datetime     TIMESTAMPTZ NOT NULL,
                        is_active            BOOLEAN NOT NULL DEFAULT TRUE,
                        removed              BOOLEAN NOT NULL DEFAULT FALSE,
                        deleted_at           TIMESTAMPTZ,
                        created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                        updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
                    )
                    """,
                    reverse_sql="DROP TABLE IF EXISTS child_removal_log CASCADE",
                ),
                migrations.RunSQL(
                    "CREATE INDEX child_remov_child_i_079ca1_idx ON child_removal_log (child_id, is_active)",
                    reverse_sql=migrations.RunSQL.noop,
                ),
                migrations.RunSQL(
                    "CREATE INDEX child_removal_log_school_id_idx ON child_removal_log (school_id)",
                    reverse_sql=migrations.RunSQL.noop,
                ),
            ],
            state_operations=[],
        ),
    ]
