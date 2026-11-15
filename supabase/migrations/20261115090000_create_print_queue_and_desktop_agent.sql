create table if not exists public.print_agent_devices (
  id uuid primary key default gen_random_uuid(),
  device_name text not null check (char_length(device_name) between 1 and 100),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  is_active boolean not null default true,
  last_seen_at timestamptz,
  last_error text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.print_jobs (
  id uuid primary key default gen_random_uuid(),
  job_number text not null unique default ('PRN-' || upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 10))),
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  customer_mobile text not null check (char_length(customer_mobile) between 8 and 20),
  customer_email text,
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  file_size_bytes bigint not null check (file_size_bytes between 1 and 26214400),
  copies integer not null default 1 check (copies between 1 and 100),
  color_mode text not null default 'bw' check (color_mode in ('bw','color')),
  paper_size text not null default 'A4' check (paper_size in ('A4','A3','A5','Letter','Legal')),
  page_count integer check (page_count between 1 and 1000),
  payment_amount numeric(10,2) not null default 0 check (payment_amount >= 0 and payment_amount <= 100000),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','cash_approved','failed','refunded')),
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  status text not null default 'awaiting_payment' check (status in ('awaiting_payment','queued','printing','completed','failed','cancelled')),
  agent_id uuid references public.print_agent_devices(id) on delete set null,
  print_started_at timestamptz,
  printed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists print_jobs_queue_idx on public.print_jobs(status,payment_status,created_at);
create index if not exists print_jobs_created_at_idx on public.print_jobs(created_at desc);
create index if not exists print_jobs_mobile_idx on public.print_jobs(customer_mobile);
create table if not exists public.print_job_events (
  id uuid primary key default gen_random_uuid(),
  print_job_id uuid not null references public.print_jobs(id) on delete cascade,
  actor_type text not null check (actor_type in ('customer','owner','agent','system')),
  actor_id uuid,
  event_type text not null check (char_length(event_type) between 2 and 80),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists print_job_events_job_idx on public.print_job_events(print_job_id,created_at desc);
alter table public.print_agent_devices enable row level security;
alter table public.print_jobs enable row level security;
alter table public.print_job_events enable row level security;
create policy "Owners can manage print agent devices" on public.print_agent_devices for all to authenticated
using (exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='owner'))
with check (exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='owner'));
create policy "Owners can manage print jobs" on public.print_jobs for all to authenticated
using (exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='owner'))
with check (exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='owner'));
create policy "Owners can read print job events" on public.print_job_events for select to authenticated
using (exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='owner'));
create policy "Owners can add print job events" on public.print_job_events for insert to authenticated
with check (exists(select 1 from public.user_roles r where r.user_id=auth.uid() and r.role='owner'));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('print-jobs','print-jobs',false,26214400,array['application/pdf'])
on conflict(id) do update set public=false,file_size_limit=26214400,allowed_mime_types=array['application/pdf'];
