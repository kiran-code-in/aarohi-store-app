-- ================================================================
-- STEP 1 of 3 — Price snapshot migration
--
-- PROBLEM
--   inventory_transactions stores quantity but NOT the price it sold at.
--   Every rupee figure in the app is therefore computed at read time by
--   multiplying historical quantities by the CURRENT products.* price.
--   Change a price today and every past sale silently re-prices itself,
--   including every customer's outstanding balance.
--
-- FIX
--   Snapshot the price onto each transaction row, then compute money from
--   the snapshot instead of from the current price list.
--
-- RUN ORDER
--   1. supabase-price-snapshot.sql   ← this file  (columns + trigger + backfill)
--   2. INSPECT the backfill          (queries at the bottom of this file)
--   3. supabase-stock-summary.sql    (revenue from snapshots)
--   4. supabase-balance-views.sql    (balances from snapshots)
--   5. Deploy the client
--
--   Steps 1-2 are safe and reversible: they only ADD columns. Nothing reads
--   them until step 3, so the app behaves exactly as before in between.
--
-- Run in: Supabase Dashboard -> SQL Editor
-- ================================================================

BEGIN;

-- ── 1. Columns ────────────────────────────────────────────────────
ALTER TABLE inventory_transactions
  ADD COLUMN IF NOT EXISTS unit_price      NUMERIC,   -- price per unit AT SALE TIME (sold rows only)
  ADD COLUMN IF NOT EXISTS unit_cost       NUMERIC,   -- purchase price per unit at transaction time
  ADD COLUMN IF NOT EXISTS price_estimated BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN inventory_transactions.unit_price IS
  'Selling price per unit, captured when the row was written, resolved from the '
  'price effective on transaction_date. NULL for received/damaged. '
  'Never recompute money from products.* — that is the bug this column fixes.';
COMMENT ON COLUMN inventory_transactions.price_estimated IS
  'TRUE when the backfill could not find a price effective at transaction_date '
  'and had to infer one. Reports should disclose these rather than imply precision.';

-- KNOWN LIMITATION — REVENUE IS EXACT, PROFIT IS APPROXIMATE.
-- unit_cost is the purchase price effective on the SALE's date, not what was
-- actually paid for the specific units being sold. Stock bought yesterday and
-- sold today after a purchase-price rise is costed at the new, higher price, so
-- that day's profit reads low.
--
-- Costing it properly needs a FIFO or weighted-average rule over the 'received'
-- rows (which do carry the price paid at receipt, so the data is available).
-- Deliberately not implemented — it is an accounting choice, and the owner
-- elected to audit profit manually rather than have a rule chosen for them.
-- Revenue, customer balances and all money owed are unaffected by this.
COMMENT ON COLUMN inventory_transactions.unit_cost IS
  'Purchase price per unit effective on transaction_date. NOT the actual cost of '
  'the specific stock sold — no FIFO/average costing — so profit is approximate '
  'across a purchase-price change. Revenue and balances are exact.';


-- ── 2. Trigger: stamp the price on every new row ─────────────────
-- Applied at the DB layer rather than in each client write path, so paths
-- the client forgets (batch entry, barcode scan, advance-order delivery)
-- cannot silently write a price-less row.
CREATE OR REPLACE FUNCTION fill_transaction_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  p_retail    NUMERIC;
  p_wholesale NUMERIC;
  p_purchase  NUMERIC;
BEGIN
  -- Use the price that applied ON THE TRANSACTION'S OWN DATE, not the current
  -- price. For a sale entered today that is today's price, which is what we
  -- want: today's sales bill at today's prices. But the app has a date picker,
  -- so a sale can be entered for an earlier day — and stamping today's price
  -- onto a past date would recreate the very bug this migration fixes.
  SELECT pp.retail_price, pp.wholesale_price, pp.purchase_price
    INTO p_retail, p_wholesale, p_purchase
  FROM product_prices pp
  WHERE pp.product_id = NEW.product_id
    AND pp.effective_date <= NEW.transaction_date
  ORDER BY pp.effective_date DESC, pp.created_at DESC
  LIMIT 1;

  -- No price record covering that date (e.g. a product never re-priced):
  -- fall back to the product's current price.
  IF NOT FOUND THEN
    SELECT retail_price, wholesale_price, purchase_price
      INTO p_retail, p_wholesale, p_purchase
    FROM products WHERE id = NEW.product_id;
  END IF;

  -- unit_price: only meaningful for sales. An explicitly supplied value wins
  -- (backdated entry / corrections can pass the historical price).
  IF NEW.unit_price IS NULL AND NEW.transaction_type = 'sold' THEN
    NEW.unit_price := CASE
      WHEN NEW.sale_type = 'wholesale' THEN p_wholesale
      ELSE p_retail
    END;
  END IF;

  IF NEW.transaction_type <> 'sold' THEN
    NEW.unit_price := NULL;
  END IF;

  -- unit_cost applies to every movement type (profit, and damage loss).
  IF NEW.unit_cost IS NULL THEN
    NEW.unit_cost := p_purchase;
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_fill_transaction_prices ON inventory_transactions;
CREATE TRIGGER trg_fill_transaction_prices
  BEFORE INSERT OR UPDATE OF product_id, transaction_type, sale_type
  ON inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION fill_transaction_prices();


