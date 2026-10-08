-- Fictional commerce schema for QUERYMIND. Entirely synthetic data, no PII.
PRAGMA foreign_keys = ON;

CREATE TABLE customers (
    customer_id   INTEGER PRIMARY KEY,
    first_name    TEXT NOT NULL,
    last_name     TEXT NOT NULL,
    city          TEXT NOT NULL,
    signup_date   TEXT NOT NULL  -- ISO date
);

CREATE TABLE products (
    product_id    INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    category      TEXT NOT NULL,
    unit_price    REAL NOT NULL CHECK (unit_price >= 0)
);

CREATE TABLE orders (
    order_id      INTEGER PRIMARY KEY,
    customer_id   INTEGER NOT NULL REFERENCES customers(customer_id),
    order_date    TEXT NOT NULL,
    status        TEXT NOT NULL CHECK (status IN ('completed', 'cancelled', 'returned'))
);

CREATE TABLE order_items (
    order_item_id INTEGER PRIMARY KEY,
    order_id      INTEGER NOT NULL REFERENCES orders(order_id),
    product_id    INTEGER NOT NULL REFERENCES products(product_id),
    quantity      INTEGER NOT NULL CHECK (quantity > 0),
    unit_price    REAL NOT NULL CHECK (unit_price >= 0)
);

-- Approved read-only views: this is the ONLY surface the LLM schema catalog
-- describes and the ONLY set of names the SQL validator allows a query to
-- reference. Base tables are never exposed to the query layer directly, so
-- even a validated SELECT can't be pointed at a table outside this set.
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
    GROUP BY o.order_id;
