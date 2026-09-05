-- ================================================================
-- Aarohi Enterprises — Supabase Data Update
-- Products already exist in DB. This script:
--   1. Updates prices using real data from CSV + sheet calculations
--   2. Seeds customers (wholesale buyers from daily sheets)
--   3. Records a baseline price history snapshot
--   4. Seeds one day of sample transactions (Aug 2 data from sheet)
--
-- Run in: Supabase Dashboard → SQL Editor
-- ================================================================

-- ── Step 1: Update Dairy Product Prices ──────────────────────
-- Source: products_rows.csv (actual Supabase export)
-- IDs match exactly what's in your DB

UPDATE products SET
  purchase_price = 37.08,
  retail_price   = 40.00,
  wholesale_price= 39.00,
  tracking_mode  = 'DAILY',
  updated_at     = NOW()
WHERE id = 1; -- FCM

UPDATE products SET
  purchase_price = 31.25,
  retail_price   = 35.00,
  wholesale_price= 34.00,
  tracking_mode  = 'DAILY',
  updated_at     = NOW()
WHERE id = 2; -- STD

UPDATE products SET
  purchase_price = 8.63,
  retail_price   = 10.00,
  wholesale_price= 9.50,
  tracking_mode  = 'DAILY',
  updated_at     = NOW()
WHERE id = 3; -- Milk 200ml

UPDATE products SET
  purchase_price = 8.50,
  retail_price   = 10.00,
  wholesale_price= 9.50,
  tracking_mode  = 'DAILY',
  updated_at     = NOW()
WHERE id = 4; -- Curd 200ml

UPDATE products SET
  purchase_price = 33.50,
  retail_price   = 38.00,
  wholesale_price= 36.00,
  tracking_mode  = 'DAILY',
  updated_at     = NOW()
WHERE id = 5; -- Curd 500ml

UPDATE products SET
  purchase_price = 310.00,
  retail_price   = 340.00,
  wholesale_price= 330.00,
  tracking_mode  = 'DAILY',
  updated_at     = NOW()
WHERE id = 6; -- Curd 5L

UPDATE products SET
  purchase_price = 610.00,
  retail_price   = 660.00,
  wholesale_price= 650.00,
  tracking_mode  = 'DAILY',
  updated_at     = NOW()
WHERE id = 7; -- Curd 10L

UPDATE products SET
  purchase_price = 6.70,
  retail_price   = 10.00,
  wholesale_price= 9.00,
  tracking_mode  = 'DAILY',
  updated_at     = NOW()
WHERE id = 8; -- Butter Milk

UPDATE products SET
  purchase_price = 8.00,
  retail_price   = 10.00,
  wholesale_price= 9.00,
  tracking_mode  = 'DAILY',
  updated_at     = NOW()
WHERE id = 9; -- Lassi

UPDATE products SET
  purchase_price = 91.66,
  retail_price   = 100.00,
  wholesale_price= 97.00,
  tracking_mode  = 'PERIODIC',
  updated_at     = NOW()
WHERE id = 54; -- Curd 1kg

-- ── Step 2: Seed Customers ────────────────────────────────────
-- Insert only if not already present (safe to re-run)
INSERT INTO customers (name, customer_type)
SELECT name, 'wholesale' FROM (VALUES
  ('Chendramouli'),  ('Narayana'),      ('Laxmana'),
  ('Babu'),          ('Pratap'),         ('Nagaraju'),
  ('Venu'),          ('Mounika'),        ('Malyadri'),
  ('Krishna'),       ('Ashok'),          ('Rajesh'),
  ('Mahesh'),        ('Ramesh'),         ('Dinesh'),
  ('Sreenu'),        ('Murali'),         ('Gopal'),
  ('Raju'),          ('Ramana'),         ('Ragaiah'),
  ('Madhu'),         ('Channaiah'),      ('Bramhaiah'),
  ('Kondapa Naidu'), ('Padma'),          ('Suri'),
  ('Rayudu'),        ('Balaiah'),        ('Sri Hari'),
  ('Kumar'),         ('Aparna'),         ('Mallema'),
  ('Narasimha'),     ('Raja'),           ('Gangupenta'),
  ('Bhashkar'),      ('Tirupati Reddy'),
  ('Chintaladevi')
) AS t(name)
WHERE NOT EXISTS (
  SELECT 1 FROM customers c WHERE LOWER(c.name) = LOWER(t.name)
);

-- ── Step 3: Price History Snapshot (baseline) ─────────────────
-- Records current prices as a dated snapshot in product_prices
INSERT INTO product_prices (product_id, purchase_price, retail_price, wholesale_price, effective_date)
SELECT id, purchase_price, retail_price, wholesale_price, CURRENT_DATE
FROM products
WHERE purchase_price > 0
  AND NOT EXISTS (
    SELECT 1 FROM product_prices pp
    WHERE pp.product_id = products.id
      AND pp.effective_date = CURRENT_DATE
  );

-- ── Step 4: Sample Inventory (Aug 2 data from Google Sheet) ───
-- Only inserts if no transactions exist for that date yet
DO $$
DECLARE
  v_date DATE := '2026-08-02';
