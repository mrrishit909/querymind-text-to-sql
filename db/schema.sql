-- Fictional commerce schema for QUERYMIND, PostgreSQL 17. Entirely synthetic
-- data, no PII. Run as the admin/superuser (postgres-entrypoint init script),
-- NOT as querymind_reader.
--
-- SECURITY NOTE on view ownership (read this before "fixing" it to
-- `security_invoker = true`):
--
-- The remediation request asked for every view to be created
-- `WITH (security_invoker = true)` (PG15+). That was tried first and proven
-- INCOMPATIBLE with this app's actual security model:
--
--   CREATE TABLE t(x int);
--   CREATE VIEW v WITH (security_invoker=true) AS SELECT * FROM t;
--   CREATE ROLE r; GRANT SELECT ON v TO r;
--   SET ROLE r; SELECT * FROM v;
--   -- ERROR:  permission denied for table t    (SQLSTATE 42501)
--
-- security_invoker makes the view check the QUERYING role's own privileges
-- on the base table. querymind_reader deliberately has NO grant on the base
-- tables (that is the whole point: base tables are never exposed). So an
-- invoker-rights view returns nothing but a permission error for every
-- single query the reader role runs, including completely legitimate ones -
-- it doesn't hole up the base tables, it just breaks the app.
--
-- Instead this schema uses the documented pre-PG15 pattern that
-- security_invoker exists to make unnecessary in the cases where it *is*
-- safe to use: a DEFINER-rights view owned by a dedicated, narrowly-scoped
-- role (querymind_view_owner, created in 02_roles.sql) that is:
--   - NOT the owner of the base tables (ownership stays with the admin/
--     migration role that ran this file)
--   - NOT a superuser, NOT BYPASSRLS
--   - granted SELECT on the base tables, nothing else
--   - itself governed by Row-Level Security policies on those tables
-- This closes exactly the hole gap (e) in the remediation request warns
-- about (a view silently inheriting a bypass-capable owner's privileges),
-- because querymind_view_owner has no bypass capability to inherit: it is
-- not the table owner, not a superuser, and RLS applies to it. Proven live
-- in 02_roles.sql's own comments and in tests/test_postgres_security.py.

CREATE TABLE customers (
    customer_id   SERIAL PRIMARY KEY,
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    city          TEXT NOT NULL,
    signup_date   DATE NOT NULL
);

CREATE TABLE products (
    product_id    SERIAL PRIMARY KEY,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL,
    unit_price    NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE orders (
    order_id      SERIAL PRIMARY KEY,
    customer_id   INTEGER NOT NULL REFERENCES customers(customer_id),
    order_date    DATE NOT NULL,
    status        TEXT NOT NULL CHECK (status IN ('completed', 'cancelled', 'returned'))
);

CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id      INTEGER NOT NULL REFERENCES orders(order_id),
    product_id    INTEGER NOT NULL REFERENCES products(product_id),
    quantity      INTEGER NOT NULL CHECK (quantity > 0),
    unit_price    NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0)
);

-- Approved read-only views: the ONLY surface the LLM schema catalog
-- describes and the ONLY set of names the SQL validator allows a query to
-- reference. Base tables are never exposed to the query layer directly.
-- Ownership is reassigned to querymind_view_owner in 02_roles.sql - see the
-- note above for why these are plain (definer-rights) views, not
-- security_invoker.
CREATE VIEW v_customers AS
    SELECT customer_id, first_name, last_name, city, signup_date FROM customers;

CREATE VIEW v_products AS
    SELECT product_id, name, category, unit_price FROM products;

CREATE VIEW v_orders AS
    SELECT order_id, customer_id, order_date, status FROM orders;

CREATE VIEW v_order_items AS
    SELECT order_item_id, order_id, product_id, quantity, unit_price FROM order_items;

CREATE VIEW v_order_totals AS
    SELECT o.order_id, o.customer_id, o.order_date, o.status,
           SUM(oi.quantity * oi.unit_price) AS order_total
    FROM orders o JOIN order_items oi ON oi.order_id = o.order_id
    GROUP BY o.order_id, o.customer_id, o.order_date, o.status;
