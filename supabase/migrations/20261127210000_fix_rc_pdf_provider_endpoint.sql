begin;

-- The provider's documented RC PDF route is /api/rc-pdf.php (GET).
-- Keep the service's existing enable/authorization flags unchanged; activation
-- remains an explicit owner decision after the rotated key is installed/tested.
update public.instant_api_services
set endpoint_url = 'https://api.smmtopserver.shop/api/rc-pdf.php',
    http_method = 'GET',
    provider_cost = 10,
    updated_at = now()
where slug = 'vehicle-rc-pdf';

commit;
