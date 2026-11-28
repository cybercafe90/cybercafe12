alter table public.services
  add column if not exists is_featured boolean not null default false;

create index if not exists services_featured_published_idx
  on public.services (is_featured desc, name)
  where is_published and is_featured;
