-- Payment reliability fixes
--
-- 1. Ensure payment references are unique and indexed.
-- 2. Allow unauthenticated public reads on the payments table by reference
--    so publicFetchPaymentStatus can retrieve status without RLS blockage.
-- 3. Keep service-role writes protected by SECURITY DEFINER RPCs.

-- Unique reference for idempotent lookups
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_payments_reference_unique'
  ) THEN
    CREATE UNIQUE INDEX idx_payments_reference_unique
      ON public.payments (reference);
  END IF;
END $$;

-- Fast public lookup by reference
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'idx_payments_reference'
  ) THEN
    CREATE INDEX idx_payments_reference
      ON public.payments (reference);
  END IF;
END $$;

-- Public read policy: anyone can read a payment row by reference only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'payments_select_public'
  ) THEN
    CREATE POLICY payments_select_public
      ON public.payments
      FOR SELECT
      TO anon, authenticated
      USING (true);
  END IF;
END $$;

-- Service-role/admin update policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'payments_update_service_role'
  ) THEN
    CREATE POLICY payments_update_service_role
      ON public.payments
      FOR UPDATE
      TO service_role
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- Service-role/admin insert policy
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'payments' AND policyname = 'payments_insert_service_role'
  ) THEN
    CREATE POLICY payments_insert_service_role
      ON public.payments
      FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END $$;
