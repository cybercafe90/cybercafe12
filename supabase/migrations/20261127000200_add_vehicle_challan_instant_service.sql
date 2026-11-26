begin;

insert into public.instant_api_services
  (slug, name, description, provider_name, endpoint_url, http_method, api_key_secret_name,
   provider_cost, customer_price, is_enabled, is_featured, authorization_verified, sort_order)
values
  ('vehicle-challan-check', 'Vehicle Challan Check',
   'Check available traffic challan details for a vehicle registration number. Independent third-party lookup; not a government portal.',
   'SMM Top Server', 'https://api.smmtopserver.shop/api/challan-details.php', 'GET',
   'INSTANT_API_VEHICLE_CHALLAN_KEY', null, 30.00, true, true, true, 9)
on conflict (slug) do update set
  name = excluded.name,
  description = excluded.description,
  provider_name = excluded.provider_name,
  endpoint_url = excluded.endpoint_url,
  http_method = excluded.http_method,
  api_key_secret_name = excluded.api_key_secret_name,
  customer_price = excluded.customer_price,
  is_enabled = true,
  is_featured = true,
  authorization_verified = true,
  sort_order = excluded.sort_order;

commit;
