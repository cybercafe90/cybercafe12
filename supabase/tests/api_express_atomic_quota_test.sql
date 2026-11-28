-- Run after applying the API Express migration with `supabase test db`.
-- This test uses a transaction and rolls back all counter rows at the end.
begin;

do $$
begin
  if to_regclass('public.api_express_logs') is null
     or to_regclass('public.api_express_cache') is null
     or to_regclass('public.api_express_quota_counters') is null then
    raise exception 'API Express backend tables are missing';
  end if;

  if has_table_privilege('anon', 'public.api_express_logs', 'SELECT')
     or has_table_privilege('authenticated', 'public.api_express_logs', 'SELECT')
     or has_table_privilege('anon', 'public.api_express_cache', 'SELECT')
     or has_table_privilege('authenticated', 'public.api_express_cache', 'SELECT')
     or has_table_privilege('anon', 'public.api_express_quota_counters', 'SELECT')
     or has_table_privilege('authenticated', 'public.api_express_quota_counters', 'SELECT') then
    raise exception 'API Express private tables are exposed to client roles';
  end if;

  if has_function_privilege('anon', 'public.reserve_api_express_quota(uuid,text,integer,integer,integer)', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.reserve_api_express_quota(uuid,text,integer,integer,integer)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.reserve_api_express_quota(uuid,text,integer,integer,integer)', 'EXECUTE') then
    raise exception 'API Express quota RPC execute grants are incorrect';
  end if;
end;
$$;

set local role service_role;

do $$
declare
  v_user uuid := gen_random_uuid();
  v_result jsonb;
  v_i integer;
  v_used integer;
  v_limit integer;
  v_month_start timestamptz := date_trunc('month', now() at time zone 'UTC') at time zone 'UTC';
begin
  -- A single authenticated user is limited to 20 upstream attempts per minute.
  for v_i in 1..20 loop
    v_result := public.reserve_api_express_quota(v_user, 'sandbox', 1000, 0, 20);
    if coalesce((v_result ->> 'allowed')::boolean, false) is not true then
      raise exception 'Sandbox reservation % was unexpectedly rejected: %', v_i, v_result;
    end if;
  end loop;

  v_result := public.reserve_api_express_quota(v_user, 'sandbox', 1000, 0, 20);
  if (v_result ->> 'allowed')::boolean is not false
     or v_result ->> 'reason' <> 'user_rate_limit' then
    raise exception '21st per-user reservation was not rate limited: %', v_result;
  end if;

  -- Respect any existing counter in this test database, then prove that the
  -- monthly global ceiling rejects the next request at the exact limit.
  select coalesce(used, 0) into v_used
  from public.api_express_quota_counters
  where bucket_key = 'global:production' and window_start = v_month_start;
  v_used := coalesce(v_used, 0);
  v_limit := v_used + 2;

  v_result := public.reserve_api_express_quota(gen_random_uuid(), 'production', v_limit, v_used, 20);
  if coalesce((v_result ->> 'allowed')::boolean, false) is not true then
    raise exception 'Production reservation below the monthly limit was rejected: %', v_result;
  end if;

  v_result := public.reserve_api_express_quota(gen_random_uuid(), 'production', v_limit, v_used, 20);
  if coalesce((v_result ->> 'allowed')::boolean, false) is not true then
    raise exception 'Production reservation at the monthly limit was rejected: %', v_result;
  end if;

  v_result := public.reserve_api_express_quota(gen_random_uuid(), 'production', v_limit, v_used, 20);
  if (v_result ->> 'allowed')::boolean is not false
     or v_result ->> 'reason' <> 'monthly_quota' then
    raise exception 'Request beyond the monthly provider allowance was not rejected: %', v_result;
  end if;
end;
$$;

rollback;
