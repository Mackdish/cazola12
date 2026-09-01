-- One-time bulk update: approve all advertisers currently in "Pending Review" status.
-- Run this only after confirming the count with:
--   SELECT count(*) FROM public.advertisers WHERE approval_status = 'pending';
--
-- This updates ONLY advertisers with approval_status = 'pending'.
-- Advertisers already approved, rejected, or any other status are untouched.

UPDATE public.advertisers
SET approval_status = 'approved'
WHERE approval_status = 'pending';

-- Return the IDs that were changed for audit purposes.
SELECT id, business_name, contact_email, updated_at
FROM public.advertisers
WHERE approval_status = 'approved'
  AND updated_at >= now() - interval '1 minute';
