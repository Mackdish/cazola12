-- Auto-approve new advertisers by changing the column default from 'pending' to 'approved'
-- This matches the existing publisher auto-approval migration.
ALTER TABLE public.advertisers ALTER COLUMN approval_status SET DEFAULT 'approved'::approval_status;
