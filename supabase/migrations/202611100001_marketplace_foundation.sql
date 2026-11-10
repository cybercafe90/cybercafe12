-- BABA'S CYBER CAFE marketplace foundation.
-- All marketplace writes are performed by authenticated Edge Functions using the service role.
-- Public product reads are also mediated by the marketplace API; private order and seller data
-- is never exposed directly through the Data API.

create table if not exists public.marketplace_categories (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,48}$'),
  name text not null check (char_length(name) between 2 and 100),
  description text not null default '' check (char_length(description) <= 500),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.marketplace_categories (slug, name, description, sort_order) values
  ('kashmiri-pashmina-shawls', 'Kashmiri Pashmina & Shawls', 'Kashmiri shawls and Pashmina products from approved sellers.', 10),
  ('handloom-handicrafts', 'Handloom & Handicrafts', 'Handloom, traditional crafts and handmade products.', 20),
  ('clothing-accessories', 'Clothing & Accessories', 'Clothing, bags, accessories and fashion products.', 30),
  ('electronics', 'Electronics', 'Permitted electronics, gadgets and accessories.', 40),
  ('home-lifestyle', 'Home & Lifestyle', 'Home decor, furnishings and lifestyle products.', 50),
  ('books-stationery', 'Books & Stationery', 'Books, stationery and office supplies.', 60),
  ('beauty-personal-care', 'Beauty & Personal Care', 'Lawful beauty, grooming and personal care products.', 70),
  ('other-permitted-products', 'Other Legally Permitted Products', 'Other lawful products accepted under marketplace policy.', 80)
on conflict (slug) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;

