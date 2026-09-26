-- ================================================================
-- Damages (deduct from stock) + Home Use / personal consumption
--
-- Changes vs the previous model:
--   • DAMAGED now DEDUCTS from available stock (was reported-only before).
--   • New movement type 'personal' — items taken home. Reduces stock like a
--     sale, valued at PURCHASE price (unit_cost), but excluded from revenue
--     and profit. Reported separately as "home consumption".
--
--   available(D) = opening(D) + received(D) - sold(D) - damaged(D) - personal(D)
--   opening(D)   = SUM(received - sold - damaged - personal) for dates < D
--
-- The price-snapshot trigger already stamps unit_cost on every row type, so
-- 'personal' and 'damaged' rows get their cost automatically. No unit_price
-- for either (they are not sales).
--
-- Run in: Supabase Dashboard -> SQL Editor  (after the price-snapshot scripts)
-- ================================================================

-- ── 1. Allow the 'personal' transaction_type ────────────────────
-- transaction_type is plain TEXT in this project (no enum). If a CHECK
-- constraint was added in the live DB, replace it to include 'personal'.
DO $$
DECLARE
  con TEXT;
BEGIN
  SELECT conname INTO con
  FROM pg_constraint
  WHERE conrelid = 'inventory_transactions'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%transaction_type%';
  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE inventory_transactions DROP CONSTRAINT %I', con);
  END IF;
END $$;

-- (Optional) enforce the allowed set including the new type
ALTER TABLE inventory_transactions
  ADD CONSTRAINT inventory_transactions_type_chk
  CHECK (transaction_type IN ('received','sold','damaged','personal'));

-- ── 2. Rewrite stock_summary: damaged + personal now deduct ──────
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
  damaged           NUMERIC,   -- damaged units on as_of (deducted from stock)
  personal          NUMERIC,   -- home-use units on as_of (deducted from stock)
  available         NUMERIC,   -- opening + received - sold - damaged - personal (floored 0)
  revenue_retail    NUMERIC,   -- FROM SNAPSHOTS: sum(qty * unit_price) retail
  revenue_wholesale NUMERIC,   -- FROM SNAPSHOTS: sum(qty * unit_price) wholesale
  cost_of_goods     NUMERIC,   -- FROM SNAPSHOTS: sum(qty * unit_cost) for sold
  damaged_loss      NUMERIC,   -- FROM SNAPSHOTS: sum(qty * unit_cost) for damaged
  personal_cost     NUMERIC,   -- FROM SNAPSHOTS: sum(qty * unit_cost) for home use
  price_estimated   BOOLEAN,
  purchase_price    NUMERIC,   -- CURRENT price (for new entries / display only)
  retail_price      NUMERIC,
  wholesale_price   NUMERIC
)
LANGUAGE sql
STABLE
AS $$
  WITH prior AS (  -- net stock movement for all days strictly before as_of
    SELECT it.product_id,
           SUM(CASE WHEN it.transaction_type = 'received' THEN it.quantity
                    WHEN it.transaction_type IN ('sold','damaged','personal') THEN -it.quantity
                    ELSE 0 END) AS net
    FROM inventory_transactions it
    WHERE it.transaction_date < as_of
    GROUP BY it.product_id
  ),
  today AS (
    SELECT it.product_id,
           SUM(CASE WHEN it.transaction_type = 'received' THEN it.quantity ELSE 0 END) AS received,
           SUM(CASE WHEN it.transaction_type = 'sold' AND it.sale_type = 'retail'    THEN it.quantity ELSE 0 END) AS sold_retail,
           SUM(CASE WHEN it.transaction_type = 'sold' AND it.sale_type = 'wholesale' THEN it.quantity ELSE 0 END) AS sold_wholesale,
           SUM(CASE WHEN it.transaction_type = 'sold'     THEN it.quantity ELSE 0 END) AS sold,
           SUM(CASE WHEN it.transaction_type = 'damaged'  THEN it.quantity ELSE 0 END) AS damaged,
           SUM(CASE WHEN it.transaction_type = 'personal' THEN it.quantity ELSE 0 END) AS personal,
           SUM(CASE WHEN it.transaction_type = 'sold' AND it.sale_type = 'retail'
                    THEN it.quantity * COALESCE(it.unit_price, 0) ELSE 0 END) AS revenue_retail,
           SUM(CASE WHEN it.transaction_type = 'sold' AND it.sale_type = 'wholesale'
                    THEN it.quantity * COALESCE(it.unit_price, 0) ELSE 0 END) AS revenue_wholesale,
           SUM(CASE WHEN it.transaction_type = 'sold'
                    THEN it.quantity * COALESCE(it.unit_cost, 0) ELSE 0 END) AS cost_of_goods,
           SUM(CASE WHEN it.transaction_type = 'damaged'
                    THEN it.quantity * COALESCE(it.unit_cost, 0) ELSE 0 END) AS damaged_loss,
           SUM(CASE WHEN it.transaction_type = 'personal'
                    THEN it.quantity * COALESCE(it.unit_cost, 0) ELSE 0 END) AS personal_cost,
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
    COALESCE(t.personal, 0)                                       AS personal,
    GREATEST(
      GREATEST(COALESCE(pr.net, 0), 0)
        + COALESCE(t.received, 0)
        - COALESCE(t.sold, 0)
        - COALESCE(t.damaged, 0)
        - COALESCE(t.personal, 0)
    , 0)                                                          AS available,
    COALESCE(t.revenue_retail, 0)                                 AS revenue_retail,
    COALESCE(t.revenue_wholesale, 0)                              AS revenue_wholesale,
    COALESCE(t.cost_of_goods, 0)                                  AS cost_of_goods,
    COALESCE(t.damaged_loss, 0)                                   AS damaged_loss,
    COALESCE(t.personal_cost, 0)                                  AS personal_cost,
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

GRANT EXECUTE ON FUNCTION stock_summary(DATE) TO authenticated;

-- Quick check (today)
SELECT * FROM stock_summary(CURRENT_DATE);
