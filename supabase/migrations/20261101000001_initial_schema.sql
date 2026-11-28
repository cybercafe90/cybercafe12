create extension if not exists pgcrypto;

create type public.application_status as enum (
  'received',
  'in_review',
  'awaiting_customer',
  'submitted',
  'completed',
  'rejected'
);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_published boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references public.service_categories(id) on delete restrict,
  name text not null,
  description text,
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, name)
);

create index services_published_category_idx on public.services (category_id, name) where is_published;

create table public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  tracking_id text not null unique check (tracking_id ~ '^BBC-[0-9]{4}-[A-Z0-9]{5}$'),
  customer_name text not null check (char_length(customer_name) between 1 and 100),
  mobile_digits text not null check (mobile_digits ~ '^[0-9]{10,15}$'),
  email text check (email is null or char_length(email) <= 254),
  service_id uuid references public.services(id) on delete set null,
  service_name_snapshot text not null check (char_length(service_name_snapshot) between 1 and 160),
  message text check (message is null or char_length(message) <= 2000),
  status public.application_status not null default 'received',
  public_remark text check (public_remark is null or char_length(public_remark) <= 1000),
  internal_notes text check (internal_notes is null or char_length(internal_notes) <= 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index applications_created_at_idx on public.applications (created_at desc);

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  file_name text not null,
  storage_path text not null unique,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.admin_users
    where user_id = (select auth.uid())
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.admin_users enable row level security;
alter table public.applications enable row level security;
alter table public.application_documents enable row level security;

create policy "Published categories are public"
  on public.service_categories for select
  to anon, authenticated
  using (is_published or (select public.is_admin()));

create policy "Published services are public"
  on public.services for select
  to anon, authenticated
  using (is_published or (select public.is_admin()));

create policy "Admins can manage categories"
  on public.service_categories for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can manage services"
  on public.services for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

create policy "Admins can read admin allowlist"
  on public.admin_users for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can read applications"
  on public.applications for select
  to authenticated
  using ((select public.is_admin()));

create policy "Admins can read application documents"
  on public.application_documents for select
  to authenticated
  using ((select public.is_admin()));

grant select on public.service_categories, public.services to anon, authenticated;
grant all on public.service_categories, public.services to authenticated;
grant select on public.admin_users, public.applications, public.application_documents to authenticated;

insert into storage.buckets (id, name, public)
values ('application-documents', 'application-documents', false)
on conflict (id) do nothing;

create policy "Admins can access application documents"
  on storage.objects for all
  to authenticated
  using (bucket_id = 'application-documents' and (select public.is_admin()))
  with check (bucket_id = 'application-documents' and (select public.is_admin()));
