alter table public.security_actions drop constraint if exists security_actions_action_type_check;
alter table public.security_actions add constraint security_actions_action_type_check
  check (action_type = any (array[
    'managed_challenge'::text,
    'temporary_ip_block'::text,
    'ip_block'::text,
    'release_ip'::text,
    'mark_new'::text,
    'mark_investigating'::text,
    'mark_contained'::text,
    'mark_resolved'::text,
    'false_positive'::text
  ]));
create index if not exists security_events_source_ip_occurred_at_idx
  on public.security_events (source_ip, occurred_at desc)
  where source_ip is not null;
create index if not exists security_actions_target_ip_status_idx
  on public.security_actions (target_ip, status)
  where target_ip is not null;