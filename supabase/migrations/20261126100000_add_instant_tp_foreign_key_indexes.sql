-- Cover the three foreign keys identified by the live Supabase performance advisor.
-- Safe to apply more than once; this migration is not applied to production by this PR.
create index if not exists instant_tp_applications_payment_verified_by_idx
  on public.instant_tp_applications (payment_verified_by);

create index if not exists instant_tp_applications_policy_issued_by_idx
  on public.instant_tp_applications (policy_issued_by);

create index if not exists instant_tp_audit_events_actor_id_idx
  on public.instant_tp_audit_events (actor_id);
