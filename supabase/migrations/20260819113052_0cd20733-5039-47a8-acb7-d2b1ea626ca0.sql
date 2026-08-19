GRANT SELECT ON public.supported_currencies TO authenticated;
GRANT SELECT ON public.payment_providers TO authenticated;
GRANT SELECT ON public.payment_methods TO authenticated;

DROP POLICY IF EXISTS supported_currencies_select ON public.supported_currencies;
CREATE POLICY supported_currencies_select ON public.supported_currencies
  FOR SELECT TO authenticated USING (active);

DROP POLICY IF EXISTS payment_providers_select ON public.payment_providers;
CREATE POLICY payment_providers_select ON public.payment_providers
  FOR SELECT TO authenticated USING (active);

DROP POLICY IF EXISTS payment_methods_select ON public.payment_methods;
CREATE POLICY payment_methods_select ON public.payment_methods
  FOR SELECT TO authenticated USING (active);