-- ── 3. Backfill existing rows ────────────────────────────────────
-- Resolution order per row:
--   (a) EXACT     — the price record effective at transaction_date
--   (b) INFERRED  — the EARLIEST recorded price for that product, extended
--                   backwards. Used for sales predating price history
--                   (2026-07-01 .. 2026-08-03). Closer to the truth than
--                   today's price, but flagged price_estimated.
--   (c) INFERRED  — the current products.* price, for the ~44 products with
--                   no history at all. Correct for never-repriced products,
--                   a guess otherwise. Also flagged.
--
-- Only touches rows not already snapshotted, so it is safe to re-run.
WITH resolved AS (
  SELECT
    it.id,
    it.transaction_type,
    it.sale_type,
    eff.id                AS eff_id,
    eff.retail_price      AS eff_retail,
    eff.wholesale_price   AS eff_wholesale,
    eff.purchase_price    AS eff_purchase,
    fb.retail_price       AS fb_retail,
    fb.wholesale_price    AS fb_wholesale,
    fb.purchase_price     AS fb_purchase,
    p.retail_price        AS cur_retail,
    p.wholesale_price     AS cur_wholesale,
    p.purchase_price      AS cur_purchase
  FROM inventory_transactions it
  JOIN products p ON p.id = it.product_id
  -- (a) newest price effective on or before the transaction date.
  -- created_at DESC breaks ties because updatePrice() stamps every edit with
  -- effective_date = CURRENT_DATE, so one day can hold several rows; the last
  -- one written is the price that actually stood at end of day.
  LEFT JOIN LATERAL (
    SELECT pp.* FROM product_prices pp
    WHERE pp.product_id = it.product_id
      AND pp.effective_date <= it.transaction_date
    ORDER BY pp.effective_date DESC, pp.created_at DESC
    LIMIT 1
  ) eff ON TRUE
  -- (b) earliest price ever recorded for this product
  LEFT JOIN LATERAL (
    SELECT pp.* FROM product_prices pp
    WHERE pp.product_id = it.product_id
    ORDER BY pp.effective_date ASC, pp.created_at ASC
    LIMIT 1
  ) fb ON TRUE
  WHERE it.unit_price IS NULL
    AND it.unit_cost IS NULL
)
UPDATE inventory_transactions t
SET unit_price = CASE
      WHEN r.transaction_type <> 'sold' THEN NULL
      WHEN r.sale_type = 'wholesale'
        THEN COALESCE(r.eff_wholesale, r.fb_wholesale, r.cur_wholesale, 0)
      ELSE COALESCE(r.eff_retail, r.fb_retail, r.cur_retail, 0)
    END,
    unit_cost = COALESCE(r.eff_purchase, r.fb_purchase, r.cur_purchase, 0),
    price_estimated = (r.eff_id IS NULL)
FROM resolved r
WHERE t.id = r.id;


-- ── 4. Trigger: never lose a price change again ──────────────────
-- Price history was previously written by the client as an un-awaited insert
-- that only console.warn'd on failure (price.service.ts), so history could
-- silently diverge from the actual prices. That is why only 10 of 54 products
-- have any history, and why sales before 2026-08-04 cannot be priced exactly.
--
-- Recording it in the same transaction as the price change makes divergence
-- impossible, and covers every path — app, SQL editor, future admin tooling.
CREATE OR REPLACE FUNCTION record_price_change()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.purchase_price  IS DISTINCT FROM OLD.purchase_price
  OR NEW.retail_price    IS DISTINCT FROM OLD.retail_price
  OR NEW.wholesale_price IS DISTINCT FROM OLD.wholesale_price
  THEN
    -- Collapse same-day no-ops: the Prices page saves per field, so changing
    -- retail then wholesale legitimately writes two rows, but re-saving an
    -- unchanged value should not add a third.
    IF NOT EXISTS (
      SELECT 1 FROM product_prices pp
      WHERE pp.product_id = NEW.id
        AND pp.effective_date = CURRENT_DATE
        AND pp.purchase_price  IS NOT DISTINCT FROM NEW.purchase_price
        AND pp.retail_price    IS NOT DISTINCT FROM NEW.retail_price
        AND pp.wholesale_price IS NOT DISTINCT FROM NEW.wholesale_price
    ) THEN
      INSERT INTO product_prices
        (product_id, purchase_price, retail_price, wholesale_price, effective_date)
      VALUES
        (NEW.id, NEW.purchase_price, NEW.retail_price, NEW.wholesale_price, CURRENT_DATE);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_record_price_change ON products;