BEGIN
  IF EXISTS (SELECT 1 FROM inventory_transactions WHERE transaction_date = v_date) THEN
    RAISE NOTICE 'Transactions for % already exist, skipping.', v_date;
    RETURN;
  END IF;

  -- Received stock (from "Quantity received" row in sheet)
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type) VALUES
    (1,  'received', 36, v_date, NULL),  -- FCM
    (2,  'received', 24, v_date, NULL),  -- STD
    (3,  'received', 90, v_date, NULL),  -- Milk 200ml
    (5,  'received', 42, v_date, NULL),  -- Curd 500ml
    (4,  'received',100, v_date, NULL),  -- Curd 200ml
    (7,  'received',  2, v_date, NULL),  -- Curd 10L
    (6,  'received',  1, v_date, NULL),  -- Curd 5L
    (9,  'received',  0, v_date, NULL),  -- Lassi
    (8,  'received',  0, v_date, NULL);  -- Butter Milk

  -- Wholesale sales (from sheet, per customer)
  -- Chendramouli: FCM=10, Milk200=10, Curd500=20
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 1, 'sold', 10, v_date, 'wholesale', id, 'Chendramouli' FROM customers WHERE name='Chendramouli' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 3, 'sold', 10, v_date, 'wholesale', id, 'Chendramouli' FROM customers WHERE name='Chendramouli' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 5, 'sold', 20, v_date, 'wholesale', id, 'Chendramouli' FROM customers WHERE name='Chendramouli' LIMIT 1;

  -- Narayana: Milk200=10, Curd200=10
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 3, 'sold', 10, v_date, 'wholesale', id, 'Narayana' FROM customers WHERE name='Narayana' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 4, 'sold', 10, v_date, 'wholesale', id, 'Narayana' FROM customers WHERE name='Narayana' LIMIT 1;

  -- Babu: FCM=4, STD=10, Milk200=20, Curd500=6, Curd200=25, Curd10L=1
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 1, 'sold',  4, v_date, 'wholesale', id, 'Babu' FROM customers WHERE name='Babu' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 2, 'sold', 10, v_date, 'wholesale', id, 'Babu' FROM customers WHERE name='Babu' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 3, 'sold', 20, v_date, 'wholesale', id, 'Babu' FROM customers WHERE name='Babu' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 5, 'sold',  6, v_date, 'wholesale', id, 'Babu' FROM customers WHERE name='Babu' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 4, 'sold', 25, v_date, 'wholesale', id, 'Babu' FROM customers WHERE name='Babu' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 7, 'sold',  1, v_date, 'wholesale', id, 'Babu' FROM customers WHERE name='Babu' LIMIT 1;

  -- Pratap: STD=2, Curd10L=1
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 2, 'sold', 2, v_date, 'wholesale', id, 'Pratap' FROM customers WHERE name='Pratap' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 7, 'sold', 1, v_date, 'wholesale', id, 'Pratap' FROM customers WHERE name='Pratap' LIMIT 1;

  -- Malyadri: Curd500=5, Curd200=10
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 5, 'sold',  5, v_date, 'wholesale', id, 'Malyadri' FROM customers WHERE name='Malyadri' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 4, 'sold', 10, v_date, 'wholesale', id, 'Malyadri' FROM customers WHERE name='Malyadri' LIMIT 1;

  -- Mounika: Milk200=4, Curd500=5, Curd200=3, ButtMilk=5
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 3, 'sold', 4, v_date, 'wholesale', id, 'Mounika' FROM customers WHERE name='Mounika' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 5, 'sold', 5, v_date, 'wholesale', id, 'Mounika' FROM customers WHERE name='Mounika' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 4, 'sold', 3, v_date, 'wholesale', id, 'Mounika' FROM customers WHERE name='Mounika' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 8, 'sold', 5, v_date, 'wholesale', id, 'Mounika' FROM customers WHERE name='Mounika' LIMIT 1;

  -- Bhashkar: Milk200=20
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 3, 'sold', 20, v_date, 'wholesale', id, 'Bhashkar' FROM customers WHERE name='Bhashkar' LIMIT 1;

  -- Venu: Milk200=11, Curd200=10
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 3, 'sold', 11, v_date, 'wholesale', id, 'Venu' FROM customers WHERE name='Venu' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 4, 'sold', 10, v_date, 'wholesale', id, 'Venu' FROM customers WHERE name='Venu' LIMIT 1;

  -- Tirupati Reddy: Milk200=5, Curd200=5
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 3, 'sold',  5, v_date, 'wholesale', id, 'Tirupati Reddy' FROM customers WHERE name='Tirupati Reddy' LIMIT 1;
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type, customer_id, remarks)
  SELECT 4, 'sold',  5, v_date, 'wholesale', id, 'Tirupati Reddy' FROM customers WHERE name='Tirupati Reddy' LIMIT 1;

  -- Retail sales (from sheet retail columns)
  INSERT INTO inventory_transactions (product_id, transaction_type, quantity, transaction_date, sale_type) VALUES
    (1,  'sold', 14, v_date, 'retail'),  -- FCM
    (3,  'sold', 14, v_date, 'retail'),  -- Milk 200ml
    (5,  'sold', 12, v_date, 'retail'),  -- Curd 500ml
    (4,  'sold', 32, v_date, 'retail'),  -- Curd 200ml
    (8,  'sold', 20, v_date, 'retail'),  -- Butter Milk
    (9,  'sold', 29, v_date, 'retail');  -- Lassi

END $$;

-- ── Verify ────────────────────────────────────────────────────
SELECT
  (SELECT COUNT(*) FROM products WHERE purchase_price > 0) AS products_with_prices,
  (SELECT COUNT(*) FROM customers) AS total_customers,
  (SELECT COUNT(*) FROM product_prices) AS price_history_entries,
  (SELECT COUNT(*) FROM inventory_transactions) AS total_transactions;
