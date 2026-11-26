begin;

create table if not exists public.instant_api_services (
  slug text primary key check (slug ~ '^[a-z0-9-]{3,64}$'),
  name text not null check (char_length(name) between 2 and 120),
  description text not null default '' check (char_length(description) <= 500),
  provider_name text,
  provider_cost numeric(10,2) check (provider_cost is null or provider_cost >= 0),
  customer_price numeric(10,2) not null check (customer_price >= 0),
  is_enabled boolean not null default false,
  is_featured boolean not null default true,
  authorization_verified boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists instant_api_services_public_order_idx
  on public.instant_api_services (is_enabled, authorization_verified, is_featured desc, sort_order);

alter table public.instant_api_services enable row level security;

create policy "instant_api_services_owner_read"
  on public.instant_api_services for select to authenticated
  using ((select public.is_owner()));

create policy "instant_api_services_owner_manage"
  on public.instant_api_services for all to authenticated
  using ((select public.is_owner()))
  with check ((select public.is_owner()));

create trigger instant_api_services_updated_at
  before update on public.instant_api_services
  for each row execute function public.set_updated_at();

create trigger audit_instant_api_services
  after insert or update or delete on public.instant_api_services
  for each row execute function public.write_audit_log();

revoke all privileges on table public.instant_api_services from public, anon, authenticated;
grant select, insert, update, delete on table public.instant_api_services to authenticated;

-- Public catalogue view deliberately excludes provider costs and all provider credentials.
-- No service is exposed until an owner enables it and verifies the provider's authorization.
create or replace view public.instant_api_service_catalog as
select slug, name, description, customer_price, is_featured, sort_order
from public.instant_api_services
where is_enabled = true and authorization_verified = true;

grant select on public.instant_api_service_catalog to anon, authenticated;

insert into public.instant_api_services
  (slug, name, description, provider_name, provider_cost, customer_price, is_enabled, is_featured, authorization_verified, sort_order)
values
  ('voter-mobile-link', 'Voter Mobile Link', 'Voter mobile-link service; availability subject to provider authorization.', null, 13.00, 80.00, false, true, false, 1),
  ('aadhaar-to-pan', 'Aadhaar to PAN', 'Aadhaar-to-PAN service; consent and provider authorization required.', null, 9.00, 50.00, false, true, false, 2),
  ('pan-verification', 'PAN Verification', 'PAN verification service; availability subject to provider authorization.', null, 10.00, 60.00, false, true, false, 3),
  ('number-details', 'Number Details', 'Number-details service; lawful purpose and provider authorization required.', null, 6.00, 70.00, false, true, false, 4),
  ('vehicle-rc-pdf', 'Vehicle RC PDF', 'Vehicle registration document service; access subject to provider authorization.', null, 10.00, 90.00, false, true, false, 5),
  ('vahan-to-mobile', 'Vahan to Mobile', 'Vehicle-to-mobile service; lawful purpose and provider authorization required.', null, 10.00, 150.00, false, true, false, 6),
  ('driving-licence-hd-pdf', 'Driving Licence HD PDF', 'Driving-licence document service; access subject to provider authorization.', null, 7.00, 50.00, false, true, false, 7),
  ('ration-card-pdf', 'Ration Card PDF', 'Ration-card document service; provider cost is not yet set.', null, null, 80.00, false, true, false, 8),
  ('voter-status', 'Voter Status', 'Voter-status service; availability subject to provider authorization.', null, 5.00, 40.00, false, true, false, 9)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  provider_cost = excluded.provider_cost,
  customer_price = excluded.customer_price,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order;

commit;
