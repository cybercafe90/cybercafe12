begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.user_roles
    where user_roles.user_id = (select auth.uid())
      and user_roles.role = 'owner'
  );
$function$;
revoke all on function private.is_owner() from public, anon, authenticated;
grant execute on function private.is_owner() to authenticated;

alter policy audit_owner_read on public.admin_audit_logs using ((select private.is_owner()));
alter policy documents_owner_manage on public.application_documents using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy remarks_owner_read on public.application_remarks using ((select private.is_owner()));
alter policy status_owner_read on public.application_status_history using ((select private.is_owner()));
alter policy applications_owner_read_all on public.applications using ((select private.is_owner()));
alter policy emails_owner_read on public.email_notifications using ((select private.is_owner()));
alter policy profiles_read_self_or_owner on public.profiles
  using (id = (select auth.uid()) or (select private.is_owner()));
alter policy profiles_update_self_or_owner on public.profiles
  using (id = (select auth.uid()) or (select private.is_owner()))
  with check (id = (select auth.uid()) or (select private.is_owner()));
alter policy categories_owner_manage on public.service_categories using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy services_owner_manage on public.services using ((select private.is_owner())) with check ((select private.is_owner()));
alter policy roles_read_self_or_owner on public.user_roles
  using (user_id = (select auth.uid()) or (select private.is_owner()));
alter policy settings_owner_read_all on public.website_settings using ((select private.is_owner()));

alter policy private_documents_owner_delete on storage.objects
  using (bucket_id = 'application-documents' and (select private.is_owner()));
alter policy private_documents_owner_read on storage.objects
  using (bucket_id = 'application-documents' and (select private.is_owner()));
alter policy private_documents_owner_update on storage.objects
  using (bucket_id = 'application-documents' and (select private.is_owner()))
  with check (bucket_id = 'application-documents' and (select private.is_owner()));
alter policy private_documents_owner_upload on storage.objects
  with check (bucket_id = 'application-documents' and (select private.is_owner()));

drop function public.is_owner();
commit;
