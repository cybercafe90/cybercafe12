-- BABA'S SMART QR schema proposal. Preview branch only; NOT applied to any Supabase project.
create table if not exists public.smartqr_shops (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references auth.users(id) on delete cascade,
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 shop_name text not null check (char_length(shop_name) between 2 and 120),
 category text, description text, logo_path text, phone text, whatsapp text, upi_id text,
 map_url text, review_url text, address_text text,
 opening_hours jsonb not null default '{}'::jsonb, social_links jsonb not null default '{}'::jsonb,
 approval_status text not null default 'pending' check (approval_status in ('pending','approved','rejected','suspended')),
 is_active boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create or replace function public.smartqr_keep_shop_slug_immutable() returns trigger language plpgsql as $
begin
 if new.slug <> old.slug then raise exception 'Smart QR shop URLs cannot be changed after creation'; end if;
 return new;
end;
$;
create trigger smartqr_shop_slug_immutable before update of slug on public.smartqr_shops for each row execute function public.smartqr_keep_shop_slug_immutable();

create table if not exists public.smartqr_subscriptions (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.smartqr_shops(id) on delete cascade,
 plan_code text not null check (plan_code in ('starter','growth','vip')),
 status text not null default 'pending' check (status in ('pending','trialing','active','past_due','cancelled','expired')),
 setup_amount_paise integer not null default 0 check (setup_amount_paise >= 0),
 recurring_amount_paise integer not null default 0 check (recurring_amount_paise >= 0),
 billing_provider text not null default 'razorpay' check (billing_provider = 'razorpay'),
 provider_customer_id text, provider_subscription_id text unique,
 current_period_start timestamptz, current_period_end timestamptz, created_at timestamptz not null default now()
);
create table if not exists public.smartqr_print_orders (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.smartqr_shops(id) on delete cascade,
 stand_type text not null default 'printed' check (stand_type in ('printed','folded_tent')),
 quantity integer not null default 1 check (quantity between 1 and 1000),
 status text not null default 'requested' check (status in ('requested','artwork_ready','approved','printing','shipped','delivered','cancelled')),
 delivery_name text, delivery_phone text, delivery_address text, notes text, created_at timestamptz not null default now()
);
create table if not exists public.smartqr_scan_events (
 id uuid primary key default gen_random_uuid(), shop_id uuid not null references public.smartqr_shops(id) on delete cascade,
 event_type text not null default 'scan' check (event_type in ('scan','whatsapp','directions','payment_tap','call','review')),
 created_at timestamptz not null default now()
);
create index if not exists smartqr_subscriptions_shop_idx on public.smartqr_subscriptions(shop_id, created_at desc);
create index if not exists smartqr_print_orders_shop_idx on public.smartqr_print_orders(shop_id, created_at desc);
create index if not exists smartqr_scan_events_shop_time_idx on public.smartqr_scan_events(shop_id, created_at desc);
alter table public.smartqr_shops enable row level security;
alter table public.smartqr_subscriptions enable row level security;
alter table public.smartqr_print_orders enable row level security;
alter table public.smartqr_scan_events enable row level security;

create policy "Public can view active approved Smart QR shops" on public.smartqr_shops
 for select to anon, authenticated using (approval_status='approved' and is_active=true);
create policy "Owners can view their own Smart QR shops" on public.smartqr_shops
 for select to authenticated using ((select auth.uid())=owner_user_id);
create policy "Owners can create pending Smart QR shops" on public.smartqr_shops
 for insert to authenticated with check ((select auth.uid())=owner_user_id and approval_status='pending' and is_active=false);
create policy "Owners can update their own pending Smart QR shop" on public.smartqr_shops
 for update to authenticated using ((select auth.uid())=owner_user_id and approval_status='pending' and is_active=false)
 with check ((select auth.uid())=owner_user_id and approval_status='pending' and is_active=false);

create policy "Owners can read their Smart QR subscriptions" on public.smartqr_subscriptions
 for select to authenticated using (exists(select 1 from public.smartqr_shops s where s.id=shop_id and s.owner_user_id=(select auth.uid())));
create policy "Owners can read their Smart QR print orders" on public.smartqr_print_orders
 for select to authenticated using (exists(select 1 from public.smartqr_shops s where s.id=shop_id and s.owner_user_id=(select auth.uid())));
create policy "Owners can request their Smart QR print orders" on public.smartqr_print_orders
 for insert to authenticated with check (exists(select 1 from public.smartqr_shops s where s.id=shop_id and s.owner_user_id=(select auth.uid())));
create policy "Visitors can record engagement for public shops" on public.smartqr_scan_events
 for insert to anon, authenticated with check (event_type in ('scan','whatsapp','directions','payment_tap','call','review')
 and exists(select 1 from public.smartqr_shops s where s.id=shop_id and s.approval_status='approved' and s.is_active=true));
create policy "Owners can view their Smart QR analytics" on public.smartqr_scan_events
 for select to authenticated using (exists(select 1 from public.smartqr_shops s where s.id=shop_id and s.owner_user_id=(select auth.uid())));

-- No client-side subscription writes. Razorpay order creation and webhook reconciliation must be trusted Edge Functions.
-- Approval/suspension and plan activation must be server-side owner actions, never client-supplied metadata.
-- No IP address, precise location or device fingerprint is collected by this event schema.
