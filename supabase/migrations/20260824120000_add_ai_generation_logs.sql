-- AI generation audit logs
CREATE TABLE IF NOT EXISTS public.ai_generation_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generation_type text NOT NULL,
  model text NOT NULL,
  status text NOT NULL DEFAULT 'success',
  input_metadata jsonb DEFAULT '{}'::jsonb,
  output_metadata jsonb DEFAULT '{}'::jsonb,
  tokens_used integer,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_generation_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own org AI logs"
  ON public.ai_generation_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ai_generation_logs.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.status = 'active'
    )
  );

CREATE POLICY "Users can insert own org AI logs"
  ON public.ai_generation_logs
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.organization_members
      WHERE organization_members.organization_id = ai_generation_logs.organization_id
        AND organization_members.user_id = auth.uid()
        AND organization_members.status = 'active'
    )
  );

CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_org_id
  ON public.ai_generation_logs(organization_id);

CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_user_id
  ON public.ai_generation_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_ai_generation_logs_created_at
  ON public.ai_generation_logs(created_at DESC);
