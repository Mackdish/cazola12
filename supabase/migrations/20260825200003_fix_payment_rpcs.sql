-- Fix broken payment RPCs and ensure wallet credit happens atomically
--
-- Root cause: complete_payment marked the payment as completed but never
-- credited the wallet. This left wallets at 0 even though payments showed
-- as completed.
--
-- Fix: complete_payment now atomically:
--   1. Marks payment as completed
--   2. Credits the wallet
--   3. Creates the immutable wallet ledger entry
--   4. Updates lifetime_deposited
--   5. Returns the new wallet balance
--
-- fail_payment and cancel_payment are also fixed for ambiguous column refs.
-- deposit_to_wallet_for_currency is fixed for wallet lookup.

-- ============================================================================
-- deposit_to_wallet_for_currency
-- ============================================================================
DROP FUNCTION IF EXISTS public.deposit_to_wallet_for_currency(_organization_id uuid, _amount numeric, _currency text, _idempotency_key text, _description text);

CREATE OR REPLACE FUNCTION public.deposit_to_wallet_for_currency(
  _organization_id uuid,
  _amount numeric,
  _currency text,
  _idempotency_key text,
  _description text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  _wallet record;
  _existing_txn record;
  _balance_after numeric;
BEGIN
  IF _amount IS NULL OR _amount <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'duplicate', false, 'balance', 0, 'currency', _currency);
  END IF;

  SELECT id, balance_amount, currency
    INTO _wallet
    FROM public.wallets
   WHERE organization_id = _organization_id
     AND currency = _currency
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'duplicate', false, 'balance', 0, 'currency', _currency);
  END IF;

  SELECT 1 INTO _existing_txn
    FROM public.wallet_transactions
   WHERE idempotency_key = _idempotency_key
     AND wallet_id = _wallet.id
   LIMIT 1;

  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'duplicate', true, 'balance', _wallet.balance_amount, 'currency', _wallet.currency);
  END IF;

  _balance_after := COALESCE(_wallet.balance_amount, 0) + _amount;

  UPDATE public.wallets
     SET balance_amount = _balance_after,
         lifetime_deposited = COALESCE(lifetime_deposited, 0) + _amount,
         updated_at = now()
   WHERE id = _wallet.id;

  INSERT INTO public.wallet_transactions (
    id, wallet_id, organization_id, type, amount, balance_after,
    currency, description, idempotency_key, reference_type, reference_id, created_by
  ) VALUES (
    gen_random_uuid(),
    _wallet.id,
    _organization_id,
    'deposit',
    _amount,
    _balance_after,
    _wallet.currency,
    _description,
    _idempotency_key,
      'payment_deposit',
    NULL,
    NULL
  );

  RETURN jsonb_build_object('ok', true, 'duplicate', false, 'balance', _balance_after, 'currency', _wallet.currency);
END;
$$;

-- ============================================================================
-- complete_payment
-- ============================================================================
-- Atomically marks payment as completed AND credits the wallet.
-- Idempotent: repeated callbacks for the same payment will not double-credit.
-- ============================================================================
DROP FUNCTION IF EXISTS public.complete_payment(_payment_id uuid, _provider text, _provider_reference text, _provider_transaction_id text, _provider_receipt text);

