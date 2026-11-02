grant execute on function public.is_owner() to anon;

create or replace function public.owner_update_application(
  p_actor_id uuid,
  p_application_id uuid,
  p_status text,
  p_customer_remark text default null,
  p_internal_remark text default null
)
returns table (recipient_email text, customer_name text, reference_id text, service_label text, previous_status text, updated_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_application public.applications%rowtype;
begin
  if not exists (select 1 from public.user_roles where user_id = p_actor_id and role = 'owner') then
    raise exception 'Owner authorization required' using errcode = '42501';
  end if;
  if p_status not in ('Application Received', 'Under Review', 'Documents Required', 'Processing', 'Submitted to Department', 'Approved', 'Rejected', 'Completed') then
    raise exception 'Invalid application status' using errcode = '22023';
  end if;
  if p_customer_remark is not null and char_length(p_customer_remark) not between 1 and 1000 then
    raise exception 'Invalid customer remark' using errcode = '22023';
  end if;
  if p_internal_remark is not null and char_length(p_internal_remark) not between 1 and 1000 then
    raise exception 'Invalid internal remark' using errcode = '22023';
  end if;

  select * into current_application from public.applications where id = p_application_id for update;
  if not found then raise exception 'Application not found' using errcode = 'P0002'; end if;

  update public.applications set status = p_status where id = p_application_id;
  if nullif(trim(p_customer_remark), '') is not null then
    insert into public.application_remarks (application_id, author_id, visibility, body)
    values (p_application_id, p_actor_id, 'customer', trim(p_customer_remark));
  end if;
  if nullif(trim(p_internal_remark), '') is not null then
    insert into public.application_remarks (application_id, author_id, visibility, body)
    values (p_application_id, p_actor_id, 'internal', trim(p_internal_remark));
  end if;
  insert into public.admin_audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (p_actor_id, 'update', 'application', p_application_id::text,
    jsonb_build_object('tracking_id', current_application.tracking_id, 'old_status', current_application.status, 'new_status', p_status,
      'customer_remark_added', nullif(trim(p_customer_remark), '') is not null,
      'internal_remark_added', nullif(trim(p_internal_remark), '') is not null));

  return query select current_application.email, current_application.full_name, current_application.tracking_id,
    current_application.service_name, current_application.status, p_status;
end;
$$;
revoke all on function public.owner_update_application(uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.owner_update_application(uuid, uuid, text, text, text) to service_role;
