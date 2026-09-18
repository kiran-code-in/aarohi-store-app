-- ================================================================
-- Reset all customer balances to ZERO — start fresh
--
-- Balance = (wholesale purchases + 'balance' notes) − 'payment' notes.
-- This inserts ONE offsetting 'balance' note per customer equal to the
-- NEGATIVE of their current balance, so everyone nets to 0 as of today.
--
-- NON-DESTRUCTIVE: no sales, payments, or history are deleted. Past records
-- stay intact; only the running balance is reset. New sales/payments from
-- today build up fresh.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ================================================================

WITH purchases AS (
  -- Total wholesale purchases per customer
  SELECT it.customer_id,
         SUM(it.quantity * COALESCE(p.wholesale_price, 0)) AS amt
  FROM inventory_transactions it
  JOIN products p ON p.id = it.product_id
  WHERE it.transaction_type = 'sold'
    AND it.sale_type = 'wholesale'
    AND it.customer_id IS NOT NULL
  GROUP BY it.customer_id
),
notes AS (
  -- Net of existing balance/payment notes per customer
  SELECT customer_id,
         SUM(CASE WHEN note_type = 'balance' THEN COALESCE(amount, 0) ELSE 0 END) AS opening,
         SUM(CASE WHEN note_type = 'payment' THEN COALESCE(amount, 0) ELSE 0 END) AS paid
  FROM customer_notes
  GROUP BY customer_id
),
balances AS (
  SELECT c.id AS customer_id,
         ROUND(
           COALESCE(pu.amt, 0) + COALESCE(n.opening, 0) - COALESCE(n.paid, 0)
         , 2) AS balance
  FROM customers c
  LEFT JOIN purchases pu ON pu.customer_id = c.id
  LEFT JOIN notes     n  ON n.customer_id  = c.id
)
INSERT INTO customer_notes (customer_id, note_type, amount, note, note_date)
SELECT customer_id, 'balance', -balance, 'Balance reset — fresh start', CURRENT_DATE
FROM balances
WHERE balance <> 0;

-- Verify: every customer's balance should now be 0
WITH purchases AS (
  SELECT it.customer_id,
         SUM(it.quantity * COALESCE(p.wholesale_price, 0)) AS amt
  FROM inventory_transactions it
  JOIN products p ON p.id = it.product_id
  WHERE it.transaction_type = 'sold' AND it.sale_type = 'wholesale' AND it.customer_id IS NOT NULL
  GROUP BY it.customer_id
),
notes AS (
  SELECT customer_id,
         SUM(CASE WHEN note_type = 'balance' THEN COALESCE(amount,0) ELSE 0 END) AS opening,
         SUM(CASE WHEN note_type = 'payment' THEN COALESCE(amount,0) ELSE 0 END) AS paid
  FROM customer_notes GROUP BY customer_id
)
SELECT c.name,
       ROUND(COALESCE(pu.amt,0) + COALESCE(n.opening,0) - COALESCE(n.paid,0), 2) AS balance
FROM customers c
LEFT JOIN purchases pu ON pu.customer_id = c.id
LEFT JOIN notes n ON n.customer_id = c.id
ORDER BY balance DESC;