create table if not exists public.marketplace_sellers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete restrict,
  store_name text not null check (char_length(store_name) between 2 and 120),
  legal_name text not null check (char_length(legal_name) between 2 and 160),
  contact_email text not null check (char_length(contact_email) <= 254),
  mobile text not null check (char_length(mobile) between 8 and 20),
  business_type text not null default 'individual' check (business_type in ('individual','proprietorship','partnership','company','cooperative','other')),
  address text not null check (char_length(address) between 5 and 500),
  city text not null check (char_length(city) between 2 and 100),
  state text not null default 'Jammu and Kashmir',
  postal_code text not null check (postal_code ~ '^[0-9]{6}$'),
  status text not null default 'pending' check (status in ('pending','approved','rejected','suspended')),
  applied_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users(id) on delete set null,
  rejection_reason text not null default '' check (char_length(rejection_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_memberships (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete restrict,
  period_start timestamptz not null default now(),
  expires_at timestamptz not null,
  grace_until timestamptz not null,
  fee_amount numeric(10,2) not null default 200.00 check (fee_amount = 200.00),
  paid_amount numeric(10,2) not null default 0 check (paid_amount >= 0 and paid_amount <= fee_amount),
  status text not null default 'pending' check (status in ('pending','active','grace','paused','expired')),
  renewal_grace boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (seller_id, period_start),
  check (expires_at > period_start),
  check (grace_until >= expires_at)
);

create table if not exists public.marketplace_membership_payments (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.marketplace_sellers(id) on delete restrict,
  membership_id uuid not null references public.marketplace_memberships(id) on delete restrict,
  amount numeric(10,2) not null check (amount > 0 and amount <= 200.00),
  payment_method text not null default 'upi' check (payment_method = 'upi'),
  status text not null default 'pending' check (status in ('pending','claimed','verified','rejected')),
  claimed_utr text unique check (claimed_utr is null or claimed_utr ~ '^[0-9]{12}$'),
  verified_utr text,
  verified_by uuid references auth.users(id) on delete set null,
  verified_at timestamptz,
  rejection_note text not null default '' check (char_length(rejection_note) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_membership_reminders (
  id uuid primary key default gen_random_uuid(),
  membership_id uuid not null references public.marketplace_memberships(id) on delete cascade,
  reminder_month date not null,
  reminder_type text not null default 'monthly_payment' check (reminder_type in ('monthly_payment','annual_renewal')),
  status text not null default 'queued' check (status in ('queued','sent','failed')),
  provider_id text,
  error_message text not null default '' check (char_length(error_message) <= 500),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (membership_id, reminder_month, reminder_type)
);

create table if not exists public.marketplace_products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid references public.marketplace_sellers(id) on delete restrict,
  category_slug text not null references public.marketplace_categories(slug) on update cascade on delete restrict,
  name text not null check (char_length(name) between 2 and 160),
  description text not null check (char_length(description) between 10 and 3000),
  price numeric(12,2) not null check (price > 0 and price <= 10000000),
  stock integer not null default 0 check (stock >= 0 and stock <= 100000),
  image_url text not null check (image_url ~ '^https://'),
  status text not null default 'pending_review' check (status in ('draft','pending_review','published','rejected','archived')),
  rejection_reason text not null default '' check (char_length(rejection_reason) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_orders (
  id uuid primary key default gen_random_uuid(),
  checkout_group_id uuid not null,
  order_ref text not null unique check (order_ref ~ '^BCM-[A-Z0-9]{12}$'),
  seller_id uuid references public.marketplace_sellers(id) on delete restrict,
  customer_name text not null check (char_length(customer_name) between 2 and 120),
  customer_email text not null default '' check (char_length(customer_email) <= 254),
  customer_mobile text not null check (char_length(customer_mobile) between 8 and 20),
  shipping_address jsonb not null,
  subtotal numeric(12,2) not null check (subtotal >= 0),
  delivery_charge numeric(12,2) not null default 0 check (delivery_charge >= 0),
  total_amount numeric(12,2) not null check (total_amount > 0),
  payment_method text not null check (payment_method in ('upi','cod')),
  payment_status text not null check (payment_status in ('pending','claimed','paid','rejected','cod_due','cod_paid','refunded')),
  payment_expires_at timestamptz,
  stock_released_at timestamptz,
  claimed_utr text unique check (claimed_utr is null or claimed_utr ~ '^[0-9]{12}$'),
  verified_utr text,
  status text not null default 'placed' check (status in ('placed','confirmed','processing','shipped','delivered','cancelled','returned')),
  carrier text not null default '' check (char_length(carrier) <= 120),
  tracking_number text not null default '' check (char_length(tracking_number) <= 160),
  customer_note text not null default '' check (char_length(customer_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.marketplace_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  product_id uuid references public.marketplace_products(id) on delete set null,
  product_name text not null check (char_length(product_name) between 2 and 160),
  quantity integer not null check (quantity between 1 and 20),
  unit_price numeric(12,2) not null check (unit_price > 0),
  created_at timestamptz not null default now()
);

create table if not exists public.marketplace_order_events (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.marketplace_orders(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 2 and 80),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now()
);

create index if not exists marketplace_sellers_status_idx on public.marketplace_sellers(status, applied_at desc);
create index if not exists marketplace_memberships_seller_period_idx on public.marketplace_memberships(seller_id, period_start desc);
create index if not exists marketplace_memberships_due_idx on public.marketplace_memberships(status, expires_at, grace_until);
create index if not exists marketplace_membership_payments_membership_idx on public.marketplace_membership_payments(membership_id, created_at desc);
create unique index if not exists marketplace_one_open_membership_payment_idx
  on public.marketplace_membership_payments(membership_id) where status in ('pending','claimed');
create unique index if not exists marketplace_one_annual_renewal_reminder_idx
  on public.marketplace_membership_reminders(membership_id) where reminder_type = 'annual_renewal';
create index if not exists marketplace_products_public_idx on public.marketplace_products(status, category_slug, created_at desc);
create index if not exists marketplace_products_seller_idx on public.marketplace_products(seller_id, status, created_at desc);
create index if not exists marketplace_orders_seller_idx on public.marketplace_orders(seller_id, status, created_at desc);
create index if not exists marketplace_orders_mobile_idx on public.marketplace_orders(order_ref, customer_mobile);
create index if not exists marketplace_order_items_order_idx on public.marketplace_order_items(order_id);

alter table public.marketplace_categories enable row level security;
alter table public.marketplace_sellers enable row level security;
alter table public.marketplace_memberships enable row level security;
alter table public.marketplace_membership_payments enable row level security;
alter table public.marketplace_membership_reminders enable row level security;
alter table public.marketplace_products enable row level security;
alter table public.marketplace_orders enable row level security;
alter table public.marketplace_order_items enable row level security;
alter table public.marketplace_order_events enable row level security;

revoke all on public.marketplace_categories, public.marketplace_sellers, public.marketplace_memberships,
  public.marketplace_membership_payments, public.marketplace_membership_reminders,
  public.marketplace_products, public.marketplace_orders, public.marketplace_order_items,
  public.marketplace_order_events from anon, authenticated;
grant select on public.marketplace_sellers, public.marketplace_memberships, public.marketplace_membership_payments to authenticated;
grant all on public.marketplace_categories, public.marketplace_sellers, public.marketplace_memberships,
  public.marketplace_membership_payments, public.marketplace_membership_reminders,
  public.marketplace_products, public.marketplace_orders, public.marketplace_order_items,
  public.marketplace_order_events to service_role;

create policy "Seller can read own marketplace profile" on public.marketplace_sellers
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Seller can read own marketplace memberships" on public.marketplace_memberships
  for select to authenticated using (exists (
    select 1 from public.marketplace_sellers s where s.id = seller_id and s.user_id = (select auth.uid())
  ));
create policy "Seller can read own marketplace membership payments" on public.marketplace_membership_payments
  for select to authenticated using (exists (
    select 1 from public.marketplace_sellers s where s.id = seller_id and s.user_id = (select auth.uid())
  ));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('marketplace-product-images', 'marketplace-product-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

drop policy if exists "Approved marketplace sellers upload product images" on storage.objects;
create policy "Approved marketplace sellers upload product images" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'marketplace-product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
    and exists (
      select 1 from public.marketplace_sellers s
      join public.marketplace_memberships m on m.seller_id = s.id
      where s.user_id = (select auth.uid()) and s.status = 'approved'
        and ((m.status = 'active' and m.grace_until > now()) or (m.status = 'grace' and m.renewal_grace and m.grace_until > now()))
        and m.period_start = (select max(m2.period_start) from public.marketplace_memberships m2 where m2.seller_id = s.id)
    )
  );

drop policy if exists "Sellers can delete own marketplace product images" on storage.objects;
create policy "Sellers can delete own marketplace product images" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'marketplace-product-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create or replace function public.marketplace_create_orders(
  p_customer jsonb,
  p_items jsonb,
  p_payment_method text
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_checkout_group_id uuid := gen_random_uuid();
  v_seller_id uuid;
  v_order_id uuid;
  v_order_ref text;
  v_subtotal numeric(12,2);
  v_item record;
  v_result jsonb := '[]'::jsonb;
  v_mobile text := coalesce(p_customer->>'mobile','');
  v_name text := coalesce(p_customer->>'name','');
  v_email text := coalesce(p_customer->>'email','');
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) < 1 or jsonb_array_length(p_items) > 30 then
    raise exception 'Cart must contain between 1 and 30 products.';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 120 or char_length(v_mobile) < 8 or char_length(v_mobile) > 20 then
    raise exception 'Valid customer name and mobile number are required.';
  end if;
  if char_length(v_email) > 254 or p_payment_method not in ('upi','cod') then
    raise exception 'Invalid customer email or payment method.';
  end if;
  if jsonb_typeof(p_customer->'address') <> 'object'
     or char_length(coalesce(p_customer->'address'->>'line1','')) < 5
     or char_length(coalesce(p_customer->'address'->>'city','')) < 2
     or char_length(coalesce(p_customer->'address'->>'postalCode','')) <> 6
     or coalesce(p_customer->'address'->>'postalCode','') !~ '^[0-9]{6}$' then
    raise exception 'A complete delivery address is required.';
  end if;

  if exists (
    select 1 from jsonb_array_elements(p_items) i
    where coalesce(i->>'productId','') !~* '^[0-9a-f-]{36}$'
       or coalesce(i->>'quantity','') !~ '^[0-9]{1,2}$'
       or (i->>'quantity')::integer not between 1 and 20
  ) then
    raise exception 'Cart contains an invalid product or quantity.';
  end if;

  if (
    select count(distinct (i->>'productId')::uuid) from jsonb_array_elements(p_items) i
  ) <> (
    select count(distinct p.id)
    from jsonb_array_elements(p_items) i
    join public.marketplace_products p on p.id = (i->>'productId')::uuid
    where p.status = 'published'
  ) then
    raise exception 'One or more products are unavailable.';
  end if;

  for v_seller_id in
    select distinct p.seller_id
    from jsonb_array_elements(p_items) i
    join public.marketplace_products p on p.id = (i->>'productId')::uuid
    order by p.seller_id nulls first
  loop
    if v_seller_id is not null and not exists (
      select 1 from public.marketplace_sellers s
      join lateral (
        select m.status, m.renewal_grace, m.grace_until
        from public.marketplace_memberships m
        where m.seller_id = s.id
        order by m.period_start desc limit 1
      ) m on true
      where s.id = v_seller_id and s.status = 'approved'
        and ((m.status = 'active' and m.grace_until > now()) or (m.status = 'grace' and m.renewal_grace and m.grace_until > now()))
    ) then
      raise exception 'A seller is not currently eligible to accept orders.';
    end if;

    select coalesce(sum(p.price * q.quantity), 0) into v_subtotal
    from (
      select (i->>'productId')::uuid as product_id, sum((i->>'quantity')::integer)::integer as quantity
      from jsonb_array_elements(p_items) i
      group by (i->>'productId')::uuid
    ) q
    join public.marketplace_products p on p.id = q.product_id
    where p.seller_id is not distinct from v_seller_id and p.status = 'published';

    if v_subtotal <= 0 then raise exception 'Order total is invalid.'; end if;

    v_order_id := gen_random_uuid();
    v_order_ref := 'BCM-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12));
    insert into public.marketplace_orders (
      id, checkout_group_id, order_ref, seller_id, customer_name, customer_email, customer_mobile,
      shipping_address, subtotal, delivery_charge, total_amount, payment_method, payment_status, payment_expires_at, status
    ) values (
      v_order_id, v_checkout_group_id, v_order_ref, v_seller_id, v_name, v_email, v_mobile,
      p_customer->'address', v_subtotal, 0, v_subtotal, p_payment_method,
      case when p_payment_method = 'upi' then 'pending' else 'cod_due' end,
      case when p_payment_method = 'upi' then now() + interval '30 minutes' else null end, 'placed'
    );

    for v_item in
      select p.id, p.name, p.price, sum((i->>'quantity')::integer)::integer as quantity
      from jsonb_array_elements(p_items) i
      join public.marketplace_products p on p.id = (i->>'productId')::uuid
      where p.seller_id is not distinct from v_seller_id and p.status = 'published'
      group by p.id, p.name, p.price
    loop
      update public.marketplace_products
      set stock = stock - v_item.quantity, updated_at = now()
      where id = v_item.id and stock >= v_item.quantity and status = 'published';
      if not found then raise exception 'Insufficient stock for product %.', v_item.name; end if;
      insert into public.marketplace_order_items (order_id, product_id, product_name, quantity, unit_price)
      values (v_order_id, v_item.id, v_item.name, v_item.quantity, v_item.price);
    end loop;

    insert into public.marketplace_order_events (order_id, action, note)
    values (v_order_id, 'order_placed', 'Customer placed the order.');

    v_result := v_result || jsonb_build_array(jsonb_build_object(
      'id', v_order_id, 'orderRef', v_order_ref, 'sellerId', v_seller_id,
      'totalAmount', v_subtotal, 'paymentMethod', p_payment_method
    ));
  end loop;
  return jsonb_build_object('checkoutGroupId', v_checkout_group_id, 'orders', v_result);
end;
$$;

revoke all on function public.marketplace_create_orders(jsonb,jsonb,text) from public, anon, authenticated;
grant execute on function public.marketplace_create_orders(jsonb,jsonb,text) to service_role;

create or replace function public.marketplace_cancel_order(
  p_order_id uuid,
  p_actor_id uuid,
  p_reason text,
  p_reject_payment boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $cancel_order$
declare
  v_order public.marketplace_orders%rowtype;
begin
  select * into v_order
  from public.marketplace_orders
  where id = p_order_id
  for update;

  if not found then raise exception 'Order not found.'; end if;
  if v_order.status = 'cancelled' then
    return jsonb_build_object('orderId', v_order.id, 'status', v_order.status, 'alreadyCancelled', true);
  end if;
  if v_order.status in ('shipped','delivered','returned') or v_order.payment_status in ('paid','cod_paid','refunded') then
    raise exception 'A delivered or paid order cannot be cancelled automatically.';
  end if;
  if v_order.payment_method = 'upi' and v_order.payment_status = 'claimed' and p_reject_payment is distinct from true then
    raise exception 'A claimed UPI payment must be reviewed by the owner before cancellation.';
  end if;
  if p_reject_payment and (v_order.payment_method <> 'upi' or v_order.payment_status not in ('pending','claimed')) then
    raise exception 'Only an unpaid or claimed UPI order can be rejected and cancelled.';
  end if;

  if v_order.stock_released_at is null then
    update public.marketplace_products p
    set stock = p.stock + item_totals.quantity, updated_at = now()
    from (
      select product_id, sum(quantity)::integer as quantity
      from public.marketplace_order_items
      where order_id = v_order.id and product_id is not null
      group by product_id
    ) item_totals
    where p.id = item_totals.product_id;
  end if;

  update public.marketplace_orders
  set status = 'cancelled',
      payment_status = case when p_reject_payment then 'rejected' else payment_status end,
      stock_released_at = coalesce(stock_released_at, now()),
      updated_at = now()
  where id = v_order.id;

  insert into public.marketplace_order_events (order_id, actor_id, action, note)
  values (v_order.id, p_actor_id, 'order_cancelled', left(coalesce(p_reason, 'Order cancelled.'), 1000));

  return jsonb_build_object('orderId', v_order.id, 'status', 'cancelled', 'stockReleased', true);
end;
$cancel_order$;

revoke all on function public.marketplace_cancel_order(uuid,uuid,text,boolean) from public, anon, authenticated;
grant execute on function public.marketplace_cancel_order(uuid,uuid,text,boolean) to service_role;

create or replace function public.marketplace_expire_unpaid_orders()
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $expire_orders$
declare
  v_order record;
  v_count integer := 0;
begin
  for v_order in
    select id from public.marketplace_orders
    where payment_method = 'upi' and payment_status = 'pending'
      and status = 'placed' and payment_expires_at <= now()
      and stock_released_at is null
    order by payment_expires_at
    limit 200
    for update skip locked
  loop
    perform public.marketplace_cancel_order(v_order.id, null, 'Unpaid UPI order expired after 30 minutes.', true);
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$expire_orders$;

revoke all on function public.marketplace_expire_unpaid_orders() from public, anon, authenticated;
grant execute on function public.marketplace_expire_unpaid_orders() to service_role;

create or replace function public.marketplace_rollover_memberships()
returns integer
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_created integer := 0;
begin
  with expired as (
    update public.marketplace_memberships
    set status = 'expired', updated_at = now()
    where status = 'active' and expires_at <= now()
    returning seller_id, expires_at
  )
  insert into public.marketplace_memberships (
    seller_id, period_start, expires_at, grace_until, fee_amount, paid_amount, status, renewal_grace
  )
  select seller_id, expires_at, expires_at + interval '1 year',
         expires_at + interval '1 year 15 days', 200.00, 0, 'grace', true
  from expired
  on conflict (seller_id, period_start) do nothing;
  get diagnostics v_created = row_count;

  update public.marketplace_memberships
  set status = 'paused', updated_at = now()
  where status in ('pending','grace') and grace_until <= now() and paid_amount < fee_amount;

  return v_created;
end;
$$;

revoke all on function public.marketplace_rollover_memberships() from public, anon, authenticated;
grant execute on function public.marketplace_rollover_memberships() to service_role;

create or replace function public.marketplace_review_membership_payment(
  p_payment_id uuid,
  p_decision text,
  p_actor_id uuid,
  p_bank_statement_verified boolean
) returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $review_membership_payment$
declare
  v_payment public.marketplace_membership_payments%rowtype;
  v_membership public.marketplace_memberships%rowtype;
  v_new_paid numeric(10,2);
  v_full boolean;
  v_new_status text;
begin
  if p_decision not in ('verified','rejected') then
    raise exception 'Invalid membership payment decision.';
  end if;

  select * into v_payment
  from public.marketplace_membership_payments
  where id = p_payment_id
  for update;

  if not found or v_payment.status <> 'claimed' then
    raise exception 'Membership payment is not awaiting verification.';
  end if;

  if p_decision = 'verified' and (p_bank_statement_verified is distinct from true or v_payment.claimed_utr is null) then
    raise exception 'A submitted UTR and bank statement verification are required.';
  end if;

  if p_decision = 'rejected' then
    update public.marketplace_membership_payments
    set status = 'rejected', verified_by = p_actor_id, verified_at = now(),
        rejection_note = 'Payment could not be verified by the owner.', updated_at = now()
    where id = p_payment_id;
    return jsonb_build_object('paymentId', p_payment_id, 'paymentStatus', 'rejected');
  end if;

  select * into v_membership
  from public.marketplace_memberships
  where id = v_payment.membership_id
  for update;

  if not found then raise exception 'Membership record not found.'; end if;

  v_new_paid := least(v_membership.fee_amount, v_membership.paid_amount + v_payment.amount);
  v_full := v_new_paid >= v_membership.fee_amount;
  v_new_status := v_membership.status;

  update public.marketplace_membership_payments
  set status = 'verified', verified_utr = claimed_utr, verified_by = p_actor_id,
      verified_at = now(), rejection_note = '', updated_at = now()
  where id = p_payment_id;

  if v_full then
    v_new_status := 'active';
    if v_membership.status in ('pending','paused') then
      update public.marketplace_memberships
      set paid_amount = v_new_paid, status = 'active', renewal_grace = false,
          period_start = now(), expires_at = now() + interval '1 year',
          grace_until = now() + interval '1 year 15 days', updated_at = now()
      where id = v_membership.id;
    else
      update public.marketplace_memberships
      set paid_amount = v_new_paid, status = 'active', renewal_grace = false, updated_at = now()
      where id = v_membership.id;
    end if;
  else
    update public.marketplace_memberships
    set paid_amount = v_new_paid, updated_at = now()
    where id = v_membership.id;
  end if;

  return jsonb_build_object(
    'paymentId', p_payment_id,
    'paymentStatus', 'verified',
    'paidAmount', v_new_paid,
    'membershipStatus', v_new_status,
    'fullyPaid', v_full
  );
end;
$review_membership_payment$;

revoke all on function public.marketplace_review_membership_payment(uuid,text,uuid,boolean) from public, anon, authenticated;
grant execute on function public.marketplace_review_membership_payment(uuid,text,uuid,boolean) to service_role;

create or replace function public.marketplace_validate_cron_token(p_token text)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select coalesce(
    exists (
      select 1 from vault.decrypted_secrets
      where name = 'marketplace_cron_token' and decrypted_secret = p_token
    ), false
  );
$$;

revoke all on function public.marketplace_validate_cron_token(text) from public, anon, authenticated;
grant execute on function public.marketplace_validate_cron_token(text) to service_role;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name = 'marketplace_project_url') then
    perform vault.create_secret('https://dyzyfugxzsdvboxerbxv.supabase.co', 'marketplace_project_url');
  end if;
  if not exists (select 1 from vault.decrypted_secrets where name = 'marketplace_cron_token') then
    perform vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'marketplace_cron_token');
  end if;
end;
$$;

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
begin
  if exists (select 1 from cron.job where jobname = 'marketplace-membership-reminders') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'marketplace-membership-reminders';
  end if;
  if exists (select 1 from cron.job where jobname = 'marketplace-expire-unpaid-orders') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'marketplace-expire-unpaid-orders';
  end if;
  perform cron.schedule(
    'marketplace-expire-unpaid-orders',
    '*/15 * * * *',
    $job$ select public.marketplace_expire_unpaid_orders(); $job$
  );
  perform cron.schedule(
    'marketplace-membership-reminders',
    '30 4 * * *',
    $job$
      select net.http_post(
        url := (select decrypted_secret from vault.decrypted_secrets where name = 'marketplace_project_url')
          || '/functions/v1/marketplace-reminders',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-marketplace-cron-token',
          (select decrypted_secret from vault.decrypted_secrets where name = 'marketplace_cron_token')
        ),
        body := '{}'::jsonb
      );
    $job$
  );
end;
$$;

comment on table public.marketplace_sellers is 'Marketplace seller applications and owner approval state.';
comment on table public.marketplace_memberships is '₹200 annual seller membership periods; no sales commission is charged.';
comment on table public.marketplace_membership_payments is 'Seller-selected flexible instalments against an annual ₹200 membership fee.';
comment on table public.marketplace_membership_reminders is 'Idempotent monthly seller membership reminder log.';
comment on table public.marketplace_products is 'Marketplace listings. All public reads and writes are mediated by the marketplace Edge Function.';
comment on table public.marketplace_orders is 'Seller-split customer orders. Seller-managed delivery; zero marketplace commission.';
