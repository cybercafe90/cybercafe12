begin;

create table if not exists public.instant_api_orders (
  id uuid primary key default gen_random_uuid(),
  service_slug text not null references public.instant_api_services(slug) on update cascade on delete restrict,
  customer_price numeric(10,2) not null check (customer_price > 0),
  provider_cost_at_order numeric(10,2),
  provider_cost_actual numeric(10,2),
  currency text not null default 'INR' check (currency = 'INR'),
  status text not null default 'payment_pending'
    check (status in ('payment_pending','paid','processing','succeeded','failed','fulfillment_unknown','refund_pending','refunded')),
  idempotency_key_hash text not null unique check (idempotency_key_hash ~ '^[a-f0-9]{64}$'),
  request_ciphertext text not null,
  retrieval_token_hash text not null check (retrieval_token_hash ~ '^[a-f0-9]{64}$'),
  retrieval_token_ciphertext text not null,
  result_ciphertext text,
  razorpay_order_id text unique,
  razorpay_payment_id text unique,
  paid_at timestamptz,
  provider_order_id text,
  provider_error_code text,
  result_expires_at timestamptz not null default (now() + interval '24 hours'),
  fulfilled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists instant_api_orders_status_created_idx
  on public.instant_api_orders(status, created_at desc);
create index if not exists instant_api_orders_service_created_idx
  on public.instant_api_orders(service_slug, created_at desc);

alter table public.instant_api_orders enable row level security;
drop policy if exists instant_api_orders_owner_read on public.instant_api_orders;
create policy instant_api_orders_owner_read
  on public.instant_api_orders for select to authenticated
  using ((select public.is_owner()));

revoke all privileges on table public.instant_api_orders from public, anon, authenticated;
grant select on table public.instant_api_orders to authenticated;

drop trigger if exists instant_api_orders_updated_at on public.instant_api_orders;
create trigger instant_api_orders_updated_at
  before update on public.instant_api_orders
  for each row execute function public.set_updated_at();

commit;
