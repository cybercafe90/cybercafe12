begin;

create index if not exists instant_api_orders_razorpay_order_idx
  on public.instant_api_orders (razorpay_order_id)
  where razorpay_order_id is not null;
create index if not exists instant_api_orders_retrieval_hash_idx
  on public.instant_api_orders (retrieval_token_hash);

comment on table public.instant_api_orders is
  'Encrypted, time-limited customer requests and results for Instant API services. Never store provider credentials or plaintext identity data here.';

commit;
