-- ================================================================
-- REPAIR — rows priced at zero by the first backfill
--
-- WHAT WENT WRONG
--   The original backfill resolved a price with
--       COALESCE(price_at_date, earliest_price, current_price, 0)
--   COALESCE only skips NULL. A product_prices row that stored 0 for a price
--   — which the 2026-08-04 baseline snapshot did for products whose wholesale
--   price had not been set yet — was therefore accepted as a real price of
--   zero, valuing those sales at nothing.
--
--   Visible as customers whose balance went to exactly 0.00 (Mahesh 5,200 -> 0,
--   Krishna 390 -> 0) and as unexplained large drops (Babu -45%).
--
-- WHAT THIS DOES
--   Re-resolves unit_price / unit_cost for rows currently sitting at 0, using
--   the most recent price record that actually HAS a price, and treating a
--   stored 0 as "not set" rather than as free.
--
--   Safe to re-run. Only touches rows whose price is currently 0 AND for which
--   a better price can be found, so it can never overwrite a good value.
--
-- RUN THIS IF: Diagnostic 1 returned rows.
-- Run in: Supabase Dashboard -> SQL Editor
-- ================================================================

-- ── 0. BEFORE: what is about to change ───────────────────────────
SELECT 'BEFORE' AS stage,
       COUNT(*)                                   AS zero_priced_sold_rows,
       MIN(transaction_date)                      AS from_date,
       MAX(transaction_date)                      AS to_date,
       COUNT(*) FILTER (WHERE transaction_date >= '2026-09-01') AS in_september
FROM inventory_transactions
WHERE transaction_type = 'sold'
  AND COALESCE(unit_price, 0) = 0;


BEGIN;

-- ── 1. Correct the trigger for all FUTURE rows ───────────────────
-- Same fix at the write path: fall back to the product's current price whenever
-- the historical record is missing OR stores 0.
CREATE OR REPLACE FUNCTION fill_transaction_prices()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  p_retail    NUMERIC;
  p_wholesale NUMERIC;
  p_purchase  NUMERIC;
BEGIN
  SELECT pp.retail_price, pp.wholesale_price, pp.purchase_price
    INTO p_retail, p_wholesale, p_purchase
  FROM product_prices pp
  WHERE pp.product_id = NEW.product_id
    AND pp.effective_date <= NEW.transaction_date
  ORDER BY pp.effective_date DESC, pp.created_at DESC
  LIMIT 1;

  SELECT COALESCE(NULLIF(p_retail,    0), p.retail_price),
         COALESCE(NULLIF(p_wholesale, 0), p.wholesale_price),
         COALESCE(NULLIF(p_purchase,  0), p.purchase_price)
    INTO p_retail, p_wholesale, p_purchase
  FROM products p WHERE p.id = NEW.product_id;

  IF NEW.unit_price IS NULL AND NEW.transaction_type = 'sold' THEN
    NEW.unit_price := CASE
      WHEN NEW.sale_type = 'wholesale' THEN p_wholesale
      ELSE p_retail
    END;
  END IF;

  IF NEW.transaction_type <> 'sold' THEN
    NEW.unit_price := NULL;
  END IF;

  IF NEW.unit_cost IS NULL THEN
    NEW.unit_cost := p_purchase;
  END IF;

  RETURN NEW;
END $$;


-- ── 2. Re-price the zero rows ────────────────────────────────────
WITH resolved AS (
  SELECT
    it.id,
    it.transaction_type,
    it.sale_type,
    eff.id              AS eff_id,
    eff.retail_price    AS eff_retail,
    eff.wholesale_price AS eff_wholesale,
    eff.purchase_price  AS eff_purchase,
    fb.retail_price     AS fb_retail,
    fb.wholesale_price  AS fb_wholesale,
    fb.purchase_price   AS fb_purchase,
    p.retail_price      AS cur_retail,
    p.wholesale_price   AS cur_wholesale,
    p.purchase_price    AS cur_purchase
  FROM inventory_transactions it
  JOIN products p ON p.id = it.product_id
  -- newest record on/before the date that actually carries a price
  LEFT JOIN LATERAL (
    SELECT pp.* FROM product_prices pp
    WHERE pp.product_id = it.product_id
      AND pp.effective_date <= it.transaction_date
      AND COALESCE(CASE WHEN it.sale_type = 'wholesale' THEN pp.wholesale_price
                        ELSE pp.retail_price END, 0) > 0
    ORDER BY pp.effective_date DESC, pp.created_at DESC
    LIMIT 1
  ) eff ON TRUE
  -- earliest priced record, extended backwards
  LEFT JOIN LATERAL (
    SELECT pp.* FROM product_prices pp
    WHERE pp.product_id = it.product_id
      AND COALESCE(CASE WHEN it.sale_type = 'wholesale' THEN pp.wholesale_price
                        ELSE pp.retail_price END, 0) > 0
    ORDER BY pp.effective_date ASC, pp.created_at ASC
    LIMIT 1
  ) fb ON TRUE
  WHERE it.transaction_type = 'sold'
    AND COALESCE(it.unit_price, 0) = 0
)
UPDATE inventory_transactions t
SET unit_price = CASE
      WHEN r.sale_type = 'wholesale'
        THEN COALESCE(NULLIF(r.eff_wholesale, 0), NULLIF(r.fb_wholesale, 0),
                      NULLIF(r.cur_wholesale, 0), 0)
      ELSE COALESCE(NULLIF(r.eff_retail, 0), NULLIF(r.fb_retail, 0),
                    NULLIF(r.cur_retail, 0), 0)
    END,
    price_estimated = (r.eff_id IS NULL)
