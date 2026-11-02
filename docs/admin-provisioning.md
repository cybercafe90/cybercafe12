# Owner Account Provisioning

There is no public registration flow and no frontend role selector. Provision owner access only from the trusted Supabase dashboard/SQL editor after verifying the business owner's identity.

1. In Supabase Authentication, invite the owner's named email address. Require inbox verification and configure MFA. Do not share a password through chat or source control.
2. Confirm that the Auth user is verified. In SQL Editor, check the exact email and copy the matching UUID:

```sql
select id, email, email_confirmed_at
from auth.users
where lower(email) = lower('OWNER_EMAIL');
```

3. If exactly one verified account is returned, grant the owner role using that UUID:

```sql
insert into public.user_roles (user_id, role)
select id, 'owner'
from auth.users
where lower(email) = lower('OWNER_EMAIL')
  and email_confirmed_at is not null
on conflict (user_id, role) do nothing;
```

4. Visit `/admin/login`, sign in, and verify that the application overview loads. A signed-in account without an `owner` role must be rejected.
5. Keep a second trusted recovery administrator in Supabase's protected account process, not in the website.

To revoke access, remove the role row and revoke the user's Supabase sessions from the Auth dashboard:

```sql
delete from public.user_roles
where user_id = 'VERIFIED_USER_UUID'::uuid
  and role = 'owner';
```

Record who approved provisioning and review `admin_audit_logs` periodically. Never store admin credentials in project environment files, deployment variables, CSVs or support documents.
