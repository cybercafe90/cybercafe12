begin;

-- Record every Instant API order insert/update/delete without copying encrypted
-- request/result payloads, payment credentials, or customer identifiers.
drop trigger if exists audit_instant_api_orders on public.instant_api_orders;
create trigger audit_instant_api_orders
  after insert or update or delete on public.instant_api_orders
  for each row execute function public.write_audit_log();

commit;
