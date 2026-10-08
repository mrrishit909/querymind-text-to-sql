"""Read-only database access.

Layer 1 of defense (AST validator) lives in sql/validator.py. This module is
layer 2, independent of the validator: the connection itself cannot write,
even if a malformed statement somehow reached execute().
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "querymind.db"


def get_readonly_connection() -> sqlite3.Connection:
    # uri=true + mode=ro opens the SQLite file itself as read-only at the OS
    # level (a write attempt raises OperationalError: attempt to write a
    # readonly database), independent of any application-level check.
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    # Second, SQLite-level guard: query_only rejects any write statement that
    # somehow reaches execute(), even on a connection that wasn't opened ro.
    conn.execute("PRAGMA query_only = ON;")
    conn.row_factory = sqlite3.Row
    return conn


APPROVED_VIEWS = {
    "v_customers",
    "v_products",
    "v_orders",
    "v_order_items",
    "v_order_totals",
}


def schema_catalog() -> str:
    """A narrow, human-readable description of ONLY the approved views, for
    the LLM's system prompt. Base tables are never described or exposed."""
    return """
Approved read-only views (the ONLY objects you may query):

v_customers(customer_id, first_name, last_name, city, signup_date)
v_products(product_id, name, category, unit_price)
v_orders(order_id, customer_id, order_date, status)   -- status in ('completed','cancelled','returned')
v_order_items(order_item_id, order_id, product_id, quantity, unit_price)
v_order_totals(order_id, customer_id, order_date, status, order_total)  -- order_total = SUM(quantity*unit_price)

Join keys: v_orders.customer_id -> v_customers.customer_id;
v_order_items.order_id -> v_orders.order_id; v_order_items.product_id -> v_products.product_id.
"""
