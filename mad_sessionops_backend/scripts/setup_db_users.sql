-- ============================================================
-- Session-Ops — Single Backend DB User
-- All Django tables/migrations inside mad_sessionops_dev schema
-- 
-- Deferred: separate sessionops_migrate_user / sessionops_admin_user
-- See DECISIONS.md D025 for the rationale and trigger conditions.
-- ============================================================

CREATE USER sessionops_app_user WITH
    NOSUPERUSER NOCREATEDB NOCREATEROLE LOGIN
    PASSWORD 'CHANGE_ME_DEV_ONLY';

-- Allow connection to DB
GRANT CONNECT ON DATABASE "mad_dev" TO sessionops_app_user;

-- Allow using schemas
GRANT USAGE ON SCHEMA "mad_sessionops_dev" TO sessionops_app_user;
GRANT USAGE ON SCHEMA public TO sessionops_app_user;

-- Allow Django migrations/table creation ONLY in app schema
GRANT CREATE ON SCHEMA "mad_sessionops_dev" TO sessionops_app_user;

-- Do NOT allow table creation in public
REVOKE CREATE ON SCHEMA public FROM sessionops_app_user;

-- Existing tables in app schema
GRANT SELECT, INSERT, UPDATE, DELETE
ON ALL TABLES IN SCHEMA "mad_sessionops_dev"
TO sessionops_app_user;

-- Existing sequences in app schema
GRANT USAGE, SELECT, UPDATE
ON ALL SEQUENCES IN SCHEMA "mad_sessionops_dev"
TO sessionops_app_user;

-- Existing functions in app schema
GRANT EXECUTE
ON ALL FUNCTIONS IN SCHEMA "mad_sessionops_dev"
TO sessionops_app_user;

-- public: function execution only (for extensions); no table permissions
GRANT EXECUTE
ON ALL FUNCTIONS IN SCHEMA public
TO sessionops_app_user;

-- Future tables in app schema
ALTER DEFAULT PRIVILEGES IN SCHEMA "mad_sessionops_dev"
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO sessionops_app_user;

-- Future sequences in app schema
ALTER DEFAULT PRIVILEGES IN SCHEMA "mad_sessionops_dev"
GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO sessionops_app_user;

-- Future functions in app schema
ALTER DEFAULT PRIVILEGES IN SCHEMA "mad_sessionops_dev"
GRANT EXECUTE ON FUNCTIONS TO sessionops_app_user;

-- search_path: resolve unqualified tables in app schema first
ALTER USER sessionops_app_user
SET search_path TO "mad_sessionops_dev", public;

-- ============================================================
-- After running:
--   ALTER USER sessionops_app_user WITH PASSWORD '<strong>';
--   Update .env.development DBUSER and DBPASSWORD accordingly.
-- ============================================================