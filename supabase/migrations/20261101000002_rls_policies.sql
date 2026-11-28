revoke all on public.applications from anon, authenticated;
revoke all on public.application_documents from anon, authenticated;
revoke all on public.admin_users from anon, authenticated;

grant select on public.applications, public.application_documents, public.admin_users to authenticated;

drop policy if exists "Admins can read applications" on public.applications;
create policy "Admins can read applications"
  on public.applications for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can read application documents" on public.application_documents;
create policy "Admins can read application documents"
  on public.application_documents for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can read admin allowlist" on public.admin_users;
create policy "Admins can read admin allowlist"
  on public.admin_users for select
  to authenticated
  using ((select public.is_admin()));

drop policy if exists "Admins can access application documents" on storage.objects;
create policy "Admins can access application documents"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'application-documents' and (select public.is_admin()))
  with check (bucket_id = 'application-documents' and (select public.is_admin()));
