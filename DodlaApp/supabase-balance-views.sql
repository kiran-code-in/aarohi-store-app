-- ================================================================
-- Balance aggregation views
-- Pre-aggregate per-customer wholesale purchases and note totals on the DB
-- side, so the app reads ONE row per customer instead of summing thousands
-- of transaction rows client-side (which hits Supabase's 1000-row cap and
-- undercounts balances).
-- Run in: Supabase Dashboard → SQL Editor
-- ================================================================

-- Per-customer computed balance
CREATE OR REPLACE VIEW customer_balances AS
WITH purchases AS (
  SELECT it.customer_id,
         SUM(it.quantity * COALESCE(p.wholesale_price, 0)) AS purchases
  FROM inventory_transactions it
  JOIN products p ON p.id = it.product_id
  WHERE it.transaction_type = 'sold'
    AND it.sale_type = 'wholesale'
    AND it.customer_id IS NOT NULL
  GROUP BY it.customer_id
),
n AS (
  SELECT customer_id,
         SUM(CASE WHEN note_type = 'balance' THEN COALESCE(amount, 0) ELSE 0 END) AS opening,
         SUM(CASE WHEN note_type = 'payment' THEN COALESCE(amount, 0) ELSE 0 END) AS paid
  FROM customer_notes
  GROUP BY customer_id
)
SELECT
  c.id                                              AS customer_id,
  c.name                                            AS customer_name,
  ROUND(COALESCE(pu.purchases, 0) + COALESCE(n.opening, 0), 2) AS total_purchases,
  ROUND(COALESCE(n.paid, 0), 2)                     AS total_paid,
  ROUND(COALESCE(pu.purchases, 0) + COALESCE(n.opening, 0) - COALESCE(n.paid, 0), 2) AS balance
FROM customers c
LEFT JOIN purchases pu ON pu.customer_id = c.id
LEFT JOIN n         ON n.customer_id  = c.id;

SELECT 'customer_balances view created' AS status;
