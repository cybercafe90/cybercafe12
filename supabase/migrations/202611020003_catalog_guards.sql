create or replace function public.prevent_active_service_in_inactive_category()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_active and not exists (
    select 1 from public.service_categories
    where slug = new.category_slug and is_active
  ) then
    raise exception 'An active service must belong to an active category' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger service_active_category_guard
before insert or update of category_slug, is_active on public.services
for each row execute function public.prevent_active_service_in_inactive_category();

create or replace function public.prevent_category_deactivation_with_active_services()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.is_active and not new.is_active and exists (
    select 1 from public.services
    where category_slug = old.slug and is_active
  ) then
    raise exception 'Deactivate or move active services before deactivating this category' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger category_active_service_guard
before update of is_active on public.service_categories
for each row execute function public.prevent_category_deactivation_with_active_services();
