-- Auto-approve new publishers by changing the column default from 'pending' to 'approved'
ALTER TABLE public.publishers ALTER COLUMN approval_status SET DEFAULT 'approved'::approval_status;
