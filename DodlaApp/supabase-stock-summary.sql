-- ================================================================
-- STEP 3 of 3 — stock_summary(as_of)
--
-- Availability model (unchanged):
--   available(D) = opening(D) + received(D) - wholesale_sold(D) - retail_sold(D)
--   opening(D)   = SUM(received - sold) for ALL transactions dated < D
--   • Damages are IGNORED in stock math (reported separately, not deducted).
--   • Floored at 0 (never negative).
--
-- MONEY (changed): revenue and cost now come from the price SNAPSHOTTED on
-- each transaction row (inventory_transactions.unit_price / unit_cost), not
-- from the current products.* price. Editing a price today no longer rewrites
-- past sales. Run supabase-price-snapshot.sql first.
--
-- The *_price columns still return CURRENT prices — entry screens use them to
-- show what a NEW entry will be recorded at. Do not compute historical money
-- from them; use the revenue_* columns.
--
-- Run in: Supabase Dashboard -> SQL Editor
-- ================================================================

-- Return type changes, so the old signature must go first.
DROP FUNCTION IF EXISTS stock_summary(DATE);

CREATE FUNCTION stock_summary(as_of DATE)
RETURNS TABLE (
  product_id        BIGINT,
  product_name      TEXT,
  category_name     TEXT,
  opening           NUMERIC,   -- carried in from all days before as_of (floored 0)
  received          NUMERIC,   -- received on as_of
  sold_retail       NUMERIC,   -- retail units sold on as_of
  sold_wholesale    NUMERIC,   -- wholesale units sold on as_of
  sold              NUMERIC,   -- total units sold on as_of
  damaged           NUMERIC,   -- damaged units on as_of (reported, NOT deducted)
  available         NUMERIC,   -- opening + received - sold (floored 0)
  revenue_retail    NUMERIC,   -- FROM SNAPSHOTS: sum(qty * unit_price) retail
  revenue_wholesale NUMERIC,   -- FROM SNAPSHOTS: sum(qty * unit_price) wholesale
  cost_of_goods     NUMERIC,   -- FROM SNAPSHOTS: sum(qty * unit_cost) for sold
  damaged_loss      NUMERIC,   -- FROM SNAPSHOTS: sum(qty * unit_cost) for damaged
  price_estimated   BOOLEAN,   -- TRUE if any of the day's rows used an inferred price
  purchase_price    NUMERIC,   -- CURRENT price (for new entries / display only)
  retail_price      NUMERIC,   -- CURRENT price
  wholesale_price   NUMERIC    -- CURRENT price
)
LANGUAGE sql
STABLE
AS $$
  WITH prior AS (  -- net received - sold for all days strictly before as_of
    SELECT it.product_id,
           SUM(CASE WHEN it.transaction_type = 'received' THEN it.quantity
                    WHEN it.transaction_type = 'sold'     THEN -it.quantity
                    ELSE 0 END) AS net
    FROM inventory_transactions it
    WHERE it.transaction_date < as_of
    GROUP BY it.product_id
  ),
  today AS (       -- the day's own movements and its money, from snapshots
    SELECT it.product_id,
           SUM(CASE WHEN it.transaction_type = 'received' THEN it.quantity ELSE 0 END) AS received,
           SUM(CASE WHEN it.transaction_type = 'sold' AND it.sale_type = 'retail'    THEN it.quantity ELSE 0 END) AS sold_retail,
           SUM(CASE WHEN it.transaction_type = 'sold' AND it.sale_type = 'wholesale' THEN it.quantity ELSE 0 END) AS sold_wholesale,
           SUM(CASE WHEN it.transaction_type = 'sold'    THEN it.quantity ELSE 0 END) AS sold,
           SUM(CASE WHEN it.transaction_type = 'damaged' THEN it.quantity ELSE 0 END) AS damaged,
           SUM(CASE WHEN it.transaction_type = 'sold' AND it.sale_type = 'retail'
                    THEN it.quantity * COALESCE(it.unit_price, 0) ELSE 0 END) AS revenue_retail,
           SUM(CASE WHEN it.transaction_type = 'sold' AND it.sale_type = 'wholesale'
                    THEN it.quantity * COALESCE(it.unit_price, 0) ELSE 0 END) AS revenue_wholesale,
           SUM(CASE WHEN it.transaction_type = 'sold'
                    THEN it.quantity * COALESCE(it.unit_cost, 0) ELSE 0 END) AS cost_of_goods,
           SUM(CASE WHEN it.transaction_type = 'damaged'
                    THEN it.quantity * COALESCE(it.unit_cost, 0) ELSE 0 END) AS damaged_loss,
           BOOL_OR(COALESCE(it.price_estimated, FALSE)) AS price_estimated
    FROM inventory_transactions it
    WHERE it.transaction_date = as_of
    GROUP BY it.product_id
  )
  SELECT
    p.id,
    p.product_name,
    COALESCE(c.name, 'Uncategorized'),
    GREATEST(COALESCE(pr.net, 0), 0)                              AS opening,
    COALESCE(t.received, 0)                                       AS received,
    COALESCE(t.sold_retail, 0)                                    AS sold_retail,
    COALESCE(t.sold_wholesale, 0)                                 AS sold_wholesale,
    COALESCE(t.sold, 0)                                           AS sold,
    COALESCE(t.damaged, 0)                                        AS damaged,
    GREATEST(
      GREATEST(COALESCE(pr.net, 0), 0) + COALESCE(t.received, 0) - COALESCE(t.sold, 0)
    , 0)                                                          AS available,
    COALESCE(t.revenue_retail, 0)                                 AS revenue_retail,
    COALESCE(t.revenue_wholesale, 0)                              AS revenue_wholesale,
    COALESCE(t.cost_of_goods, 0)                                  AS cost_of_goods,
    COALESCE(t.damaged_loss, 0)                                   AS damaged_loss,
    COALESCE(t.price_estimated, FALSE)                            AS price_estimated,
    COALESCE(p.purchase_price, 0),
    COALESCE(p.retail_price, 0),
    COALESCE(p.wholesale_price, 0)
  FROM products p
  LEFT JOIN categories c ON c.id = p.category_id
  LEFT JOIN prior pr ON pr.product_id = p.id
  LEFT JOIN today t  ON t.product_id  = p.id
  WHERE p.active = true
  ORDER BY p.category_id, p.product_name;
$$;

-- Allow the app (signed-in users) to call it
GRANT EXECUTE ON FUNCTION stock_summary(DATE) TO authenticated;

-- Quick check (today)
SELECT * FROM stock_summary(CURRENT_DATE);
