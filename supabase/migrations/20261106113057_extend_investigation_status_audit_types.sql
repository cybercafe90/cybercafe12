alter table public.security_actions drop constraint security_actions_action_type_check;

alter table public.security_actions
  add constraint security_actions_action_type_check
  check (action_type = any (array[
    'managed_challenge',
    'temporary_ip_block',
    'release_ip',
    'mark_new',
    'mark_investigating',
    'mark_contained',
    'mark_resolved',
    'false_positive'
  ]::text[]));
