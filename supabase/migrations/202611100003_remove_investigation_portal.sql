-- Permanently retire investigator-only access grants with the removed portal.
-- Security event records remain available to the separate security telemetry pipeline.
drop table if exists public.security_investigators;
