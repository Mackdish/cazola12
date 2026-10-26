-- Auto-resume campaigns that the billing path paused.
--
-- chargeAdEvent() pauses a campaign (status = 'paused', pause_reason set) when
-- the RPC reports `insufficient_funds` or `budget_exhausted`. Until now nothing
-- ever resumed it, so an advertiser who topped up their wallet or raised the
-- budget still had a dead campaign until they found and pressed "Resume".
--
-- This migration resumes them automatically, but only campaigns that were paused
-- *by billing*. A campaign the advertiser or an admin paused by hand has a NULL
-- (or different) pause_reason and is never touched.

ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS pause_reason text NULL;

-- 1. Wallet top-up -> resume campaigns paused for insufficient funds -----------
CREATE OR REPLACE FUNCTION public.resume_campaigns_after_wallet_credit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.currency = 'KES' AND COALESCE(NEW.balance_amount, 0) > 0 THEN
    -- The billing RPC locks campaign -> wallet; this trigger holds the wallet and
    -- wants campaigns. SKIP LOCKED avoids a lock-order deadlock: a campaign that
    -- is mid-charge is simply picked up by the next top-up or backfill.
    UPDATE public.campaigns
    SET status = 'active',
        pause_reason = NULL,
        updated_at = now()
    WHERE id IN (
      SELECT c.id
      FROM public.campaigns c
      WHERE c.organization_id = NEW.organization_id
        AND c.status = 'paused'
        AND c.pause_reason = 'insufficient_funds'
        AND c.approval_status = 'approved'
        AND COALESCE(c.spent_amount, 0) < COALESCE(c.total_budget, 0)
      FOR UPDATE SKIP LOCKED
    );
  END IF;
  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.resume_campaigns_after_wallet_credit() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_resume_campaigns_wallet_insert ON public.wallets;
CREATE TRIGGER trg_resume_campaigns_wallet_insert
  AFTER INSERT ON public.wallets
  FOR EACH ROW
  WHEN (NEW.currency = 'KES' AND NEW.balance_amount > 0)
  EXECUTE FUNCTION public.resume_campaigns_after_wallet_credit();

DROP TRIGGER IF EXISTS trg_resume_campaigns_wallet_credit ON public.wallets;
CREATE TRIGGER trg_resume_campaigns_wallet_credit
  AFTER UPDATE OF balance_amount ON public.wallets
  FOR EACH ROW
  WHEN (
    NEW.currency = 'KES'
    AND NEW.balance_amount > 0
    AND NEW.balance_amount > COALESCE(OLD.balance_amount, 0)
  )
  EXECUTE FUNCTION public.resume_campaigns_after_wallet_credit();

-- 2. Budget increase -> resume campaigns paused for budget exhaustion ---------
-- Also clears a stale pause_reason whenever a campaign becomes active again, so
-- the UI never shows "paused: insufficient funds" on a running campaign.
CREATE OR REPLACE FUNCTION public.resume_campaign_after_budget_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status = 'paused'
     AND OLD.status = 'paused'
     AND OLD.pause_reason = 'budget_exhausted'
     AND NEW.pause_reason = 'budget_exhausted'
     AND COALESCE(NEW.total_budget, 0) > COALESCE(OLD.total_budget, 0)
     AND COALESCE(NEW.spent_amount, 0) < COALESCE(NEW.total_budget, 0)
     AND NEW.approval_status = 'approved' THEN
    NEW.status := 'active';
    NEW.pause_reason := NULL;
  ELSIF NEW.status = 'active' AND OLD.status IS DISTINCT FROM 'active' THEN
    NEW.pause_reason := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_resume_campaign_budget_change ON public.campaigns;
CREATE TRIGGER trg_resume_campaign_budget_change
  BEFORE UPDATE OF total_budget, status ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.resume_campaign_after_budget_change();

-- 3. One-time backfill ---------------------------------------------------------
-- Campaigns already stuck behind a billing pause whose cause no longer applies.
UPDATE public.campaigns c
SET status = 'active', pause_reason = NULL, updated_at = now()
WHERE c.status = 'paused'
  AND c.pause_reason = 'insufficient_funds'
  AND c.approval_status = 'approved'
  AND COALESCE(c.spent_amount, 0) < COALESCE(c.total_budget, 0)
  AND EXISTS (
    SELECT 1 FROM public.wallets w
    WHERE w.organization_id = c.organization_id
      AND w.currency = 'KES'
      AND COALESCE(w.balance_amount, 0) > 0
  );

UPDATE public.campaigns c
SET status = 'active', pause_reason = NULL, updated_at = now()
WHERE c.status = 'paused'
  AND c.pause_reason = 'budget_exhausted'
  AND c.approval_status = 'approved'
  AND COALESCE(c.spent_amount, 0) < COALESCE(c.total_budget, 0);

-- Rollback:
--   DROP TRIGGER IF EXISTS trg_resume_campaigns_wallet_insert ON public.wallets;
--   DROP TRIGGER IF EXISTS trg_resume_campaigns_wallet_credit ON public.wallets;
--   DROP TRIGGER IF EXISTS trg_resume_campaign_budget_change ON public.campaigns;
--   DROP FUNCTION IF EXISTS public.resume_campaigns_after_wallet_credit();
--   DROP FUNCTION IF EXISTS public.resume_campaign_after_budget_change();