CREATE TRIGGER trg_record_price_change
  AFTER UPDATE OF purchase_price, retail_price, wholesale_price
  ON products
  FOR EACH ROW
  EXECUTE FUNCTION record_price_change();


-- ── 5. Index for the balance view ────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_txn_wholesale_customer
  ON inventory_transactions (customer_id, transaction_date)
  WHERE transaction_type = 'sold' AND sale_type = 'wholesale';

-- Backfill lookups and the price-at-date resolution both scan this.
CREATE INDEX IF NOT EXISTS idx_product_prices_lookup
  ON product_prices (product_id, effective_date DESC, created_at DESC);

COMMIT;


-- ================================================================
-- STEP 2 — INSPECT BEFORE CONTINUING
-- Nothing reads the new columns yet. Review these, then run
-- supabase-stock-summary.sql and supabase-balance-views.sql.
-- ================================================================

-- 2a. How much of the backfill is exact vs inferred?
SELECT
  price_estimated,
  COUNT(*)                        AS rows,
  MIN(transaction_date)           AS from_date,
  MAX(transaction_date)           AS to_date
FROM inventory_transactions
GROUP BY price_estimated
ORDER BY price_estimated;

-- 2b. THE MONEY QUERY — how each customer's balance changes at cutover.
--     "shown_now" is today's (wrong) figure computed from current prices.
--     "after_fix" is the frozen figure from the snapshots.
SELECT
  c.name,
  ROUND(SUM(it.quantity * COALESCE(p.wholesale_price, 0)), 2) AS shown_now,
  ROUND(SUM(it.quantity * COALESCE(it.unit_price, 0)), 2)     AS after_fix,
  ROUND(SUM(it.quantity * (COALESCE(p.wholesale_price, 0)
                         - COALESCE(it.unit_price, 0))), 2)   AS overstated_by,
  COUNT(*) FILTER (WHERE it.price_estimated)                  AS inferred_rows,
  COUNT(*)                                                    AS total_rows
FROM inventory_transactions it
JOIN products  p ON p.id = it.product_id
JOIN customers c ON c.id = it.customer_id
WHERE it.transaction_type = 'sold'
  AND it.sale_type = 'wholesale'
  AND it.customer_id IS NOT NULL
GROUP BY c.name
HAVING SUM(it.quantity * (COALESCE(p.wholesale_price, 0)
                        - COALESCE(it.unit_price, 0))) <> 0
ORDER BY overstated_by DESC;

-- 2c. Same, per product — shows which price edits caused the drift.
SELECT
  p.product_name,
  p.wholesale_price                                    AS price_now,
  ROUND(AVG(it.unit_price), 2)                         AS avg_price_charged,
  SUM(it.quantity)                                     AS qty_sold,
  ROUND(SUM(it.quantity * (COALESCE(p.wholesale_price, 0)
                         - COALESCE(it.unit_price, 0))), 2) AS overstated_by
FROM inventory_transactions it
JOIN products p ON p.id = it.product_id
WHERE it.transaction_type = 'sold'
  AND it.sale_type = 'wholesale'
GROUP BY p.product_name, p.wholesale_price
HAVING SUM(it.quantity * (COALESCE(p.wholesale_price, 0)
                        - COALESCE(it.unit_price, 0))) <> 0
ORDER BY overstated_by DESC;

-- 2c-ii. Where does real data actually start?
-- Transactions exist from 2026-07-01, but the owner reports real trading data
-- only begins around 2026-09-15 (earlier rows came from the Excel/Sheets
-- import). This matters: price history starts 2026-08-04, so if real data
-- starts after that, EVERY real sale can be priced exactly and no real row
-- should come out price_estimated.
SELECT date_trunc('month', transaction_date)::date AS month,
       MIN(transaction_date)                       AS first_day,
       MAX(transaction_date)                       AS last_day,
       COUNT(*)                                    AS rows,
       COUNT(*) FILTER (WHERE price_estimated)     AS estimated_rows
FROM inventory_transactions
GROUP BY 1
ORDER BY 1;

-- 2d. Rows the backfill had to guess, by product — the disclosure list.
SELECT
  p.product_name,
  COUNT(*)              AS inferred_rows,
  MIN(it.transaction_date) AS from_date,
  MAX(it.transaction_date) AS to_date
FROM inventory_transactions it
JOIN products p ON p.id = it.product_id
WHERE it.price_estimated
  AND it.transaction_type = 'sold'
GROUP BY p.product_name
ORDER BY inferred_rows DESC;


-- ================================================================
-- ROLLBACK (only valid before steps 3-4 are applied)
-- ================================================================
-- DROP TRIGGER IF EXISTS trg_fill_transaction_prices ON inventory_transactions;
-- DROP FUNCTION IF EXISTS fill_transaction_prices();
-- ALTER TABLE inventory_transactions
--   DROP COLUMN IF EXISTS unit_price,
--   DROP COLUMN IF EXISTS unit_cost,
--   DROP COLUMN IF EXISTS price_estimated;
