-- Add onboarding_completed flag to profiles.
-- This provides a persisted, DB-backed source of truth for whether a user
-- has finished the onboarding flow, independent of client-side state.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.onboarding_completed IS 'True once the user has completed the onboarding flow and created their first organization.';
