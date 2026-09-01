-- Add shared verification token to websites and allow users to read their own domain_verifications

ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS verification_token text UNIQUE;

CREATE POLICY "Users can view their own domain verifications"
ON public.domain_verifications
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE organization_members.organization_id = domain_verifications.organization_id
      AND organization_members.user_id = auth.uid()
      AND organization_members.status = 'active'
  )
);
