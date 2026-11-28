# Owner admin provisioning

1. In **Supabase Dashboard → Authentication → Settings**, disable public sign-ups. Enable email confirmation and configure strong password rules. Require MFA for owner/admin accounts where available.
2. Invite or create the owner's account from **Supabase Dashboard → Authentication → Users** using a verified business email. Use a unique password and do not share credentials.
3. Confirm the account's UUID in the Auth user list. As a trusted project owner, provision only that UUID from the Supabase SQL editor:

   ```sql
   insert into public.user_roles (user_id, role)
   values ('AUTH_USER_UUID', 'owner');
   ```

4. Open `https://babacybercafe.in/#admin` and sign in. RLS and Edge Functions independently verify the server-managed role.
5. To revoke access, delete the matching `user_roles` row and disable the Auth user. Review `admin_audit_logs` after role changes.
6. Never add a role based on a user-supplied email, expose the service-role key, or create a frontend role editor. `user_roles` has no customer-writable policies or grants.

The owner console supports application lifecycle updates and customer-visible/internal remarks. Customer uploads are kept in the private `application-documents` bucket. Administrators can create 60-second temporary download links from the console; do not copy links into logs or long-lived records.

The migration transfers existing `admin_users` entries into the `owner` role. New provisioning must use `user_roles`; the legacy table is not an authorization source after migration.
