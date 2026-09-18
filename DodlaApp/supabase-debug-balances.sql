-- ================================================================
-- DEBUG: why does only one customer show a balance?
-- Shows every component of each customer's balance so we can see
-- exactly what's counted. Read-only — changes nothing.
-- Run in: Supabase Dashboard → SQL Editor
-- ================================================================

-- 1) Per-customer breakdown: purchases, opening('balance' notes), payments, net
WITH purchases AS (
  SELECT it.customer_id,
         SUM(it.quantity * COALESCE(p.wholesale_price, 0)) AS purchases
  FROM inventory_transactions it
  JOIN products p ON p.id = it.product_id
  WHERE it.transaction_type = 'sold' AND it.sale_type = 'wholesale' AND it.customer_id IS NOT NULL
  GROUP BY it.customer_id
),
n AS (
  SELECT customer_id,
         SUM(CASE WHEN note_type = 'balance' THEN COALESCE(amount,0) ELSE 0 END) AS opening_balance_notes,
         SUM(CASE WHEN note_type = 'payment' THEN COALESCE(amount,0) ELSE 0 END) AS payments
  FROM customer_notes
  GROUP BY customer_id
)
SELECT c.name,
       COALESCE(pu.purchases, 0)              AS wholesale_purchases,
       COALESCE(n.opening_balance_notes, 0)   AS balance_notes,
       COALESCE(n.payments, 0)                AS payments,
       ROUND(COALESCE(pu.purchases,0) + COALESCE(n.opening_balance_notes,0) - COALESCE(n.payments,0), 2) AS net_balance
FROM customers c
LEFT JOIN purchases pu ON pu.customer_id = c.id
LEFT JOIN n         ON n.customer_id  = c.id
ORDER BY net_balance DESC;

-- 2) Raw notes for spot-checking specific people (edit names as needed)
SELECT c.name, cn.note_type, cn.amount, cn.note, cn.note_date, cn.created_at
FROM customer_notes cn
JOIN customers c ON c.id = cn.customer_id
WHERE c.name ILIKE ANY (ARRAY['%sai%', '%babu%', '%chandra%', '%chendra%'])
ORDER BY c.name, cn.created_at;
