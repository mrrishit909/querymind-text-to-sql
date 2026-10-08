"""PostgreSQL connection helpers.

Layer 1 of defense (AST validator) lives in sql_validator.py. This module is
layer 2 (read-only transaction) and layer 3 (least-privilege role), both
independent of the validator: a malformed statement that somehow reached
execute() still cannot write, because (a) the session is explicitly put in
a read-only transaction and (b) the role this module connects as
(querymind_reader, via DATABASE_URL) has no grant on anything but the 5
approved views - see db/roles.sql for the real GRANT statements and the
RLS/view-ownership design notes.
"""
from __future__ import annotations

import os

import psycopg2
import psycopg2.extras

APPROVED_VIEWS = {
    "v_customers",
    "v_products",
    "v_orders",
    "v_order_items",
    "v_order_totals",
}


def _dsn(env_var: str) -> str:
    dsn = os.environ.get(env_var)
    if not dsn:
        raise RuntimeError(
            f"{env_var} is not set. Copy .env.example to .env and set it "
            f"(docker compose up already provides a working default for the "
            f"'api' service; running scripts on the host needs it exported)."
        )
    return dsn


def get_readonly_connection(readonly: bool = True) -> psycopg2.extensions.connection:
    """Connect as querymind_reader (DATABASE_URL). This role has SELECT on
    the 5 approved views ONLY (no base-table grant at all - proven in
    tests/test_postgres_security.py) and a 3-second statement_timeout set as
    a role-level login default (db/roles.sql), which is a real database-
    enforced query execution timeout, not just a lock-wait bound.

    On top of the role's own grants, every connection from this function is
    explicitly placed in a read-only transaction (psycopg2's
    `set_session(readonly=True)`, which issues `SET TRANSACTION READ ONLY`
    at the Postgres level) as a second, independent layer: even a
    hypothetical future misconfiguration that granted this role write
    privileges would still have those writes rejected by the transaction
    mode itself (SQLSTATE 25006), not just by GRANT.
    """
    conn = psycopg2.connect(_dsn("DATABASE_URL"), cursor_factory=psycopg2.extras.RealDictCursor)
    conn.set_session(readonly=readonly, autocommit=False)
    return conn


def get_admin_connection() -> psycopg2.extensions.connection:
    """Superuser/admin connection (ADMIN_DATABASE_URL). Used ONLY by
    db/seed.py and by tests that need to prove the reader role's
    restrictions independently of its own grants (e.g. the read-only-
    transaction test in tests/test_postgres_security.py). The app's request
    path (query_executor.py / api.py) never calls this."""
    conn = psycopg2.connect(_dsn("ADMIN_DATABASE_URL"), cursor_factory=psycopg2.extras.RealDictCursor)
    return conn


def schema_catalog() -> str:
    """A narrow, human-readable description of ONLY the approved views, for
    the LLM's system prompt. Base tables are never described or exposed."""
    return """
Approved read-only views (the ONLY objects you may query), PostgreSQL 17:

v_customers(customer_id, first_name, last_name, city, signup_date DATE)
v_products(product_id, name, category, unit_price NUMERIC)
v_orders(order_id, customer_id, order_date DATE, status)   -- status in ('completed','cancelled','returned')
v_order_items(order_item_id, order_id, product_id, quantity, unit_price NUMERIC)
v_order_totals(order_id, customer_id, order_date, status, order_total NUMERIC)  -- order_total = SUM(quantity*unit_price)

Join keys: v_orders.customer_id -> v_customers.customer_id;
v_order_items.order_id -> v_orders.order_id; v_order_items.product_id -> v_products.product_id.
"""
