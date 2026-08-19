ALTER TABLE public.supported_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read supported currencies" ON public.supported_currencies;
CREATE POLICY "Authenticated users can read supported currencies" ON public.supported_currencies
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read payment providers" ON public.payment_providers;
CREATE POLICY "Authenticated users can read payment providers" ON public.payment_providers
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users can read payment methods" ON public.payment_methods;
CREATE POLICY "Authenticated users can read payment methods" ON public.payment_methods
  FOR SELECT TO authenticated USING (true);

GRANT SELECT ON public.supported_currencies TO authenticated;
GRANT SELECT ON public.payment_providers TO authenticated;
GRANT SELECT ON public.payment_methods TO authenticated;
GRANT ALL ON public.supported_currencies TO service_role;
GRANT ALL ON public.payment_providers TO service_role;
GRANT ALL ON public.payment_methods TO service_role;