# Owner Account Provisioning

There is no public registration flow and no frontend role selector. Provision owner access only from the trusted Supabase dashboard/SQL editor after verifying the business owner's identity.

1. Invite the owner's verified email address through Supabase Authentication. Do not share a password or recovery link through chat or source control.
2. MFA/TOTP verification is intentionally disabled by the business request. Compensate with a unique, strong password (at least 12 characters), restricted owner access, and secure mailbox access. Do not add an OTP-code sign-in flow to the website.
3. Confirm that the Auth user is verified. In SQL Editor, check the exact email and copy the matching UUID:

```sql
select id, email, email_confirmed_at
from auth.users
where lower(email) = lower('OWNER_EMAIL');
```

4. If exactly one verified account is returned, grant the owner role using that UUID:

```sql
insert into public.user_roles (user_id, role)
select id, 'owner'
from auth.users
where lower(email) = lower('OWNER_EMAIL')
  and email_confirmed_at is not null
on conflict (user_id, role) do nothing;
```

5. Visit `/admin/login`, sign in with email and password, and verify that the application overview loads. A signed-in account without an `owner` role must be rejected.
6. Keep a second trusted recovery administrator in Supabase's protected account process, not in the website.

To revoke access, remove the role row and revoke the user's Supabase sessions from the Auth dashboard:

```sql
delete from public.user_roles
where user_id = 'VERIFIED_USER_UUID'::uuid
  and role = 'owner';
```

Record who approved provisioning and review `admin_audit_logs` periodically. Never store admin credentials in project environment files, deployment variables, CSVs or support documents.
