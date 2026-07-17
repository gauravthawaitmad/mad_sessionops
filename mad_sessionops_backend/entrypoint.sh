#!/bin/sh
set -e

if [ "$1" = "gunicorn" ]; then
    echo ">>> Running collectstatic..."
    python manage.py collectstatic --noinput

    echo ">>> Ensuring DB schema exists..."
    python - <<'PYEOF'
import os, sys
try:
    import psycopg2
    schema   = os.environ.get("DBSCHEMA", "public")
    app_user = os.environ.get("DBUSER", "")
    conn = psycopg2.connect(
        host=os.environ.get("DBHOST"),
        port=os.environ.get("DBPORT", 5432),
        dbname=os.environ.get("DBNAME"),
        user=os.environ.get("DBADMINUSER", app_user),
        password=os.environ.get("DBADMINPASSWORD", os.environ.get("DBPASSWORD")),
    )
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
    cur.execute(f'GRANT ALL ON SCHEMA "{schema}" TO "{app_user}"')
    cur.execute(f'ALTER DEFAULT PRIVILEGES IN SCHEMA "{schema}" GRANT ALL ON TABLES TO "{app_user}"')
    cur.execute(f'ALTER DEFAULT PRIVILEGES IN SCHEMA "{schema}" GRANT ALL ON SEQUENCES TO "{app_user}"')
    conn.close()
    print(f"Schema '{schema}' ready.")
except Exception as e:
    print(f"Schema step warning: {e}", file=sys.stderr)
PYEOF

    echo ">>> Running DB startup (migrate + seed)..."
    python manage.py db_startup

    # Run Hasura sync only on staging and production.
    # Development uses local/test data — skip sync to avoid hitting real Hasura.
    ENV="${ENVIRONMENT:-development}"
    if [ "$ENV" = "staging" ] || [ "$ENV" = "production" ]; then
        echo ">>> [$ENV] Syncing users from Hasura..."
        python manage.py sync_users

        echo ">>> [$ENV] Syncing partners from Hasura..."
        python manage.py sync_partners

        echo ">>> [$ENV] Syncing partner-worknode mappings from Hasura..."
        python manage.py sync_partner_worknode
    else
        echo ">>> [development] Skipping Hasura sync."
    fi
fi

exec "$@"
