create table if not exists public.instant_tp_applications (
  id uuid primary key default gen_random_uuid(),
  tracking_id text not null unique,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  mobile text not null check (char_length(mobile) between 8 and 18),
  email text,
  vehicle_registration text not null check (char_length(vehicle_registration) between 4 and 20),
  vehicle_make_model text not null check (char_length(vehicle_make_model) between 2 and 120),
  vehicle_type text not null check (vehicle_type in ('private_car','two_wheeler','commercial_vehicle')),
  quoted_amount numeric(12,2) check (quoted_amount is null or quoted_amount > 0),
  insurer_name text,
  payment_status text not null default 'not_submitted' check (payment_status in ('not_submitted','under_verification','paid')),
  utr text,
  admin_note text not null default '',
  policy_status text not null default 'processing' check (policy_status in ('processing','issued')),
  policy_number text,
  policy_storage_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  payment_verified_by uuid references auth.users(id),
  payment_verified_at timestamptz,
  policy_issued_by uuid references auth.users(id),
  policy_issued_at timestamptz
);
create index if not exists instant_tp_created_at_idx on public.instant_tp_applications(created_at desc);
create index if not exists instant_tp_mobile_tracking_idx on public.instant_tp_applications(tracking_id, mobile);
create table if not exists public.instant_tp_audit_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.instant_tp_applications(id) on delete cascade,
  actor_id uuid references auth.users(id),
  action text not null check (char_length(action) between 2 and 80),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists instant_tp_audit_application_idx on public.instant_tp_audit_events(application_id, created_at desc);
alter table public.instant_tp_applications enable row level security;
alter table public.instant_tp_audit_events enable row level security;
revoke all on public.instant_tp_applications from anon, authenticated;
revoke all on public.instant_tp_audit_events from anon, authenticated;
grant all on public.instant_tp_applications to service_role;
grant all on public.instant_tp_audit_events to service_role;
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('instant-tp-policies','instant-tp-policies',false,8388608,array['application/pdf'])
on conflict (id) do update set public=false, file_size_limit=8388608, allowed_mime_types=array['application/pdf'];
