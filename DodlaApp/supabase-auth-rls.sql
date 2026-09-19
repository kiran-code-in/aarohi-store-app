-- ================================================================
-- Lock down the database: authenticated users only
--
-- Before this, the anonymous (anon) API role could read/write everything —
-- meaning anyone with the public site URL had full access. This script:
--   1. Enables Row Level Security on every table.
--   2. Allows full access ONLY to signed-in (authenticated) users.
--   3. Revokes all access from the anonymous role.
--
-- After running this, the app REQUIRES login (Supabase Auth). Create the
-- three user accounts in Dashboard → Authentication → Users, and turn OFF
-- public sign-ups in Authentication → Providers → Email ("Allow new users").
--
-- Run in: Supabase Dashboard → SQL Editor
-- ================================================================

-- All tables are owned by `postgres`. The SQL Editor may run as a more
-- restricted role, so switch to postgres (the owner) to run DDL.
SET ROLE postgres;

-- Helper: enable RLS + authenticated-only policy for one table
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'products',
    'categories',
    'customers',
    'product_prices',
    'customer_notes',
    'inventory_transactions',
    'advance_orders',
    'advance_order_items'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Skip tables that don't exist yet (e.g. advance orders not migrated)
    IF to_regclass(t) IS NULL THEN
      RAISE NOTICE 'Table % does not exist, skipping.', t;
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);

    -- Remove any prior permissive policies we created before
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_authed', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I;', t || '_all', t);

    -- Full access for signed-in users only
    EXECUTE format(
      'CREATE POLICY %I ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true);',
      t || '_authed', t
    );

    -- Table privileges: grant to authenticated, revoke from anon
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO authenticated;', t);
    EXECUTE format('REVOKE ALL ON %I FROM anon;', t);
  END LOOP;
END $$;

-- The balance view: readable by signed-in users only
DO $$
BEGIN
  IF to_regclass('customer_balances') IS NOT NULL THEN
    EXECUTE 'GRANT SELECT ON customer_balances TO authenticated';
    EXECUTE 'REVOKE ALL ON customer_balances FROM anon';
  END IF;
END $$;

-- Verify: list RLS status per table
SELECT tablename, rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'products','categories','customers','product_prices',
    'customer_notes','inventory_transactions','advance_orders','advance_order_items'
  )
ORDER BY tablename;
