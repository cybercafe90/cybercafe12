create table public.payment_orders (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references public.applications(id) on delete cascade,
  amount numeric(12,2) not null default 0 check (amount >= 0 and amount <= 10000000),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'pending' check (status in ('pending','claimed','paid','needs_review')),
  claimed_utr text check (claimed_utr is null or claimed_utr ~ '^[0-9]{12}$'),
  utr text unique check (utr is null or utr ~ '^[0-9]{12}$'),
  paid_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status = 'paid') = (utr is not null and paid_at is not null))
);

create unique index payment_orders_claimed_utr_unique
  on public.payment_orders(claimed_utr) where claimed_utr is not null;

create table public.bank_sms_alerts (
  id uuid primary key default gen_random_uuid(),
  sender text not null check (char_length(sender) between 1 and 80),
  message text not null check (char_length(message) between 1 and 2000),
  bank_timestamp timestamptz,
  received_at timestamptz not null default now(),
  parsed_amount numeric(12,2),
  parsed_utr text check (parsed_utr is null or parsed_utr ~ '^[0-9]{12}$'),
  parsed_tracking_id text,
  message_hash text not null unique check (message_hash ~ '^[a-f0-9]{64}$'),
  status text not null default 'unmatched' check (status in ('unmatched','matched','duplicate','invalid','review')),
  matched_payment_id uuid references public.payment_orders(id) on delete set null,
  processing_note text,
  created_at timestamptz not null default now()
);

create index bank_sms_alerts_recent_idx on public.bank_sms_alerts(received_at desc);
create index bank_sms_alerts_status_idx on public.bank_sms_alerts(status, received_at desc);

create table public.payment_audit_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null references public.payment_orders(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 2 and 80),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index payment_audit_events_payment_idx on public.payment_audit_events(payment_id, created_at desc);

create trigger payment_orders_set_updated_at
before update on public.payment_orders
for each row execute function public.set_updated_at();

alter table public.payment_orders enable row level security;
alter table public.bank_sms_alerts enable row level security;
alter table public.payment_audit_events enable row level security;

revoke all on public.payment_orders, public.bank_sms_alerts, public.payment_audit_events from anon, authenticated;
grant all on public.payment_orders, public.bank_sms_alerts, public.payment_audit_events to service_role;

create or replace function public.prevent_duplicate_payment_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(81421, 90017);
  if new.claimed_utr is not null and exists (
    select 1 from public.payment_orders p
    where p.id <> new.id and (p.claimed_utr = new.claimed_utr or p.utr = new.claimed_utr)
  ) then
    raise exception 'UPI reference already exists' using errcode = '23505';
  end if;
  if new.utr is not null and exists (
    select 1 from public.payment_orders p
    where p.id <> new.id and (p.utr = new.utr or p.claimed_utr = new.utr)
  ) then
    raise exception 'UPI reference already exists' using errcode = '23505';
  end if;
  return new;
end;
$$;
revoke all on function public.prevent_duplicate_payment_reference() from public, anon, authenticated;

create trigger payment_orders_unique_reference_guard
before insert or update of claimed_utr, utr on public.payment_orders
for each row execute function public.prevent_duplicate_payment_reference();
