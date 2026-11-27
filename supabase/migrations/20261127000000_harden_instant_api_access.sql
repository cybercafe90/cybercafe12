-- Restrict the public catalogue view to the caller's RLS context and remove duplicate owner SELECT policy.
-- Public catalogue reads are served by instant-api-gateway using its server-side service role.
drop policy if exists instant_api_services_owner_read on public.instant_api_services;

create or replace view public.instant_api_service_catalog
with (security_invoker = true)
as
select slug, name, description, customer_price, is_featured, sort_order
from public.instant_api_services
where is_enabled = true and authorization_verified = true;

comment on view public.instant_api_service_catalog is
'RLS-invoker catalogue view. Public customer catalogue is served by instant-api-gateway; direct anon reads return no rows unless an explicit policy is added.';
