begin;

-- The public catalogue must use the caller's RLS context. Only the safe
-- catalogue columns are readable directly by anon/authenticated clients.
alter view public.instant_api_service_catalog set (security_invoker = true);

revoke all privileges on table public.instant_api_services from public, anon, authenticated;
grant select (
  slug,
  name,
  description,
  customer_price,
  is_featured,
  sort_order,
  is_enabled,
  authorization_verified
) on table public.instant_api_services to anon, authenticated;

drop policy if exists instant_api_services_public_catalog_read on public.instant_api_services;
create policy instant_api_services_public_catalog_read
  on public.instant_api_services
  for select
  to anon, authenticated
  using (is_enabled = true and authorization_verified = true);

-- The owner console now uses owner-checked SECURITY DEFINER RPCs, so direct
-- owner table policies are no longer needed and cannot create duplicate SELECT paths.
drop policy if exists "instant_api_services_owner_read" on public.instant_api_services;
drop policy if exists "instant_api_services_owner_manage" on public.instant_api_services;

-- Enforce the same activation rule in the database, not only in the UI.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'instant_api_services_enabled_requires_authorization'
      and conrelid = 'public.instant_api_services'::regclass
  ) then
    alter table public.instant_api_services
      add constraint instant_api_services_enabled_requires_authorization
      check (not is_enabled or (endpoint_url is not null and authorization_verified = true));
  end if;
end
$$;

-- Owner-only read RPC returns full provider configuration without granting
-- authenticated users direct access to provider endpoints or cost fields.
create or replace function public.owner_list_instant_api_services()
returns setof public.instant_api_services
language sql
stable
security definer
set search_path = ''
as $function$
  select service.*
  from public.instant_api_services as service
  where private.is_owner()
  order by service.sort_order, service.name;
$function$;

create or replace function public.owner_update_instant_api_service(
  p_slug text,
  p_name text,
  p_description text,
  p_provider_name text,
  p_endpoint_url text,
  p_http_method text,
  p_provider_cost numeric,
  p_customer_price numeric,
  p_is_enabled boolean,
  p_is_featured boolean,
  p_authorization_verified boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if not private.is_owner() then
    raise exception 'Owner access required.' using errcode = '42501';
  end if;

  if p_is_enabled is true and (
    p_endpoint_url is null
    or p_authorization_verified is distinct from true
  ) then
    raise exception 'A service requires an HTTPS endpoint and verified provider authorization before activation.'
      using errcode = '23514';
  end if;

  update public.instant_api_services as service
  set
    name = p_name,
    description = p_description,
    provider_name = p_provider_name,
    endpoint_url = p_endpoint_url,
    http_method = p_http_method,
    provider_cost = p_provider_cost,
    customer_price = p_customer_price,
    is_enabled = p_is_enabled,
    is_featured = p_is_featured,
    authorization_verified = p_authorization_verified,
    updated_at = now()
  where service.slug = p_slug;

  if not found then
    raise exception 'Instant API service not found.' using errcode = 'P0002';
  end if;
end;
$function$;

-- Cover nullable foreign keys used by owner operations and audit history.
create index if not exists instant_tp_applications_payment_verified_by_idx
  on public.instant_tp_applications (payment_verified_by)
  where payment_verified_by is not null;

create index if not exists instant_tp_applications_policy_issued_by_idx
  on public.instant_tp_applications (policy_issued_by)
  where policy_issued_by is not null;

create index if not exists instant_tp_audit_events_actor_id_idx
  on public.instant_tp_audit_events (actor_id)
  where actor_id is not null;

revoke all on function public.owner_list_instant_api_services() from public, anon, authenticated;
revoke all on function public.owner_update_instant_api_service(text, text, text, text, text, text, numeric, numeric, boolean, boolean, boolean) from public, anon, authenticated;
grant execute on function public.owner_list_instant_api_services() to authenticated;
grant execute on function public.owner_update_instant_api_service(text, text, text, text, text, text, numeric, numeric, boolean, boolean, boolean) to authenticated;

commit;
