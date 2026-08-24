-- 1. Backfill: mark onboarding as completed for anyone who already
--    has an organization membership (i.e. they clearly finished onboarding
--    in the past, just before this flag existed / was being set correctly).
UPDATE public.profiles
SET onboarding_completed = true
WHERE id IN (SELECT user_id FROM public.organization_members)
  AND onboarding_completed = false;

-- 2. Going forward: automatically mark onboarding as completed
--    the moment a user gets their first organization membership,
--    regardless of which function/code path created it.
CREATE OR REPLACE FUNCTION public.mark_onboarding_completed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.profiles
  SET onboarding_completed = true
  WHERE id = NEW.user_id
    AND onboarding_completed = false;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_mark_onboarding_completed ON public.organization_members;

CREATE TRIGGER trg_mark_onboarding_completed
AFTER INSERT ON public.organization_members
FOR EACH ROW
EXECUTE FUNCTION public.mark_onboarding_completed();
