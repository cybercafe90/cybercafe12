begin;

-- Keep owner-only service catalogue access while avoiding overlapping
-- permissive SELECT policies from a FOR ALL policy plus a SELECT policy.
drop policy if exists instant_api_services_owner_manage on public.instant_api_services;

create policy instant_api_services_owner_insert
  on public.instant_api_services for insert to authenticated
  with check ((select private.is_owner()));

create policy instant_api_services_owner_update
  on public.instant_api_services for update to authenticated
  using ((select private.is_owner()))
  with check ((select private.is_owner()));

create policy instant_api_services_owner_delete
  on public.instant_api_services for delete to authenticated
  using ((select private.is_owner()));

commit;
