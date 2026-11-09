create table if not exists public.customer_feedback (
  id uuid primary key default gen_random_uuid(),
  reference_id text not null unique,
  full_name text,
  email text,
  mobile text,
  feedback_type text not null check (feedback_type in ('compliment','suggestion','complaint')),
  service_name text not null check (char_length(service_name) between 2 and 160),
  rating smallint not null check (rating between 1 and 5),
  message text not null check (char_length(message) between 10 and 2000),
  is_anonymous boolean not null default false,
  consent_at timestamptz not null,
  status text not null default 'new' check (status in ('new','under_review','resolved','closed')),
  priority text not null default 'normal' check (priority in ('low','normal','high','urgent')),
  internal_note text not null default '' check (char_length(internal_note) <= 2000),
  assigned_to uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint feedback_contact_required check (is_anonymous or full_name is not null or email is not null or mobile is not null)
);
create table if not exists public.customer_feedback_history (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.customer_feedback(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 2 and 80),
  old_status text,
  new_status text,
  note text not null default '' check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);
create index if not exists customer_feedback_created_idx on public.customer_feedback(created_at desc);
create index if not exists customer_feedback_status_idx on public.customer_feedback(status, priority, created_at desc);
create index if not exists customer_feedback_rating_idx on public.customer_feedback(rating, created_at desc);
alter table public.customer_feedback enable row level security;
alter table public.customer_feedback_history enable row level security;
revoke all on public.customer_feedback from anon, authenticated;
revoke all on public.customer_feedback_history from anon, authenticated;
grant select, update on public.customer_feedback to authenticated;
grant select on public.customer_feedback_history to authenticated;
drop policy if exists "Owner can read feedback" on public.customer_feedback;
create policy "Owner can read feedback" on public.customer_feedback for select to authenticated
using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'owner'));
drop policy if exists "Owner can update feedback" on public.customer_feedback;
create policy "Owner can update feedback" on public.customer_feedback for update to authenticated
using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'owner'))
with check (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'owner'));
drop policy if exists "Owner can read feedback history" on public.customer_feedback_history;
create policy "Owner can read feedback history" on public.customer_feedback_history for select to authenticated
using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'owner'));
