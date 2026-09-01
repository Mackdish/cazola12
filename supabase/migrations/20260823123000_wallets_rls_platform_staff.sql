-- Allow platform staff to read all wallets across organizations.
-- This enables admin users to view wallet balances for any organization
-- without bypassing RLS for non-staff users.

CREATE POLICY wallets_select_platform_staff
ON public.wallets
FOR SELECT
TO authenticated
USING (is_platform_staff(auth.uid()));
