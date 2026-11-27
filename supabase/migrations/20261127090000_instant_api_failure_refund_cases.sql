begin;

create sequence if not exists public.instant_api_service_reference_seq;

alter table public.instant_api_orders
  add column if not exists service_reference text,
  add column if not exists refund_status text not null default 'none',
  add column if not exists refund_amount numeric(10,2),
  add column if not exists refund_id text,
  add column if not exists refund_reference text,
  add column if not exists refund_processed_at timestamptz,
  add column if not exists refund_note text;

update public.instant_api_orders
set service_reference = 'BBC-' || to_char(created_at, 'YYYY') || '-' ||
  lpad(nextval('public.instant_api_service_reference_seq')::text, 6, '0')
where service_reference is null;

alter table public.instant_api_orders
  alter column service_reference set not null,
  add constraint instant_api_orders_refund_status_check
    check (refund_status in ('none','requested','under_review','approved','processing','refunded','rejected')),
  add constraint instant_api_orders_refund_amount_check
    check (refund_amount is null or refund_amount > 0);

create unique index if not exists instant_api_orders_service_reference_uidx
  on public.instant_api_orders(service_reference);
create index if not exists instant_api_orders_refund_status_created_idx
  on public.instant_api_orders(refund_status, created_at desc);

create or replace function public.assign_instant_api_service_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.service_reference is null or new.service_reference = '' then
    new.service_reference := 'BBC-' || to_char(coalesce(new.created_at, now()), 'YYYY') || '-' ||
      lpad(nextval('public.instant_api_service_reference_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists instant_api_orders_service_reference on public.instant_api_orders;
create trigger instant_api_orders_service_reference
  before insert on public.instant_api_orders
  for each row execute function public.assign_instant_api_service_reference();

create table if not exists public.instant_api_cases (
  id uuid primary key default gen_random_uuid(),
  case_reference text not null unique,
  order_id uuid not null references public.instant_api_orders(id) on delete restrict,
  case_type text not null check (case_type in ('failed_service','delayed_service','payment_issue')),
  customer_message text not null check (char_length(customer_message) between 8 and 1000),
  status text not null default 'open' check (status in ('open','under_review','awaiting_customer','resolved','rejected')),
  admin_note text check (admin_note is null or char_length(admin_note) <= 1000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.instant_api_case_reference_seq;

create or replace function public.assign_instant_api_case_reference()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.case_reference is null or new.case_reference = '' then
    new.case_reference := 'BBCQ-' || to_char(coalesce(new.created_at, now()), 'YYYY') || '-' ||
      lpad(nextval('public.instant_api_case_reference_seq')::text, 6, '0');
  end if;
  return new;
end;
$$;

drop trigger if exists instant_api_cases_reference on public.instant_api_cases;
create trigger instant_api_cases_reference
  before insert on public.instant_api_cases
  for each row execute function public.assign_instant_api_case_reference();

create index if not exists instant_api_cases_order_created_idx
  on public.instant_api_cases(order_id, created_at desc);
create index if not exists instant_api_cases_status_created_idx
  on public.instant_api_cases(status, created_at desc);

create unique index if not exists instant_api_cases_one_open_per_order_uidx
  on public.instant_api_cases(order_id)
  where status in ('open','under_review','awaiting_customer');

alter table public.instant_api_cases enable row level security;
drop policy if exists instant_api_cases_owner_read on public.instant_api_cases;
create policy instant_api_cases_owner_read
  on public.instant_api_cases for select to authenticated
  using ((select private.is_owner()));

revoke all privileges on table public.instant_api_cases from public, anon, authenticated;
grant select on table public.instant_api_cases to authenticated;

drop trigger if exists instant_api_cases_updated_at on public.instant_api_cases;
create trigger instant_api_cases_updated_at
  before update on public.instant_api_cases
  for each row execute function public.set_updated_at();

commit;
