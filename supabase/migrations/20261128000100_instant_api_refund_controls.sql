begin;

alter table public.instant_api_orders
  add column if not exists razorpay_refund_id text,
  add column if not exists refund_status text,
  add column if not exists refund_idempotency_key text,
  add column if not exists refund_requested_at timestamptz,
  add column if not exists refund_processed_at timestamptz;

alter table public.instant_api_orders
  drop constraint if exists instant_api_orders_refund_status_check;

alter table public.instant_api_orders
  add constraint instant_api_orders_refund_status_check
  check (refund_status is null or refund_status in ('created', 'pending', 'processed', 'failed'));

create unique index if not exists instant_api_orders_refund_idempotency_uidx
  on public.instant_api_orders (refund_idempotency_key)
  where refund_idempotency_key is not null;

create index if not exists instant_api_orders_refund_status_idx
  on public.instant_api_orders (refund_status, created_at desc)
  where refund_status is not null;

comment on column public.instant_api_orders.razorpay_refund_id is
  'Razorpay refund identifier returned by the server-side refund API.';
comment on column public.instant_api_orders.refund_idempotency_key is
  'Stable per-order Razorpay refund idempotency key; never regenerated for retries.';

commit;
