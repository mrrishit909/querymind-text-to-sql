"""Create db/querymind.db from schema.sql and seed it with deterministic synthetic
commerce data (no real customers, no PII). Safe to re-run: drops and recreates."""
import random
import sqlite3
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DB_PATH = ROOT / "querymind.db"
SCHEMA_PATH = ROOT / "schema.sql"

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
    if DB_PATH.exists():
        DB_PATH.unlink()
    conn = sqlite3.connect(DB_PATH)
    conn.executescript(SCHEMA_PATH.read_text())

    start = date(2025, 1, 1)
    customers = []
    for i in range(1, n_customers + 1):
        signup = start + timedelta(days=rng.randint(0, 600))
        customers.append((i, rng.choice(FIRST), rng.choice(LAST), rng.choice(CITIES), signup.isoformat()))
    conn.executemany("INSERT INTO customers VALUES (?,?,?,?,?)", customers)

    products = []
    pid = 1
    for cat, names in CATEGORIES.items():
        for name in names:
            price = round(rng.uniform(5, 150), 2)
            products.append((pid, name, cat, price))
            pid += 1
    conn.executemany("INSERT INTO products VALUES (?,?,?,?)", products)

    orders = []
    items = []
    item_id = 1
    for oid in range(1, n_orders + 1):
        cust = rng.randint(1, n_customers)
        odate = start + timedelta(days=rng.randint(0, 650))
        status = rng.choices(["completed", "cancelled", "returned"], weights=[85, 8, 7])[0]
        orders.append((oid, cust, odate.isoformat(), status))
        for _ in range(rng.randint(1, 4)):
            prod = rng.randint(1, len(products))
            qty = rng.randint(1, 3)
            unit_price = products[prod - 1][3]
            items.append((item_id, oid, prod, qty, unit_price))
            item_id += 1
    conn.executemany("INSERT INTO orders VALUES (?,?,?,?)", orders)
    conn.executemany("INSERT INTO order_items VALUES (?,?,?,?,?)", items)

    conn.commit()
    counts = conn.execute(
        "SELECT (SELECT COUNT(*) FROM customers), (SELECT COUNT(*) FROM orders), (SELECT COUNT(*) FROM order_items)"
    ).fetchone()
    conn.close()
    print(f"Seeded {DB_PATH}: {counts[0]} customers, {counts[1]} orders, {counts[2]} order_items")


if __name__ == "__main__":
    build()
