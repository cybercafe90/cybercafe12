-- Restrict the exposed public schema to the exact operations used by the website.
-- All customer and administrative records are accessed through authenticated Edge Functions.
begin;

revoke all privileges on all tables in schema public from public, anon, authenticated;
revoke all privileges on all sequences in schema public from public, anon, authenticated;
revoke execute on all functions in schema public from public, anon, authenticated;

-- Public catalogue and explicitly public website settings.
grant select on table public.service_categories, public.services, public.website_settings to anon, authenticated;

-- The signed-in owner dashboard edits catalogue rows directly; RLS policies remain authoritative.
grant select, insert, update, delete on table public.service_categories, public.services to authenticated;

-- The admin portal checks the signed-in user's own role.
grant select on table public.user_roles to authenticated;

-- Only the owner dashboard inserts approved documents; storage remains private and owner-policy protected.
grant insert on table public.application_documents to authenticated;

-- RLS and private Storage policies call this helper for owner-only checks.
grant execute on function public.is_owner() to authenticated;

-- Prevent future objects created by the normal migration role from inheriting broad API grants.
alter default privileges for role postgres in schema public revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;

commit;
