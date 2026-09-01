-- Read-only production audit for payment completion.
-- Run each statement in the Supabase SQL editor. It performs no writes.

-- 1. Exact deployed column types, defaults, and nullability.
SELECT
  table_name,
  column_name,
  data_type,
  udt_name,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('payments', 'wallets', 'wallet_transactions', 'organizations', 'supported_currencies')
ORDER BY table_name, ordinal_position;

-- 2. Every complete_payment overload exposed by PostgreSQL/PostgREST.
SELECT
  p.oid::regprocedure AS signature,
  pg_get_function_identity_arguments(p.oid) AS identity_arguments,
  pg_get_function_result(p.oid) AS return_type,
  p.prosecdef AS security_definer,
  p.proacl AS privileges,
  pg_get_functiondef(p.oid) AS definition
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'complete_payment'
ORDER BY p.oid;

-- 3. Triggers that can run indirectly during payment, wallet, or ledger writes.
SELECT
  c.relname AS table_name,
  t.tgname AS trigger_name,
  pg_get_triggerdef(t.oid, true) AS trigger_definition,
  p.oid::regprocedure AS trigger_function_signature,
  pg_get_functiondef(p.oid) AS trigger_function_definition
FROM pg_trigger AS t
JOIN pg_class AS c ON c.oid = t.tgrelid
JOIN pg_proc AS p ON p.oid = t.tgfoid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('payments', 'wallets', 'wallet_transactions')
  AND NOT t.tgisinternal
ORDER BY c.relname, t.tgname;

-- 4. Foreign keys and unique constraints relevant to payment and ledger identity.
SELECT
  c.relname AS table_name,
  con.conname AS constraint_name,
  con.contype AS constraint_type,
  pg_get_constraintdef(con.oid, true) AS definition
FROM pg_constraint AS con
JOIN pg_class AS c ON c.oid = con.conrelid
JOIN pg_namespace AS n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('payments', 'wallets', 'wallet_transactions')
ORDER BY c.relname, con.contype, con.conname;

-- 5. Indexes, including the payment-reference uniqueness guarantee.
SELECT
  tablename AS table_name,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('payments', 'wallets', 'wallet_transactions')
ORDER BY tablename, indexname;

-- 6. RLS policies that may affect SECURITY INVOKER completion calls.
SELECT
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('payments', 'wallets', 'wallet_transactions')
ORDER BY tablename, policyname;

-- 7. Current state and runtime PostgreSQL types for the reported payment.
SELECT
  p.id AS payment_id,
  pg_typeof(p.id) AS payment_id_type,
  p.reference,
  pg_typeof(p.reference) AS reference_type,
  p.status,
  p.amount,
  pg_typeof(p.amount) AS amount_type,
  p.currency,
  p.wallet_id,
  pg_typeof(p.wallet_id) AS wallet_id_type,
  p.organization_id,
  pg_typeof(p.organization_id) AS organization_id_type,
  p.provider,
  w.id AS resolved_wallet_id,
  pg_typeof(w.id) AS resolved_wallet_id_type,
  w.balance_amount AS wallet_balance,
  pg_typeof(w.balance_amount) AS wallet_balance_type,
  w.currency AS wallet_currency
FROM public.payments AS p
LEFT JOIN public.wallets AS w ON w.id = p.wallet_id
WHERE p.reference = 'PAY-MTA0SP3J-CF2D477A5FF0';

-- 8. Ledger rows for that payment. reference_id_type proves the comparison boundary.
SELECT
  wt.id,
  wt.wallet_id,
  pg_typeof(wt.wallet_id) AS wallet_id_type,
  wt.reference_id,
  pg_typeof(wt.reference_id) AS reference_id_type,
  wt.reference_type,
  wt.idempotency_key,
  wt.amount,
  wt.currency,
  wt.balance_after,
  wt.created_at
FROM public.wallet_transactions AS wt
WHERE wt.reference_id = '6a7d5188-b0dc-44ed-9a03-f178c5017fa9'
   OR wt.idempotency_key = 'payment_6a7d5188-b0dc-44ed-9a03-f178c5017fa9'
ORDER BY wt.created_at;
