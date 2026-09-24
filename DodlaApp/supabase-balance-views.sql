-- ================================================================
-- STEP 4 of 3 — Balance aggregation views
-- Pre-aggregate per-customer wholesale purchases and note totals on the DB
-- side, so the app reads ONE row per customer instead of summing thousands
-- of transaction rows client-side (which hits Supabase's 1000-row cap and
-- undercounts balances).
--
-- FIXED: purchases now use the price SNAPSHOTTED on each transaction
-- (inventory_transactions.unit_price) instead of joining to the current
-- products.wholesale_price.
--
-- The old version multiplied every historical quantity by TODAY's price and
-- had no date filter at all, so a single price edit silently rewrote every
-- customer's outstanding balance for all time. Run supabase-price-snapshot.sql
-- first — this view reads the columns it adds.
--
-- Note there is no longer any join to products: money owed must never depend
-- on the current price list.
--
-- Run in: Supabase Dashboard -> SQL Editor
-- ================================================================

CREATE OR REPLACE VIEW customer_balances AS
WITH purchases AS (
  SELECT it.customer_id,
         SUM(it.quantity * COALESCE(it.unit_price, 0)) AS purchases,
         -- surfaced so the app can disclose inferred pricing rather than
         -- implying a precision the backfilled data does not have
         BOOL_OR(COALESCE(it.price_estimated, FALSE))  AS has_estimated_prices
  FROM inventory_transactions it
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
  ROUND(COALESCE(pu.purchases, 0) + COALESCE(n.opening, 0) - COALESCE(n.paid, 0), 2) AS balance,
  COALESCE(pu.has_estimated_prices, FALSE)          AS has_estimated_prices
FROM customers c
LEFT JOIN purchases pu ON pu.customer_id = c.id
LEFT JOIN n         ON n.customer_id  = c.id;

GRANT SELECT ON customer_balances TO authenticated;
REVOKE ALL ON customer_balances FROM anon;

SELECT 'customer_balances view created' AS status;
