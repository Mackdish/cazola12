-- Re-runnable security audit: which database functions can the PUBLIC API KEY call?
-- Run in the Supabase SQL editor. Expected result: ONLY the read-only RLS helpers
-- (is_org_admin, is_org_member, is_platform_admin, is_platform_staff).
-- Anything else means a function is reachable by anyone on the internet.

select p.proname,
       pg_get_function_identity_arguments(p.oid) as args,
       case when p.prosecdef then 'SECURITY DEFINER (bypasses row level security!)' else 'invoker' end as runs_as
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind in ('f', 'p')
  and has_function_privilege('anon', p.oid, 'execute')
  and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
order by p.prosecdef desc, p.proname;

-- Second check: SECURITY DEFINER functions that signed-in users can call but that never
-- look at who is calling (no auth.uid()/auth.role()/permission helper in the body).
-- Each row needs either a permission check inside, or to be made server-only.
select p.proname, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and p.prokind = 'f'
  and has_function_privilege('authenticated', p.oid, 'execute')
  and pg_get_functiondef(p.oid) !~* '(auth\.uid\(\)|auth\.role\(\)|is_platform_admin|is_platform_staff|is_org_member|is_org_admin)'
  and p.prorettype <> 'trigger'::regtype
order by p.proname;