CREATE OR REPLACE FUNCTION public.complete_payment(
  _payment_id uuid,
  _provider text DEFAULT 'payzaapi',
  _provider_reference text DEFAULT NULL,
  _provider_transaction_id text DEFAULT NULL,
  _provider_receipt text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  _payment record;
  _wallet record;
  _existing_txn record;
  _balance_after numeric;
  _wallet_balance numeric;
  _already_completed boolean := false;
BEGIN
  -- Lock and fetch the payment
  SELECT id, status, amount, currency, wallet_id, organization_id, provider
    INTO _payment
    FROM public.payments
   WHERE id = _payment_id
     AND provider = _provider
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found for id=% provider=%', _payment_id, _provider;
  END IF;

  -- Idempotency: if already completed, return current wallet balance without re-crediting
  IF _payment.status = 'completed' THEN
    _already_completed := true;
    SELECT balance_amount INTO _wallet_balance FROM public.wallets WHERE id = _payment.wallet_id;
    RETURN jsonb_build_object(
      'payment_id', _payment.id,
      'status', 'completed',
      'wallet_balance', COALESCE(_wallet_balance, 0),
      'already_completed', true
    );
  END IF;

  IF _payment.status NOT IN ('pending', 'processing') THEN
    RAISE EXCEPTION 'Payment id=% is in status=% and cannot be completed', _payment_id, _payment.status;
  END IF;

  -- Lock the wallet
  SELECT id, balance_amount, currency, organization_id
    INTO _wallet
    FROM public.wallets
   WHERE id = _payment.wallet_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for id=%', _payment.wallet_id;
  END IF;

  -- Idempotency: check if this payment already created a wallet transaction
  SELECT 1 INTO _existing_txn
    FROM public.wallet_transactions
   WHERE reference_id = _payment.id
     AND reference_type = 'payment'
   LIMIT 1;

  IF NOT FOUND THEN
    -- Credit the wallet
    _balance_after := COALESCE(_wallet.balance_amount, 0) + _payment.amount;

    UPDATE public.wallets
       SET balance_amount = _balance_after,
           lifetime_deposited = COALESCE(lifetime_deposited, 0) + _payment.amount,
           updated_at = now()
     WHERE id = _wallet.id;

    -- Create immutable wallet ledger entry
    INSERT INTO public.wallet_transactions (
      id, wallet_id, organization_id, type, amount, balance_after,
      currency, description, idempotency_key, reference_type, reference_id, created_by
    ) VALUES (
      gen_random_uuid(),
      _wallet.id,
      _wallet.organization_id,
      'deposit',
      _payment.amount,
      _balance_after,
      _wallet.currency,
      'Payment deposit: ' || _payment.reference,
      'payment_' || _payment.id,
      'payment',
      _payment.id,
      NULL
    );
  END IF;

  -- Mark payment as completed
  UPDATE public.payments
     SET status = 'completed',
         completed_at = now(),
         updated_at = now(),
         provider_reference = COALESCE(_provider_reference, provider_reference),
         provider_transaction_id = COALESCE(_provider_transaction_id, provider_transaction_id),
         provider_receipt = COALESCE(_provider_receipt, provider_receipt),
         callback_received_at = COALESCE(callback_received_at, now()),
         verified_at = COALESCE(verified_at, now())
   WHERE id = _payment.id;

  -- Get final wallet balance
  SELECT balance_amount INTO _wallet_balance FROM public.wallets WHERE id = _wallet.id;

  RETURN jsonb_build_object(
    'payment_id', _payment.id,
    'status', 'completed',
    'wallet_balance', COALESCE(_wallet_balance, 0),
    'already_completed', false
  );
END;
$$;

-- ============================================================================
-- fail_payment
-- ============================================================================
DROP FUNCTION IF EXISTS public.fail_payment(_payment_id uuid, _provider text, _failure_reason text);

CREATE OR REPLACE FUNCTION public.fail_payment(
  _payment_id uuid,
  _provider text DEFAULT 'payzaapi',
  _failure_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  _payment record;
BEGIN
  SELECT id, status
    INTO _payment
    FROM public.payments
   WHERE id = _payment_id
     AND provider = _provider
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found for id=% provider=%', _payment_id, _provider;
  END IF;

  IF _payment.status IN ('completed', 'failed', 'cancelled') THEN
    RETURN jsonb_build_object('payment_id', _payment.id, 'status', _payment.status);
  END IF;

  UPDATE public.payments
     SET status = 'failed',
         failed_at = now(),
         updated_at = now(),
         failure_reason = _failure_reason
   WHERE id = _payment.id;

  RETURN jsonb_build_object('payment_id', _payment.id, 'status', 'failed');
END;
$$;

-- ============================================================================
-- cancel_payment
-- ============================================================================
DROP FUNCTION IF EXISTS public.cancel_payment(_payment_id uuid, _provider text);

CREATE OR REPLACE FUNCTION public.cancel_payment(
  _payment_id uuid,
  _provider text DEFAULT 'payzaapi'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  _payment record;
BEGIN
  SELECT id, status
    INTO _payment
    FROM public.payments
   WHERE id = _payment_id
     AND provider = _provider
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found for id=% provider=%', _payment_id, _provider;
  END IF;

  IF _payment.status IN ('completed', 'failed', 'cancelled') THEN
    RETURN jsonb_build_object('payment_id', _payment.id, 'status', _payment.status);
  END IF;

  UPDATE public.payments
     SET status = 'cancelled',
         updated_at = now()
   WHERE id = _payment.id;

  RETURN jsonb_build_object('payment_id', _payment.id, 'status', 'cancelled');
END;
$$;
