insert into public.service_categories (name, slug, description, sort_order, is_published)
values
  ('Revenue', 'revenue', 'Assistance with selected revenue services and certificates.', 1, true),
  ('Srinagar Municipal Corporation', 'smc', 'Assistance with selected municipal services.', 2, true),
  ('RTO & Transport', 'rto-transport', 'Assistance with selected transport services.', 3, true),
  ('Labour', 'labour', 'Assistance with selected labour services.', 4, true),
  ('Handloom & Handicrafts', 'handloom-handicrafts', 'Assistance with selected handloom and handicrafts services.', 5, true),
  ('Central Government Schemes', 'central-government', 'Assistance with selected central government services and schemes.', 6, true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_published = excluded.is_published;

-- Service records are deliberately not seeded until verified catalogue data is supplied.
