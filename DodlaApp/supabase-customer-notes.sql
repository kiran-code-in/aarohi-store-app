-- ================================================================
-- Customer Notes / Ledger table
-- Tracks payments received, outstanding balances, and general notes
-- Run in: Supabase Dashboard → SQL Editor
-- ================================================================

CREATE TABLE IF NOT EXISTS customer_notes (
  id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  customer_id  UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  note_type    TEXT NOT NULL DEFAULT 'note',   -- 'payment' | 'balance' | 'note'
  amount       NUMERIC DEFAULT 0,              -- +ve = payment received, used for balance calc
  note         TEXT,                           -- free text
  note_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast per-customer lookups
CREATE INDEX IF NOT EXISTS idx_customer_notes_customer
  ON customer_notes (customer_id, note_date DESC);

-- ── How balance works ──
-- Balance owed by a customer =
--   (total wholesale sales amount) − (total payments recorded in customer_notes where note_type='payment')
--
-- note_type meanings:
--   'payment' → customer paid money; amount = amount paid (reduces balance)
--   'balance' → manual balance adjustment/opening balance; amount = balance amount
--   'note'    → just a text note, amount ignored

-- Verify
SELECT 'customer_notes table created' AS status;
