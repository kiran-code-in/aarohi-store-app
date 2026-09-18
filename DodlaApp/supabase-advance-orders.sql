-- ================================================================
-- Advance Orders (pre-orders / bookings)
-- A customer pays an advance (full or partial) for specific items to be
-- delivered on a requested date (usually 1-3 days later).
--   status: 'pending'   → order placed, not yet delivered
--           'delivered' → goods handed over (recorded as a wholesale sale)
--           'cancelled' → order called off
-- Run in: Supabase Dashboard → SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS advance_orders (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  order_date     DATE NOT NULL DEFAULT CURRENT_DATE,   -- when the advance was taken
  requested_date DATE NOT NULL,                         -- when customer wants delivery
  advance_amount NUMERIC NOT NULL DEFAULT 0,            -- money paid up front
  paid_full      BOOLEAN NOT NULL DEFAULT FALSE,        -- true = whole amount paid now
  status         TEXT NOT NULL DEFAULT 'pending',       -- 'pending' | 'delivered' | 'cancelled'
  note           TEXT,
  delivered_date DATE,                                  -- set when marked delivered
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS advance_order_items (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  order_id   BIGINT NOT NULL REFERENCES advance_orders(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id),
  quantity   NUMERIC NOT NULL DEFAULT 0
);

-- Fast lookups of pending orders and their items
CREATE INDEX IF NOT EXISTS idx_advance_orders_status
  ON advance_orders (status, requested_date);
CREATE INDEX IF NOT EXISTS idx_advance_orders_customer
  ON advance_orders (customer_id);
CREATE INDEX IF NOT EXISTS idx_advance_order_items_order
  ON advance_order_items (order_id);

-- ── How delivery works (handled in app code) ──
-- When an order is marked 'delivered':
--   1. Each item is recorded as a wholesale 'sold' inventory_transaction for
--      the customer on the delivered_date.
--   2. The advance_amount is recorded as a 'payment' in customer_notes so the
--      customer's balance nets out. A partial advance leaves a remaining
--      balance due; a full advance settles it.

SELECT 'advance_orders + advance_order_items created' AS status;