FROM resolved r
WHERE t.id = r.id
  -- never overwrite a good value with another zero
  AND CASE
        WHEN r.sale_type = 'wholesale'
          THEN COALESCE(NULLIF(r.eff_wholesale, 0), NULLIF(r.fb_wholesale, 0),
                        NULLIF(r.cur_wholesale, 0), 0)
        ELSE COALESCE(NULLIF(r.eff_retail, 0), NULLIF(r.fb_retail, 0),
                      NULLIF(r.cur_retail, 0), 0)
      END > 0;


-- ── 3. Same for unit_cost (affects profit only, not balances) ────
WITH resolved AS (
  SELECT it.id,
         eff.purchase_price AS eff_purchase,
         fb.purchase_price  AS fb_purchase,
         p.purchase_price   AS cur_purchase
  FROM inventory_transactions it
  JOIN products p ON p.id = it.product_id
  LEFT JOIN LATERAL (
    SELECT pp.* FROM product_prices pp
    WHERE pp.product_id = it.product_id
      AND pp.effective_date <= it.transaction_date
      AND COALESCE(pp.purchase_price, 0) > 0
    ORDER BY pp.effective_date DESC, pp.created_at DESC
    LIMIT 1
  ) eff ON TRUE
  LEFT JOIN LATERAL (
    SELECT pp.* FROM product_prices pp
    WHERE pp.product_id = it.product_id
      AND COALESCE(pp.purchase_price, 0) > 0
    ORDER BY pp.effective_date ASC, pp.created_at ASC
    LIMIT 1
  ) fb ON TRUE
  WHERE COALESCE(it.unit_cost, 0) = 0
)
UPDATE inventory_transactions t
SET unit_cost = COALESCE(NULLIF(r.eff_purchase, 0), NULLIF(r.fb_purchase, 0),
                         NULLIF(r.cur_purchase, 0), 0)
FROM resolved r
WHERE t.id = r.id
  AND COALESCE(NULLIF(r.eff_purchase, 0), NULLIF(r.fb_purchase, 0),
               NULLIF(r.cur_purchase, 0), 0) > 0;

COMMIT;


-- ================================================================
-- VERIFY
-- ================================================================

-- A. Anything still priced at zero? Expect 0 rows, or only products that
--    genuinely have no price anywhere (ice creams / soft drinks never priced).
SELECT p.product_name,
       COUNT(*)                 AS still_zero,
       MIN(it.transaction_date) AS from_date,
       MAX(it.transaction_date) AS to_date,
       p.wholesale_price        AS current_wholesale
FROM inventory_transactions it
JOIN products p ON p.id = it.product_id
WHERE it.transaction_type = 'sold'
  AND COALESCE(it.unit_price, 0) = 0
GROUP BY p.product_name, p.wholesale_price
ORDER BY still_zero DESC;

-- B. Balances after the repair. Compare against the Query B you already ran:
--    'after_fix' should now be higher for Babu, Mahesh, Krishna et al, and
--    'overstated_by' should be a believable price-drift figure rather than a
--    40%+ collapse.
SELECT c.name,
       ROUND(SUM(it.quantity * COALESCE(p.wholesale_price, 0)), 2) AS at_current_prices,
       ROUND(SUM(it.quantity * COALESCE(it.unit_price, 0)), 2)     AS at_prices_charged,
       ROUND(SUM(it.quantity * (COALESCE(p.wholesale_price, 0)
                              - COALESCE(it.unit_price, 0))), 2)   AS difference
FROM inventory_transactions it
JOIN products  p ON p.id = it.product_id
JOIN customers c ON c.id = it.customer_id
WHERE it.transaction_type = 'sold'
  AND it.sale_type = 'wholesale'
  AND it.customer_id IS NOT NULL
GROUP BY c.name
ORDER BY difference DESC;

-- C. September only — the data that matters after the July/August purge.
SELECT c.name,
       ROUND(SUM(it.quantity * COALESCE(it.unit_price, 0)), 2) AS september_purchases,
       COUNT(*) FILTER (WHERE COALESCE(it.unit_price, 0) = 0)  AS zero_priced_rows,
       COUNT(*) FILTER (WHERE it.price_estimated)              AS estimated_rows
FROM inventory_transactions it
JOIN customers c ON c.id = it.customer_id
WHERE it.transaction_type = 'sold'
  AND it.sale_type = 'wholesale'
  AND it.transaction_date >= '2026-09-01'
GROUP BY c.name
ORDER BY september_purchases DESC;
