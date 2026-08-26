-- Repair complete_payment without changing the existing ledger schema.
-- wallet_transactions.reference_id is a polymorphic text reference, while
-- payments.id is uuid. Convert at the ledger boundary explicitly.

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
BEGIN
  SELECT id, status, amount, currency, wallet_id, organization_id, provider, reference
    INTO _payment
    FROM public.payments
   WHERE id = _payment_id
     AND provider = _provider
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment not found for id=% provider=%', _payment_id, _provider;
  END IF;

  IF _payment.status = 'completed' THEN
    SELECT balance_amount
      INTO _wallet_balance
      FROM public.wallets
     WHERE id = _payment.wallet_id;

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

  SELECT id, balance_amount, currency, organization_id
    INTO _wallet
    FROM public.wallets
   WHERE id = _payment.wallet_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found for id=%', _payment.wallet_id;
  END IF;

  IF _wallet.currency IS DISTINCT FROM _payment.currency THEN
    RAISE EXCEPTION 'Wallet currency % does not match payment currency %', _wallet.currency, _payment.currency;
  END IF;

  SELECT 1
    INTO _existing_txn
    FROM public.wallet_transactions
   WHERE reference_id = _payment.id::text
     AND reference_type = 'payment'
   LIMIT 1;

  IF NOT FOUND THEN
    _balance_after := COALESCE(_wallet.balance_amount, 0) + _payment.amount;

    UPDATE public.wallets
       SET balance_amount = _balance_after,
           lifetime_deposited = COALESCE(lifetime_deposited, 0) + _payment.amount,
           updated_at = now()
     WHERE id = _wallet.id;

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
      'payment_' || _payment.id::text,
      'payment',
      _payment.id::text,
      'system'
    );
  END IF;

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

  SELECT balance_amount
    INTO _wallet_balance
    FROM public.wallets
   WHERE id = _wallet.id;

  RETURN jsonb_build_object(
    'payment_id', _payment.id,
    'status', 'completed',
    'wallet_balance', COALESCE(_wallet_balance, 0),
    'already_completed', false
  );
END;
$$;
