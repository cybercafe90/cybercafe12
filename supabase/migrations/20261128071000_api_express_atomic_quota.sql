-- API Express gateway backend tables and atomic quota reservation.
-- This migration is safe to apply to an environment where the tables are absent
-- or already exist. No provider requests or customer data are involved.

create table if not exists public.api_express_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  service_name text not null,
  status text not null check (status in ('success', 'error', 'cache_hit', 'rejected')),
  http_code integer not null,
  environment text not null check (environment in ('sandbox', 'production')),
  created_at timestamptz not null default now()
);

create index if not exists api_express_logs_created_at_idx
  on public.api_express_logs (created_at desc);
create index if not exists api_express_logs_user_created_at_idx
  on public.api_express_logs (user_id, created_at desc);
create index if not exists api_express_logs_environment_created_at_idx
  on public.api_express_logs (environment, created_at desc);

create table if not exists public.api_express_cache (
  cache_key text primary key,
  service_name text not null,
  response jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists api_express_cache_expires_at_idx
  on public.api_express_cache (expires_at);

-- A single counter row per quota scope and UTC time window. The primary key
-- plus SELECT ... FOR UPDATE makes concurrent reservations serializable per scope.
create table if not exists public.api_express_quota_counters (
  bucket_key text not null,
  window_start timestamptz not null,
  used integer not null default 0 check (used >= 0),
  updated_at timestamptz not null default now(),
  primary key (bucket_key, window_start)
);

alter table public.api_express_logs enable row level security;
alter table public.api_express_cache enable row level security;
alter table public.api_express_quota_counters enable row level security;

revoke all on table public.api_express_logs from public, anon, authenticated;
revoke all on table public.api_express_cache from public, anon, authenticated;
revoke all on table public.api_express_quota_counters from public, anon, authenticated;
grant select, insert on table public.api_express_logs to service_role;
grant select, insert, update, delete on table public.api_express_cache to service_role;
grant select, insert, update, delete on table public.api_express_quota_counters to service_role;

create or replace function public.reserve_api_express_quota(
  p_user_id uuid,
  p_environment text,
  p_monthly_limit integer,
  p_monthly_usage_offset integer,
  p_user_minute_limit integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_now timestamptz := clock_timestamp();
  v_minute_start timestamptz;
  v_month_start timestamptz;
  v_global_key text := 'global:production';
  v_user_key text;
  v_global_used integer := 0;
  v_user_used integer := 0;
begin
  if p_user_id is null
    or p_environment is null
    or p_environment not in ('sandbox', 'production')
    or p_monthly_limit is null
    or p_monthly_limit < 1
    or p_monthly_usage_offset is null
    or p_monthly_usage_offset < 0
    or p_monthly_usage_offset > p_monthly_limit
    or p_user_minute_limit is null
    or p_user_minute_limit < 1 then
    raise exception 'Invalid API Express quota reservation parameters'
      using errcode = '22023';
  end if;

  v_minute_start := date_trunc('minute', v_now at time zone 'UTC') at time zone 'UTC';
  v_month_start := date_trunc('month', v_now at time zone 'UTC') at time zone 'UTC';
  v_user_key := 'user:' || p_user_id::text;

  -- Insert both rows before locking them. All callers lock global first and
  -- user second, avoiding lock-order inversions between concurrent requests.
  if p_environment = 'production' then
    insert into public.api_express_quota_counters (bucket_key, window_start, used)
    values (v_global_key, v_month_start, p_monthly_usage_offset)
    on conflict (bucket_key, window_start) do nothing;
  end if;

  insert into public.api_express_quota_counters (bucket_key, window_start, used)
  values (v_user_key, v_minute_start, 0)
  on conflict (bucket_key, window_start) do nothing;

  if p_environment = 'production' then
    select used into v_global_used
    from public.api_express_quota_counters
    where bucket_key = v_global_key and window_start = v_month_start
    for update;
  end if;

  select used into v_user_used
  from public.api_express_quota_counters
  where bucket_key = v_user_key and window_start = v_minute_start
  for update;

  if p_environment = 'production' and v_global_used >= p_monthly_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'monthly_quota',
      'monthly_used', v_global_used,
      'monthly_limit', p_monthly_limit,
      'user_minute_used', v_user_used
    );
  end if;

  if v_user_used >= p_user_minute_limit then
    return jsonb_build_object(
      'allowed', false,
      'reason', 'user_rate_limit',
      'monthly_used', v_global_used,
      'monthly_limit', p_monthly_limit,
      'user_minute_used', v_user_used
    );
  end if;

  update public.api_express_quota_counters
  set used = used + 1, updated_at = v_now
  where bucket_key = v_user_key and window_start = v_minute_start
  returning used into v_user_used;

  if p_environment = 'production' then
    update public.api_express_quota_counters
    set used = used + 1, updated_at = v_now
    where bucket_key = v_global_key and window_start = v_month_start
    returning used into v_global_used;
  end if;

  return jsonb_build_object(
    'allowed', true,
    'monthly_used', v_global_used,
    'monthly_limit', p_monthly_limit,
    'user_minute_used', v_user_used,
    'user_minute_limit', p_user_minute_limit
  );
end;
$function$;

revoke all on function public.reserve_api_express_quota(uuid, text, integer, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_api_express_quota(uuid, text, integer, integer, integer)
  to service_role;
