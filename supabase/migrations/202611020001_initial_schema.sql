create extension if not exists pgcrypto;
create extension if not exists pg_trgm with schema extensions;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text check (char_length(full_name) <= 120),
  mobile text check (mobile is null or char_length(mobile) between 8 and 20),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create table public.service_categories (
  slug text primary key check (slug ~ '^[a-z0-9-]{2,48}$'),
  name text not null unique check (char_length(name) between 2 and 100),
  description text not null default '' check (char_length(description) <= 500),
  icon text not null default 'file',
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_slug text not null references public.service_categories (slug) on update cascade,
  name text not null check (char_length(name) between 2 and 160),
  description text not null default '' check (char_length(description) <= 2000),
  required_documents text[] not null default '{}' check (cardinality(required_documents) <= 40 and array_position(required_documents, null) is null),
  eligibility text not null default '' check (char_length(eligibility) <= 1000),
  application_method text not null default '' check (char_length(application_method) <= 1000),
  official_url text check (official_url is null or official_url ~ '^https://'),
  official_url_verified boolean not null default false,
  check (official_url is null or official_url_verified),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_slug, name)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  tracking_id text not null unique check (tracking_id ~ '^BABA-[A-Z0-9]{10}$'),
  user_id uuid references auth.users (id) on delete set null,
  full_name text not null check (char_length(full_name) between 2 and 120),
  mobile text not null check (char_length(mobile) between 8 and 20),
  email text not null check (char_length(email) <= 254),
  category_slug text not null references public.service_categories (slug),
  service_name text not null check (char_length(service_name) between 2 and 160),
  description text not null check (char_length(description) between 10 and 2000),
  required_documents text not null default '' check (char_length(required_documents) <= 1000),
  consent_at timestamptz not null,
  status text not null default 'Application Received' check (status in ('Application Received', 'Under Review', 'Documents Required', 'Processing', 'Submitted to Department', 'Approved', 'Rejected', 'Completed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.application_documents (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  file_name text not null check (char_length(file_name) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size_bytes bigint not null check (file_size_bytes between 1 and 10485760),
  is_customer_visible boolean not null default false,
  uploaded_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  status text not null check (status in ('Application Received', 'Under Review', 'Documents Required', 'Processing', 'Submitted to Department', 'Approved', 'Rejected', 'Completed')),
  changed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.application_remarks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications (id) on delete cascade,
  author_id uuid references auth.users (id) on delete set null,
  visibility text not null check (visibility in ('customer', 'internal')),
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create table public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications (id) on delete set null,
  recipient_email text not null check (char_length(recipient_email) <= 254),
  notification_type text not null check (notification_type in ('application_confirmation', 'status_update', 'document_available', 'customer_enquiry')),
  status text not null check (status in ('queued', 'sent', 'failed', 'not_configured')),
  provider_id text,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.website_settings (
  key text primary key check (key ~ '^[a-z0-9_-]{2,80}$'),
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null check (char_length(action) between 2 and 100),
  entity_type text not null check (char_length(entity_type) between 2 and 80),
  entity_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.request_rate_limits (
  scope_hash text not null,
  window_start timestamptz not null,
  attempts integer not null default 1 check (attempts > 0),
  primary key (scope_hash, window_start)
);

create index services_active_category_idx on public.services (category_slug, is_active, is_featured);
create index services_created_idx on public.services (created_at desc) where is_active;
create index services_name_trgm_idx on public.services using gin (name extensions.gin_trgm_ops);
create index applications_user_created_idx on public.applications (user_id, created_at desc);
create index applications_status_created_idx on public.applications (status, created_at desc);
create index applications_mobile_idx on public.applications (mobile);
create index applications_name_trgm_idx on public.applications using gin (full_name extensions.gin_trgm_ops);
create index application_documents_application_idx on public.application_documents (application_id, created_at desc);
create index application_status_application_idx on public.application_status_history (application_id, created_at desc);
create index application_remarks_application_idx on public.application_remarks (application_id, visibility, created_at desc);
create index email_notifications_application_idx on public.email_notifications (application_id, created_at desc);
create index admin_audit_created_idx on public.admin_audit_logs (created_at desc);

create or replace function public.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_roles.user_id = (select auth.uid()) and user_roles.role = 'owner'
  );
$$;
revoke all on function public.is_owner() from public, anon;
grant execute on function public.is_owner() to authenticated, service_role;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.record_application_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.application_status_history (application_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  elsif new.status is distinct from old.status then
    insert into public.application_status_history (application_id, status, changed_by)
    values (new.id, new.status, auth.uid());
  end if;
  return new;
end;
$$;

create or replace function public.write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  record_id text;
begin
  record_id := coalesce(to_jsonb(new)->>'id', to_jsonb(new)->>'key', to_jsonb(new)->>'slug', to_jsonb(old)->>'id', to_jsonb(old)->>'key', to_jsonb(old)->>'slug');
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), lower(tg_op), tg_table_name, record_id, jsonb_build_object('source', 'database_trigger'));
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.service_categories for each row execute function public.set_updated_at();
create trigger services_updated_at before update on public.services for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications for each row execute function public.set_updated_at();
create trigger website_settings_updated_at before update on public.website_settings for each row execute function public.set_updated_at();
create trigger application_status_history_trigger after insert or update of status on public.applications for each row execute function public.record_application_status();
create trigger audit_applications after insert or update or delete on public.applications for each row execute function public.write_audit_log();
create trigger audit_documents after insert or update or delete on public.application_documents for each row execute function public.write_audit_log();
create trigger audit_services after insert or update or delete on public.services for each row execute function public.write_audit_log();
create trigger audit_categories after insert or update or delete on public.service_categories for each row execute function public.write_audit_log();
create trigger audit_settings after insert or update or delete on public.website_settings for each row execute function public.write_audit_log();

create or replace function public.consume_rate_limit(p_scope_hash text, p_window_start timestamptz, p_limit integer)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_attempts integer;
begin
  delete from public.request_rate_limits where window_start < now() - interval '24 hours';
  insert into public.request_rate_limits (scope_hash, window_start)
  values (p_scope_hash, p_window_start)
  on conflict (scope_hash, window_start)
  do update set attempts = public.request_rate_limits.attempts + 1
  returning attempts into current_attempts;
  return current_attempts <= p_limit;
end;
$$;
revoke all on function public.consume_rate_limit(text, timestamptz, integer) from public, anon, authenticated;
grant execute on function public.consume_rate_limit(text, timestamptz, integer) to service_role;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(left(new.raw_user_meta_data->>'full_name', 120), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_auth_user();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.service_categories enable row level security;
alter table public.services enable row level security;
alter table public.applications enable row level security;
alter table public.application_documents enable row level security;
alter table public.application_status_history enable row level security;
alter table public.application_remarks enable row level security;
alter table public.email_notifications enable row level security;
alter table public.website_settings enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.request_rate_limits enable row level security;

create policy "profiles_read_self_or_owner" on public.profiles for select to authenticated using (id = (select auth.uid()) or (select public.is_owner()));
create policy "profiles_update_self_or_owner" on public.profiles for update to authenticated using (id = (select auth.uid()) or (select public.is_owner())) with check (id = (select auth.uid()) or (select public.is_owner()));
create policy "roles_read_self_or_owner" on public.user_roles for select to authenticated using (user_id = (select auth.uid()) or (select public.is_owner()));
create policy "categories_read_active" on public.service_categories for select to anon, authenticated using (is_active or (select public.is_owner()));
create policy "categories_owner_manage" on public.service_categories for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "services_read_active" on public.services for select to anon, authenticated using (is_active or (select public.is_owner()));
create policy "services_owner_manage" on public.services for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "applications_customer_read_own" on public.applications for select to authenticated using (user_id = (select auth.uid()));
create policy "applications_owner_read_all" on public.applications for select to authenticated using ((select public.is_owner()));
create policy "documents_owner_manage" on public.application_documents for all to authenticated using ((select public.is_owner())) with check ((select public.is_owner()));
create policy "status_owner_read" on public.application_status_history for select to authenticated using ((select public.is_owner()));
create policy "remarks_owner_read" on public.application_remarks for select to authenticated using ((select public.is_owner()));
create policy "emails_owner_read" on public.email_notifications for select to authenticated using ((select public.is_owner()));
create policy "settings_read_public" on public.website_settings for select to anon, authenticated using (is_public or (select public.is_owner()));
create policy "audit_owner_read" on public.admin_audit_logs for select to authenticated using ((select public.is_owner()));

insert into public.service_categories (slug, name, description, icon, sort_order) values
  ('insurance', 'Insurance', 'Policy enquiries, renewals and documentation assistance.', 'shield', 1),
  ('revenue', 'Revenue Department', 'Certificate and land-record assistance.', 'landmark', 2),
  ('smc', 'Srinagar Municipal Corporation', 'Municipal application and information assistance.', 'building', 3),
  ('labour', 'Labour Department', 'Registration and welfare-application assistance.', 'briefcase', 4),
  ('handloom', 'Handloom & Handicrafts', 'Weaver, artisan and scheme documentation assistance.', 'scroll', 5),
  ('rto', 'RTO & Transport', 'Licence, registration and transport-service assistance.', 'car', 6),
  ('central', 'Central Government Services', 'Public-service application assistance.', 'globe', 7),
  ('education', 'Education Department', 'Education-related public-service assistance.', 'book', 8),
  ('social-welfare', 'Social Welfare Department', 'Social-welfare application assistance.', 'heart', 9),
  ('employment', 'Employment Services', 'Employment and registration assistance.', 'users', 10),
  ('health', 'Health Services', 'Health-service application assistance.', 'activity', 11),
  ('agriculture', 'Agriculture Department', 'Agriculture-related public-service assistance.', 'sprout', 12),
  ('electricity', 'Electricity Services', 'Electricity-service request assistance.', 'zap', 13),
  ('water', 'Water Supply Services', 'Water-supply request assistance.', 'droplets', 14),
  ('banking', 'Banking Assistance', 'Digital banking-form assistance; no banking advice.', 'landmark', 15),
  ('travel', 'Railway & Bus Ticketing', 'Ticketing enquiries and booking assistance.', 'ticket', 16),
  ('other', 'Other Public Services', 'Ask about a public service not listed here.', 'more', 17)
on conflict (slug) do nothing;

insert into public.services (category_slug, name, description, eligibility, application_method, is_featured) values
  ('insurance','Life Insurance','Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.','Requirements depend on the insurer. Confirm current eligibility and terms directly.','Enquiry and documentation assistance; policy decisions remain with the insurer.',true),
  ('insurance','Health Insurance','Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.','Requirements depend on the insurer. Confirm current eligibility and terms directly.','Enquiry and documentation assistance; policy decisions remain with the insurer.',true),
  ('insurance','Motor Insurance','Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.','Requirements depend on the insurer. Confirm current eligibility and terms directly.','Enquiry and documentation assistance; policy decisions remain with the insurer.',true),
  ('insurance','Two-Wheeler Insurance','Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.','Requirements depend on the insurer. Confirm current eligibility and terms directly.','Enquiry and documentation assistance; policy decisions remain with the insurer.',false),
  ('insurance','Four-Wheeler Insurance','Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.','Requirements depend on the insurer. Confirm current eligibility and terms directly.','Enquiry and documentation assistance; policy decisions remain with the insurer.',false),
  ('insurance','Commercial Vehicle Insurance','Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.','Requirements depend on the insurer. Confirm current eligibility and terms directly.','Enquiry and documentation assistance; policy decisions remain with the insurer.',false),
  ('insurance','Personal Accident Insurance','Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.','Requirements depend on the insurer. Confirm current eligibility and terms directly.','Enquiry and documentation assistance; policy decisions remain with the insurer.',false),
  ('insurance','Travel Insurance','Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.','Requirements depend on the insurer. Confirm current eligibility and terms directly.','Enquiry and documentation assistance; policy decisions remain with the insurer.',false),
  ('insurance','Home Insurance','Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.','Requirements depend on the insurer. Confirm current eligibility and terms directly.','Enquiry and documentation assistance; policy decisions remain with the insurer.',false),
  ('insurance','Business Insurance','Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.','Requirements depend on the insurer. Confirm current eligibility and terms directly.','Enquiry and documentation assistance; policy decisions remain with the insurer.',false),
  ('insurance','Renewal Assistance','Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.','Requirements depend on the insurer. Confirm current eligibility and terms directly.','Enquiry and documentation assistance; policy decisions remain with the insurer.',false),
  ('insurance','Insurance Quotation Requests','Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.','Requirements depend on the insurer. Confirm current eligibility and terms directly.','Enquiry and documentation assistance; policy decisions remain with the insurer.',false),
  ('insurance','Policy Documentation Assistance','Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.','Requirements depend on the insurer. Confirm current eligibility and terms directly.','Enquiry and documentation assistance; policy decisions remain with the insurer.',false),
  ('insurance','Claim Assistance','Enquiry and documentation assistance. Coverage, eligibility, premium and claim decisions are made by the insurer.','Requirements depend on the insurer. Confirm current eligibility and terms directly.','Enquiry and documentation assistance; policy decisions remain with the insurer.',false),
  ('revenue','Income Certificate','Application and document-preparation assistance. Eligibility and issuance are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('revenue','Domicile Certificate','Application and document-preparation assistance. Eligibility and issuance are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('revenue','Category Certificate','Application and document-preparation assistance. Eligibility and issuance are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('revenue','Residence Certificate','Application and document-preparation assistance. Eligibility and issuance are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('revenue','Character Certificate (where applicable)','Application and document-preparation assistance. Eligibility and issuance are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('revenue','Land Record Assistance','Application and document-preparation assistance. Eligibility and issuance are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('revenue','Fard / Jamabandi Assistance','Application and document-preparation assistance. Eligibility and issuance are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('revenue','Mutation Application Assistance','Application and document-preparation assistance. Eligibility and issuance are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('revenue','Revenue Record Requests','Application and document-preparation assistance. Eligibility and issuance are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('smc','Birth Registration Assistance','Application and information assistance. Availability and decisions are determined by Srinagar Municipal Corporation.','Confirm current eligibility and requirements with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('smc','Death Registration Assistance','Application and information assistance. Availability and decisions are determined by Srinagar Municipal Corporation.','Confirm current eligibility and requirements with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('smc','Building Permission Assistance','Application and information assistance. Availability and decisions are determined by Srinagar Municipal Corporation.','Confirm current eligibility and requirements with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('smc','Trade Licence Assistance','Application and information assistance. Availability and decisions are determined by Srinagar Municipal Corporation.','Confirm current eligibility and requirements with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('smc','Property Tax Assistance','Application and information assistance. Availability and decisions are determined by Srinagar Municipal Corporation.','Confirm current eligibility and requirements with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('smc','Municipal Complaint Assistance','Application and information assistance. Availability and decisions are determined by Srinagar Municipal Corporation.','Confirm current eligibility and requirements with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('smc','Sanitation-related Services','Application and information assistance. Availability and decisions are determined by Srinagar Municipal Corporation.','Confirm current eligibility and requirements with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('labour','Labour Registration Assistance','Application and documentation assistance. Eligibility and decisions are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('labour','Labour Card Application Assistance','Application and documentation assistance. Eligibility and decisions are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('labour','Renewal Assistance','Application and documentation assistance. Eligibility and decisions are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('labour','Welfare Scheme Application Assistance','Application and documentation assistance. Eligibility and decisions are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('labour','Construction Worker Registration Assistance','Application and documentation assistance. Eligibility and decisions are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('handloom','Weaver Registration Assistance','Registration and application assistance. Eligibility and decisions are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('handloom','Artisan Registration Assistance','Registration and application assistance. Eligibility and decisions are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('handloom','Weaver Card Assistance','Registration and application assistance. Eligibility and decisions are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('handloom','Handloom-related Scheme Applications','Registration and application assistance. Eligibility and decisions are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('handloom','Handicraft-related Scheme Applications','Registration and application assistance. Eligibility and decisions are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('handloom','Artisan Documentation','Registration and application assistance. Eligibility and decisions are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('handloom','Registration and Renewal Assistance','Registration and application assistance. Eligibility and decisions are determined by the relevant department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('rto','Learner Licence Assistance','Online application assistance. Eligibility and decisions are determined by the transport department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('rto','Driving Licence Assistance','Online application assistance. Eligibility and decisions are determined by the transport department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('rto','Licence Renewal','Online application assistance. Eligibility and decisions are determined by the transport department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('rto','Vehicle Registration Assistance','Online application assistance. Eligibility and decisions are determined by the transport department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('rto','RC-related Services','Online application assistance. Eligibility and decisions are determined by the transport department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('rto','NOC Assistance','Online application assistance. Eligibility and decisions are determined by the transport department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('rto','Permit Assistance','Online application assistance. Eligibility and decisions are determined by the transport department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('rto','Challan Information Assistance','Online application assistance. Eligibility and decisions are determined by the transport department.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('central','PAN Card Assistance','Digital application assistance. Eligibility and decisions are determined by the relevant authority.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('central','ABHA Assistance','Digital application assistance. Eligibility and decisions are determined by the relevant authority.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('central','MSME / Udyam Assistance','Digital application assistance. Eligibility and decisions are determined by the relevant authority.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('central','Trademark Application Assistance','Digital application assistance. Eligibility and decisions are determined by the relevant authority.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false),
  ('central','Food Licence / FSSAI Assistance','Digital application assistance. Eligibility and decisions are determined by the relevant authority.','Confirm current eligibility with the responsible authority.','Independent application assistance; the authority controls the official process.',false)
on conflict (category_slug, name) do nothing;

insert into public.website_settings (key, value, is_public) values
  ('homepage_announcement', '{"enabled":false,"text":""}'::jsonb, true),
  ('homepage_content', '{"eyebrow":"LOCAL SERVICE · SRINAGAR, J&K","headline":"Everyday services|made simpler.","description":"Friendly help with digital applications, documents and service enquiries, all in one place."}'::jsonb, true),
  ('contact', '{"phone":"+91 7006865909","whatsapp":"917006865909","email":"support@babacybercafe.in"}'::jsonb, true),
  ('social_links', '{"facebook":"https://www.facebook.com/share/1cKyxm9dZ/","business_profile":"https://share.google/0zqTy0GylWp6CnSYO"}'::jsonb, true)
on conflict (key) do nothing;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('application-documents', 'application-documents', false, 10485760, array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf','image/jpeg','image/png'];

create policy "private_documents_owner_read" on storage.objects for select to authenticated using (bucket_id = 'application-documents' and (select public.is_owner()));
create policy "private_documents_owner_upload" on storage.objects for insert to authenticated with check (bucket_id = 'application-documents' and (select public.is_owner()));
create policy "private_documents_owner_update" on storage.objects for update to authenticated using (bucket_id = 'application-documents' and (select public.is_owner())) with check (bucket_id = 'application-documents' and (select public.is_owner()));
create policy "private_documents_owner_delete" on storage.objects for delete to authenticated using (bucket_id = 'application-documents' and (select public.is_owner()));
