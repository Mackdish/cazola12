-- Add pause_reason to campaigns so the UI can distinguish
-- between manual pauses and automatic pauses due to insufficient wallet balance.
ALTER TABLE public.campaigns ADD COLUMN IF NOT EXISTS pause_reason text NULL;
