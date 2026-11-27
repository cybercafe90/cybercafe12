begin;

-- The owner operations screen reads this table directly under the existing
-- audit_owner_read RLS policy. The previous least-privilege migration revoked
-- the table grant, so the policy alone was not sufficient for PostgREST.
grant select on table public.admin_audit_logs to authenticated;

-- This view is unused by the application: customer catalogue reads go through
-- the authenticated server-side instant-api-gateway. Remove the public
-- SECURITY DEFINER view rather than exposing its owner's table privileges.
drop view if exists public.instant_api_service_catalog;

commit;
