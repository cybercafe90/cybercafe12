create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text check (display_name is null or char_length(display_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'staff')),
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
create index if not exists user_roles_user_role_idx on public.user_roles (user_id, role);

alter table public.service_categories
  add column if not exists updated_at timestamptz not null default now();

insert into public.user_roles (user_id, role)
select user_id, 'owner' from public.admin_users
on conflict (user_id, role) do nothing;

alter table public.applications
  add column if not exists customer_user_id uuid references auth.users(id) on delete set null,
  add column if not exists department_name_snapshot text,
  add column if not exists consent_at timestamptz,
  add column if not exists consent_version text;

update public.applications
set department_name_snapshot = coalesce(department_name_snapshot, 'General'),
    consent_at = coalesce(consent_at, created_at),
    consent_version = coalesce(consent_version, 'legacy')
where department_name_snapshot is null or consent_at is null or consent_version is null;

alter table public.applications
  alter column department_name_snapshot set not null,
  alter column consent_at set not null,
  alter column consent_version set not null,
  alter column department_name_snapshot set default 'General',
  alter column consent_version set default 'v1',
  add constraint applications_department_snapshot_length_check
    check (char_length(department_name_snapshot) between 1 and 150),
  add constraint applications_consent_version_length_check
    check (char_length(consent_version) between 1 and 40),
  add constraint applications_email_format_check
    check (email is null or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$');

create index if not exists applications_customer_user_idx
  on public.applications (customer_user_id, created_at desc)
  where customer_user_id is not null;

alter table public.application_documents
  add column if not exists content_type text,
  add column if not exists file_size_bytes bigint,
  add column if not exists upload_status text not null default 'available';

alter table public.application_documents
  add constraint application_documents_upload_status_check
    check (upload_status in ('pending_upload', 'available', 'failed')),
  add constraint application_documents_content_type_check
    check (content_type is null or content_type in ('application/pdf', 'image/jpeg', 'image/png')),
  add constraint application_documents_size_check
    check (file_size_bytes is null or file_size_bytes between 1 and 5242880);

create index if not exists application_documents_application_created_idx
  on public.application_documents (application_id, created_at desc);

create table if not exists public.application_status_history (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  previous_status public.application_status,
  new_status public.application_status not null,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists application_status_history_app_date_idx
  on public.application_status_history (application_id, created_at desc);

create table if not exists public.application_remarks (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 3000),
  is_customer_visible boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists application_remarks_app_date_idx
  on public.application_remarks (application_id, created_at desc);

create table if not exists public.email_notifications (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references public.applications(id) on delete set null,
  recipient_email text,
  notification_type text not null check (notification_type in ('application_confirmation', 'status_update')),
  provider text not null default 'resend',
  status text not null check (status in ('skipped', 'accepted', 'failed')),
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  check (recipient_email is null or char_length(recipient_email) <= 254)
);
create index if not exists email_notifications_app_date_idx
  on public.email_notifications (application_id, created_at desc);

create table if not exists public.website_settings (
  key text primary key check (key ~ '^[a-z][a-z0-9_]{1,63}$'),
  value jsonb not null default '{}'::jsonb,
  is_public boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null check (char_length(action) between 1 and 100),
  entity_type text not null check (char_length(entity_type) between 1 and 100),
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_date_idx on public.admin_audit_logs (created_at desc);
create index if not exists admin_audit_logs_actor_date_idx on public.admin_audit_logs (actor_user_id, created_at desc);

create table if not exists public.request_rate_limits (
  scope text not null check (char_length(scope) between 1 and 60),
  key_hash text not null check (key_hash ~ '^[a-f0-9]{64}$'),
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (scope, key_hash, window_start)
);
create index if not exists request_rate_limits_window_idx on public.request_rate_limits (window_start);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = (select auth.uid())
      and role in ('owner', 'admin', 'staff')
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
for each row execute function public.touch_updated_at();
drop trigger if exists service_categories_touch_updated_at on public.service_categories;
create trigger service_categories_touch_updated_at before update on public.service_categories
for each row execute function public.touch_updated_at();
drop trigger if exists services_touch_updated_at on public.services;
create trigger services_touch_updated_at before update on public.services
for each row execute function public.touch_updated_at();
drop trigger if exists applications_touch_updated_at on public.applications;
create trigger applications_touch_updated_at before update on public.applications
for each row execute function public.touch_updated_at();
drop trigger if exists application_documents_touch_updated_at on public.application_documents;
create trigger application_documents_touch_updated_at before update on public.application_documents
for each row execute function public.touch_updated_at();
drop trigger if exists website_settings_touch_updated_at on public.website_settings;
create trigger website_settings_touch_updated_at before update on public.website_settings
for each row execute function public.touch_updated_at();

create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
after insert on auth.users
for each row execute function public.create_profile_for_auth_user();
revoke all on function public.create_profile_for_auth_user() from public;

create or replace function public.audit_user_role_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    insert into public.admin_audit_logs (
      actor_user_id, action, entity_type, entity_id, metadata
    ) values (
      (select auth.uid()), 'user_role.delete', 'user_role', old.id,
      jsonb_build_object('user_id', old.user_id, 'role', old.role)
    );
    return old;
  end if;

  insert into public.admin_audit_logs (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    (select auth.uid()), 'user_role.' || lower(tg_op), 'user_role', new.id,
    jsonb_build_object('user_id', new.user_id, 'role', new.role)
  );
  return new;
end;
$$;
drop trigger if exists user_roles_audit_changes on public.user_roles;
create trigger user_roles_audit_changes
after insert or update or delete on public.user_roles
for each row execute function public.audit_user_role_change();
revoke all on function public.audit_user_role_change() from public;

create or replace function public.consume_request_rate_limit(
  p_scope text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_scope is null or char_length(p_scope) not between 1 and 60
     or p_key_hash is null or p_key_hash !~ '^[a-f0-9]{64}$'
     or p_limit < 1 or p_window_seconds < 1 then
    return false;
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );

  insert into public.request_rate_limits (scope, key_hash, window_start, request_count)
  values (p_scope, p_key_hash, v_window_start, 1)
  on conflict (scope, key_hash, window_start)
  do update set request_count = public.request_rate_limits.request_count + 1
  where public.request_rate_limits.request_count < p_limit
  returning request_count into v_count;

  delete from public.request_rate_limits
  where window_start < now() - interval '2 days';

  return v_count is not null;
end;
$$;
revoke all on function public.consume_request_rate_limit(text, text, integer, integer) from public;
grant execute on function public.consume_request_rate_limit(text, text, integer, integer) to service_role;

create or replace function public.reserve_application_document(
  p_tracking_id text,
  p_mobile_digits text,
  p_file_name text,
  p_storage_path text,
  p_content_type text,
  p_file_size_bytes bigint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application_id uuid;
  v_document_id uuid;
  v_document_count integer;
begin
  select id into v_application_id
  from public.applications
  where tracking_id = p_tracking_id
    and mobile_digits = p_mobile_digits
  for update;

  if v_application_id is null then
    return null;
  end if;

  if p_content_type not in ('application/pdf', 'image/jpeg', 'image/png')
     or p_file_size_bytes not between 1 and 5242880
     or p_file_name is null or char_length(p_file_name) not between 1 and 120
     or p_storage_path !~ ('^' || v_application_id::text || '/[a-f0-9-]{36}\.(pdf|jpg|jpeg|png)$') then
    return null;
  end if;

  select count(*) into v_document_count
  from public.application_documents
  where application_id = v_application_id
    and upload_status in ('pending_upload', 'available');
  if v_document_count >= 5 then
    return null;
  end if;

  insert into public.application_documents (
    application_id, file_name, storage_path, content_type, file_size_bytes, upload_status
  )
  values (
    v_application_id, p_file_name, p_storage_path, p_content_type, p_file_size_bytes, 'pending_upload'
  )
  returning id into v_document_id;
  return v_document_id;
end;
$$;
revoke all on function public.reserve_application_document(text, text, text, text, text, bigint) from public;
grant execute on function public.reserve_application_document(text, text, text, text, text, bigint) to service_role;

create or replace function public.create_customer_application(
  p_tracking_id text,
  p_customer_name text,
  p_mobile_digits text,
  p_email text,
  p_department_id uuid,
  p_service_id uuid,
  p_service_name text,
  p_message text,
  p_consent boolean,
  p_consent_version text,
  p_customer_user_id uuid
)
returns table (application_id uuid, tracking_id text, created_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_department_name text;
  v_application_id uuid;
  v_created_at timestamptz;
begin
  if p_consent is distinct from true then
    raise exception 'Consent is required.';
  end if;
  if p_tracking_id !~ '^BBC-[0-9]{4}-[A-Z0-9]{5}$'
     or char_length(p_customer_name) not between 1 and 100
     or p_mobile_digits !~ '^[0-9]{10,15}$'
     or (p_email is not null and char_length(p_email) > 254)
     or char_length(p_service_name) not between 1 and 160
     or (p_message is not null and char_length(p_message) > 2000)
     or char_length(p_consent_version) not between 1 and 40 then
    raise exception 'Invalid application data.';
  end if;

  select name into v_department_name
  from public.service_categories
  where id = p_department_id and is_published;
  if v_department_name is null then
    raise exception 'The selected department is unavailable.';
  end if;

  if p_service_id is not null and not exists (
    select 1
    from public.services s
    where s.id = p_service_id
      and s.category_id = p_department_id
      and s.is_published
      and s.is_active
  ) then
    raise exception 'The selected service is unavailable for this department.';
  end if;

  insert into public.applications (
    tracking_id, customer_name, mobile_digits, email, customer_user_id,
    department_name_snapshot, service_id, service_name_snapshot, message,
    consent_at, consent_version
  ) values (
    p_tracking_id, p_customer_name, p_mobile_digits, p_email, p_customer_user_id,
    v_department_name, p_service_id, p_service_name, p_message,
    now(), p_consent_version
  )
  returning id, applications.created_at into v_application_id, v_created_at;

  insert into public.application_status_history (application_id, previous_status, new_status)
  values (v_application_id, null, 'received');
  insert into public.admin_audit_logs (action, entity_type, entity_id, metadata)
  values ('application.created', 'application', v_application_id, jsonb_build_object('source', 'customer_form'));

  return query select v_application_id, p_tracking_id, v_created_at;
end;
$$;
revoke all on function public.create_customer_application(text, text, text, text, uuid, uuid, text, text, boolean, text, uuid) from public;
grant execute on function public.create_customer_application(text, text, text, text, uuid, uuid, text, text, boolean, text, uuid) to service_role;

create or replace function public.admin_update_application(
  p_application_id uuid,
  p_actor_user_id uuid,
  p_status public.application_status,
  p_public_remark text,
  p_internal_notes text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application public.applications%rowtype;
begin
  if not exists (
    select 1 from public.user_roles
    where user_id = p_actor_user_id and role in ('owner', 'admin', 'staff')
  ) then
    return false;
  end if;
  if (p_public_remark is not null and char_length(p_public_remark) > 1000)
     or (p_internal_notes is not null and char_length(p_internal_notes) > 3000) then
    return false;
  end if;

  select * into v_application from public.applications where id = p_application_id for update;
  if not found then
    return false;
  end if;

  update public.applications
  set status = p_status,
      public_remark = p_public_remark,
      internal_notes = p_internal_notes,
      updated_at = now()
  where id = p_application_id;

  if v_application.status is distinct from p_status then
    insert into public.application_status_history (
      application_id, previous_status, new_status, changed_by
    ) values (p_application_id, v_application.status, p_status, p_actor_user_id);
  end if;
  if v_application.public_remark is distinct from p_public_remark and p_public_remark is not null then
    insert into public.application_remarks (application_id, author_user_id, body, is_customer_visible)
    values (p_application_id, p_actor_user_id, p_public_remark, true);
  end if;
  if v_application.internal_notes is distinct from p_internal_notes and p_internal_notes is not null then
    insert into public.application_remarks (application_id, author_user_id, body, is_customer_visible)
    values (p_application_id, p_actor_user_id, p_internal_notes, false);
  end if;
  insert into public.admin_audit_logs (actor_user_id, action, entity_type, entity_id, metadata)
  values (
    p_actor_user_id, 'application.updated', 'application', p_application_id,
    jsonb_build_object('status', p_status)
  );
  return true;
end;
$$;
revoke all on function public.admin_update_application(uuid, uuid, public.application_status, text, text) from public;
grant execute on function public.admin_update_application(uuid, uuid, public.application_status, text, text) to service_role;

create or replace function public.admin_update_document_approval(
  p_document_id uuid,
  p_actor_user_id uuid,
  p_approval_status text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_application_id uuid;
begin
  if p_approval_status not in ('pending', 'approved', 'rejected')
     or not exists (
       select 1 from public.user_roles
       where user_id = p_actor_user_id and role in ('owner', 'admin', 'staff')
     ) then
    return false;
  end if;

  update public.application_documents
  set approval_status = p_approval_status
  where id = p_document_id
  returning application_id into v_application_id;
  if v_application_id is null then
    return false;
  end if;

  insert into public.admin_audit_logs (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_actor_user_id, 'application_document.approval_updated', 'application_document',
    p_document_id, jsonb_build_object('application_id', v_application_id, 'approval_status', p_approval_status)
  );
  return true;
end;
$$;
revoke all on function public.admin_update_document_approval(uuid, uuid, text) from public;
grant execute on function public.admin_update_document_approval(uuid, uuid, text) to service_role;

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.application_status_history enable row level security;
alter table public.application_remarks enable row level security;
alter table public.email_notifications enable row level security;
alter table public.website_settings enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.request_rate_limits enable row level security;

drop policy if exists "Admins can read admin allowlist" on public.admin_users;
drop policy if exists "Admins can read applications" on public.applications;
drop policy if exists "Admins can read application documents" on public.application_documents;
drop policy if exists "Admins can access application documents" on storage.objects;

drop policy if exists "Admins can read applications" on public.applications;
create policy "Customers and admins can read applications"
  on public.applications for select
  to authenticated
  using (customer_user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists "Admins can read application documents" on public.application_documents;
create policy "Customers and admins can read document metadata"
  on public.application_documents for select
  to authenticated
  using (
    exists (
      select 1 from public.applications a
      where a.id = application_id
        and (a.customer_user_id = (select auth.uid()) or (select public.is_admin()))
    )
  );

create policy "Users can read own profiles"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "Users can update own profiles"
  on public.profiles for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "Users can read own role assignment"
  on public.user_roles for select
  to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create policy "Admins can read status history"
  on public.application_status_history for select
  to authenticated
  using ((select public.is_admin()));
create policy "Admins can read application remarks"
  on public.application_remarks for select
  to authenticated
  using ((select public.is_admin()));
create policy "Customers can read visible remarks"
  on public.application_remarks for select
  to authenticated
  using (
    is_customer_visible and exists (
      select 1 from public.applications a
      where a.id = application_id and a.customer_user_id = (select auth.uid())
    )
  );
create policy "Admins can read email notifications"
  on public.email_notifications for select
  to authenticated
  using ((select public.is_admin()));
create policy "Public can read public website settings"
  on public.website_settings for select
  to anon, authenticated
  using (is_public or (select public.is_admin()));
create policy "Admins can manage website settings"
  on public.website_settings for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
create policy "Admins can read audit logs"
  on public.admin_audit_logs for select
  to authenticated
  using ((select public.is_admin()));

revoke all on public.profiles, public.user_roles, public.application_status_history,
  public.application_remarks, public.email_notifications, public.website_settings,
  public.admin_audit_logs, public.request_rate_limits from anon, authenticated;

grant select, update on public.profiles to authenticated;
grant select on public.user_roles, public.application_status_history, public.application_remarks,
  public.email_notifications, public.website_settings, public.admin_audit_logs to authenticated;
grant select on public.profiles, public.user_roles, public.application_status_history,
  public.application_remarks, public.email_notifications, public.website_settings,
  public.admin_audit_logs to service_role;
grant all on public.profiles, public.user_roles, public.application_status_history,
  public.application_remarks, public.email_notifications, public.website_settings,
  public.admin_audit_logs, public.request_rate_limits to service_role;
grant all on public.applications, public.application_documents, public.service_categories, public.services to service_role;
grant all on public.website_settings to authenticated;

revoke insert, update, delete on public.applications, public.application_documents from anon, authenticated;
grant select on public.applications, public.application_documents to authenticated;

create policy "Customers and admins access their private application documents"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'application-documents'
    and exists (
      select 1
      from public.application_documents d
      join public.applications a on a.id = d.application_id
      where d.storage_path = name
        and d.upload_status = 'available'
        and (a.customer_user_id = (select auth.uid()) or (select public.is_admin()))
    )
  );

update storage.buckets
set public = false,
    file_size_limit = 5242880,
    allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']
where id = 'application-documents';
