# Browser stub for db.connection - the real module needs psycopg2 (a live
# Postgres connection), which has no purpose in a static, backend-less demo.
# Only the one constant sql_validator.py actually imports is reproduced here,
# copied by hand from the real db/connection.py and kept in sync by
# tests/test_verdict_glue.py.
APPROVED_VIEWS = {"v_customers", "v_products", "v_orders", "v_order_items", "v_order_totals"}
