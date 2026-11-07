begin;
create table if not exists public.insurance_email_notifications (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.insurance_quote_requests(id) on delete cascade,
  recipient_email text not null check (char_length(recipient_email) <= 254),
  notification_type text not null check (notification_type in ('customer_confirmation','business_alert','quote_ready')),
  status text not null check (status in ('sent','failed','not_configured')),
  provider_id text,
  error_message text,
  created_at timestamptz not null default now()
);
create index if not exists insurance_email_notifications_request_idx
  on public.insurance_email_notifications(request_id, created_at desc);
alter table public.insurance_email_notifications enable row level security;
revoke all privileges on table public.insurance_email_notifications from public, anon, authenticated;
grant all privileges on table public.insurance_email_notifications to service_role;
commit;
