"""Seed the Postgres `querymind` database with deterministic synthetic
commerce data (no real customers, no PII). Safe to re-run: truncates and
reloads. Connects as the admin role (ADMIN_DATABASE_URL) - schema.sql and
roles.sql have already run via docker-entrypoint-initdb.d by the time this
is invoked against a fresh container, so this script only inserts rows."""
from __future__ import annotations

import random
import sys
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from db.connection import get_admin_connection

CITIES = ["Tampa", "Orlando", "Miami", "Austin", "Denver", "Seattle", "Boston", "Chicago"]
FIRST = ["Alex", "Jordan", "Sam", "Taylor", "Morgan", "Casey", "Riley", "Jamie", "Avery", "Drew"]
LAST = ["Nguyen", "Garcia", "Smith", "Patel", "Kim", "Johnson", "Lopez", "Chen", "Brown", "Davis"]
CATEGORIES = {
    "Electronics": ["Wireless Mouse", "USB-C Hub", "Mechanical Keyboard", "Webcam", "Monitor Stand"],
    "Home": ["Ceramic Mug", "Throw Blanket", "Desk Lamp", "Candle Set", "Picture Frame"],
    "Outdoors": ["Hiking Backpack", "Water Bottle", "Camping Chair", "Trail Mix Pack", "Rain Jacket"],
    "Office": ["Notebook", "Sticky Notes", "Pen Set", "Desk Organizer", "Whiteboard"],
}


def build(seed: int = 7, n_customers: int = 300, n_orders: int = 1200) -> None:
    rng = random.Random(seed)
    conn = get_admin_connection()
    cur = conn.cursor()
    # TRUNCATE ... RESTART IDENTITY CASCADE resets the SERIAL sequences too,
    # so re-running this script always produces the same ids as a fresh seed.
    cur.execute("TRUNCATE order_items, orders, products, customers RESTART IDENTITY CASCADE")

    start = date(2025, 1, 1)
    customers = []
    for i in range(1, n_customers + 1):
        signup = start + timedelta(days=rng.randint(0, 600))
        customers.append((i, rng.choice(FIRST), rng.choice(LAST), rng.choice(CITIES), signup))
    cur.executemany(
        "INSERT INTO customers (customer_id, first_name, last_name, city, signup_date) VALUES (%s,%s,%s,%s,%s)",
        customers,
    )

    products = []
    pid = 1
    for cat, names in CATEGORIES.items():
        for name in names:
            price = round(rng.uniform(5, 150), 2)
            products.append((pid, name, cat, price))
            pid += 1
    cur.executemany(
        "INSERT INTO products (product_id, name, category, unit_price) VALUES (%s,%s,%s,%s)", products
    )

    orders = []
    items = []
    item_id = 1
    for oid in range(1, n_orders + 1):
        cust = rng.randint(1, n_customers)
        odate = start + timedelta(days=rng.randint(0, 650))
        status = rng.choices(["completed", "cancelled", "returned"], weights=[85, 8, 7])[0]
        orders.append((oid, cust, odate, status))
        for _ in range(rng.randint(1, 4)):
            prod = rng.randint(1, len(products))
            qty = rng.randint(1, 3)
            unit_price = products[prod - 1][3]
            items.append((item_id, oid, prod, qty, unit_price))
            item_id += 1
    cur.executemany(
        "INSERT INTO orders (order_id, customer_id, order_date, status) VALUES (%s,%s,%s,%s)", orders
    )
    cur.executemany(
        "INSERT INTO order_items (order_item_id, order_id, product_id, quantity, unit_price) VALUES (%s,%s,%s,%s,%s)",
        items,
    )
    # Keep SERIAL sequences ahead of the explicit ids we just inserted.
    cur.execute("SELECT setval('customers_customer_id_seq', %s)", (n_customers,))
    cur.execute("SELECT setval('products_product_id_seq', %s)", (len(products),))
    cur.execute("SELECT setval('orders_order_id_seq', %s)", (n_orders,))
    cur.execute("SELECT setval('order_items_order_item_id_seq', %s)", (item_id - 1,))

    conn.commit()
    cur.execute(
        "SELECT (SELECT COUNT(*) FROM customers) AS c, (SELECT COUNT(*) FROM orders) AS o, "
        "(SELECT COUNT(*) FROM order_items) AS oi"
    )
    counts = cur.fetchone()
    conn.close()
    print(f"Seeded querymind: {counts['c']} customers, {counts['o']} orders, {counts['oi']} order_items")


if __name__ == "__main__":
    build()
