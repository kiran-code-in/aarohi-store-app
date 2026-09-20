-- ================================================================
-- stock_summary(as_of) — cumulative running-ledger availability
--
-- Availability model (agreed):
--   available(D) = opening(D) + received(D) - wholesale_sold(D) - retail_sold(D)
--   opening(D)   = SUM(received - sold) for ALL transactions dated < D
--   → i.e. available = cumulative received - cumulative sold, for dates <= D
--   • Damages are IGNORED entirely (not part of stock math).
--   • Floored at 0 (never negative).
--   • Self-consistent across today / yesterday / gap days.
--
-- Returns one row per active product for the given date.
-- Run in: Supabase Dashboard → SQL Editor
-- ================================================================

CREATE OR REPLACE FUNCTION stock_summary(as_of DATE)
RETURNS TABLE (
  product_id       BIGINT,
  product_name     TEXT,
  category_name    TEXT,
  opening          NUMERIC,   -- carried in from all days before as_of (floored 0)
  received         NUMERIC,   -- received on as_of
  sold_retail      NUMERIC,   -- retail sold on as_of
  sold_wholesale   NUMERIC,   -- wholesale sold on as_of
  sold             NUMERIC,   -- total sold on as_of
  available        NUMERIC,   -- opening + received - sold (floored 0)
  purchase_price   NUMERIC,
  retail_price     NUMERIC,
  wholesale_price  NUMERIC
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
  today AS (       -- the day's own movements
    SELECT it.product_id,
           SUM(CASE WHEN it.transaction_type = 'received' THEN it.quantity ELSE 0 END) AS received,
           SUM(CASE WHEN it.transaction_type = 'sold' AND it.sale_type = 'retail'    THEN it.quantity ELSE 0 END) AS sold_retail,
           SUM(CASE WHEN it.transaction_type = 'sold' AND it.sale_type = 'wholesale' THEN it.quantity ELSE 0 END) AS sold_wholesale,
           SUM(CASE WHEN it.transaction_type = 'sold' THEN it.quantity ELSE 0 END) AS sold
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
    GREATEST(
      GREATEST(COALESCE(pr.net, 0), 0) + COALESCE(t.received, 0) - COALESCE(t.sold, 0)
    , 0)                                                          AS available,
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
