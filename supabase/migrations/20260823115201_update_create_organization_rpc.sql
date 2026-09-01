-- Update create_organization RPC to mark onboarding as completed.
-- The existing RPC creates the organization and owner membership; this
-- version additionally sets profiles.onboarding_completed = true for the
-- calling user so post-sign-in redirects can rely on a DB-backed flag.

CREATE OR REPLACE FUNCTION public.create_organization(
  _name text,
  _slug text,
  _type text
)
RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  next_org public.organizations;
  caller_id uuid := auth.uid();
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.organizations (name, slug, type, status)
  VALUES (_name, _slug, _type, 'active')
  RETURNING * INTO next_org;

  INSERT INTO public.organization_members (organization_id, user_id, role, status)
  VALUES (next_org.id, caller_id, 'owner', 'active');

  UPDATE public.profiles
  SET onboarding_completed = true
  WHERE id = caller_id;

  RETURN next_org;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization(text, text, text) TO authenticated;
