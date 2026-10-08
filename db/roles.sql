-- Least-privilege roles for QUERYMIND. Runs once, as the Postgres superuser,
-- right after schema.sql (docker-entrypoint-initdb.d runs these in filename
-- order: 01_schema.sql then 02_roles.sql - see docker-compose.yml).
--
-- Three roles exist on purpose:
--   postgres             - superuser, used only for migrations/seeding/admin
--                           tests. The app never connects as this role.
--   querymind_view_owner - NOLOGIN, NOSUPERUSER, NOBYPASSRLS. Owns the 5
--                           approved views. Has SELECT on the base tables
--                           and is itself subject to RLS (see policies
--                           below), so owning the views does not hand out
--                           an RLS bypass to anyone who queries them.
--   querymind_reader     - LOGIN. This is the DATABASE_URL the app and the
--                           LLM-proposed-SQL path actually connect as.
--                           SELECT on the 5 views ONLY - explicitly NOT on
--                           the 4 base tables. A 3-second statement_timeout
--                           is set as a role-level login default, which is
--                           the real fix for the "busy_timeout only bounds
--                           lock-wait, not query runtime" bug: statement_timeout
--                           is enforced by Postgres's executor itself and
--                           cancels a running query, not just a lock wait.

CREATE ROLE querymind_view_owner NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
GRANT SELECT ON customers, products, orders, order_items TO querymind_view_owner;

ALTER VIEW v_customers    OWNER TO querymind_view_owner;
ALTER VIEW v_products     OWNER TO querymind_view_owner;
ALTER VIEW v_orders       OWNER TO querymind_view_owner;
ALTER VIEW v_order_items  OWNER TO querymind_view_owner;
ALTER VIEW v_order_totals OWNER TO querymind_view_owner;

-- Row-Level Security: enabled on every base table as a default-deny
-- backstop. There is no tenant concept in this single-tenant app, so there
-- is no per-row tenant policy to write (inventing one would be a fake box
-- to tick, not a real control - LIMITATIONS.md says so explicitly). What
-- RLS buys here, concretely: the ONLY role with a policy letting it see
-- rows is querymind_view_owner (used solely to run the 5 views). If a
-- future migration ever mistakenly also GRANTs querymind_reader (or any
-- other role) direct SELECT on a base table, that role still has ZERO
-- rows visible, because no policy names it. Proven in
-- tests/test_postgres_security.py::test_rls_blocks_even_with_an_accidental_grant.
ALTER TABLE customers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE products     ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders       ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items  ENABLE ROW LEVEL SECURITY;

CREATE POLICY view_owner_read ON customers   FOR SELECT TO querymind_view_owner USING (true);
CREATE POLICY view_owner_read ON products    FOR SELECT TO querymind_view_owner USING (true);
CREATE POLICY view_owner_read ON orders      FOR SELECT TO querymind_view_owner USING (true);
CREATE POLICY view_owner_read ON order_items FOR SELECT TO querymind_view_owner USING (true);

-- The reader role: this is what DATABASE_URL points at in .env/docker-compose.
CREATE ROLE querymind_reader LOGIN PASSWORD 'querymind_reader_local_only'
    NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;

GRANT CONNECT ON DATABASE querymind TO querymind_reader;
GRANT USAGE ON SCHEMA public TO querymind_reader;
GRANT SELECT ON v_customers, v_products, v_orders, v_order_items, v_order_totals TO querymind_reader;
-- Explicitly NOT granted: SELECT/INSERT/UPDATE/DELETE on customers, products,
-- orders, order_items. tests/test_postgres_security.py proves this directly.

-- Real query-execution timeout, enforced at the database level, independent
-- of the validator and independent of the app code: a login-time default
-- on the role itself. Postgres applies this at the start of every session
-- querymind_reader opens (it is NOT the SQLite busy_timeout bug: this
-- cancels a long-RUNNING query, not just a lock wait).
ALTER ROLE querymind_reader SET statement_timeout = '3000';

-- Hardening: don't let the reader create temp tables/sessions beyond what's
-- needed, and make sure nothing here can create a backdoor to bypass RLS.
REVOKE TEMPORARY ON DATABASE querymind FROM PUBLIC;
