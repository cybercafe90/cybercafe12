-- API Express gateway storage. Apply with Supabase migrations.
create table if not exists public.api_express_cache (
  cache_key text primary key,
  service_name text not null check (service_name in ('weather','air_quality','fuel_price','commodity_price','telecom_operator')),
  response jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint api_express_cache_key_length check (char_length(cache_key) between 32 and 128)
);

create index if not exists api_express_cache_expires_at_idx
  on public.api_express_cache (expires_at);
create index if not exists api_express_cache_service_idx
  on public.api_express_cache (service_name, expires_at);

create table if not exists public.api_express_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete set null,
  service_name text not null,
  status text not null check (status in ('success','error','cache_hit','rejected')),
  http_code integer not null check (http_code between 100 and 599),
  created_at timestamptz not null default now()
);

create index if not exists api_express_logs_created_at_idx
  on public.api_express_logs (created_at desc);
create index if not exists api_express_logs_user_created_idx
  on public.api_express_logs (user_id, created_at desc);
create index if not exists api_express_logs_service_created_idx
  on public.api_express_logs (service_name, created_at desc);

alter table public.api_express_cache enable row level security;
alter table public.api_express_logs enable row level security;

-- No browser role receives cache access. The Edge Function uses service_role.
revoke all on table public.api_express_cache from anon, authenticated;
grant all on table public.api_express_cache to service_role;

-- Logs are readable only by owner/admin roles. Inserts are performed by service_role.
revoke all on table public.api_express_logs from anon, authenticated;
grant select on table public.api_express_logs to authenticated;
grant all on table public.api_express_logs to service_role;

drop policy if exists "api_express_logs_owner_admin_read" on public.api_express_logs;
create policy "api_express_logs_owner_admin_read"
  on public.api_express_logs
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.user_roles ur
      where ur.user_id = (select auth.uid())
        and ur.role in ('owner','admin')
    )
  );

-- Explicitly deny all direct cache access, including authenticated reads.
drop policy if exists "api_express_cache_no_direct_access" on public.api_express_cache;
create policy "api_express_cache_no_direct_access"
  on public.api_express_cache
  for all
  to anon, authenticated
  using (false)
  with check (false);

comment on table public.api_express_cache is
  'Server-only cache for non-PII API Express responses. Access through api-express-gateway.';
comment on table public.api_express_logs is
  'API Express audit metadata only. Never store PAN, Aadhaar, bank account, VPA, mobile, or request/response bodies.';
