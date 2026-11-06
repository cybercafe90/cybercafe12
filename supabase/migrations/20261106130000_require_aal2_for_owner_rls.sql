-- Require an AAL2 session for every owner-authorized RLS policy.
-- This also protects owner CRUD performed directly through the Supabase client.
create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt() ->> 'aal'), 'aal1') = 'aal2'
    and exists (
      select 1
      from public.user_roles
      where user_roles.user_id = (select auth.uid())
        and user_roles.role = 'owner'
    );
$$;
