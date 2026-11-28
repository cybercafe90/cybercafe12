# Supabase backend setup

## 1. Apply the database migrations

Review the SQL files in `supabase/migrations` and apply them in timestamp order to the intended Supabase project. With the Supabase CLI:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migrations create the application/catalogue schema, access policies, `user_roles`, consent and audit records, an atomic rate-limit function, document-upload reservations, and the private `application-documents` bucket. Migration `20261101000006_customer_security.sql` migrates existing `admin_users` into the new server-managed `owner` role.

Do not grant direct application/document writes to `anon` or `authenticated`. Customer writes go through the Edge Functions. Do not manually make the document bucket public.

## 2. Configure project authentication

In **Supabase Dashboard → Authentication → Settings**:

- Disable public sign-ups; customers submit requests without an Auth account.
- Enable email confirmation and strong password requirements for invited owner accounts.
- Require MFA for owner/admin accounts where available.
- Invite or create the owner in the dashboard, then add the verified Auth UUID to `public.user_roles` using the trusted SQL procedure in [ADMIN_PROVISIONING_GUIDE.md](./ADMIN_PROVISIONING_GUIDE.md).

Never accept a role or owner identity from the frontend.

## 3. Configure Edge Function secrets

Supabase supplies project URL and API keys to Edge Functions as platform environment values. Configure these additional secrets under **Edge Functions → Secrets**:

- `SITE_ORIGIN`: exact website origin, such as `https://babacybercafe.in` (no trailing slash). Use the local development origin only in a local/staging project.
- `RATE_LIMIT_SECRET`: a randomly generated, private value used to hash client IP addresses before they are stored in the rate-limit table.
- `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL`: optional; required only for email notifications.

Do not put any of these values in `VITE_*` variables or source control. The service-role key must remain server-side.

## 4. Deploy the Edge Functions

Deploy these functions to the same Supabase project:

```sh
supabase functions deploy process-application
supabase functions deploy verify-tracking
supabase functions deploy application-documents
supabase functions deploy send-email-notification
```

`process-application` validates customer data, verifies the published department/service, requires consent, creates a tracking ID, and records the application and audit history. `verify-tracking` returns only public status information after a tracking-ID/mobile match. `application-documents` accepts optional PDF/JPEG/PNG uploads after the same application verification and creates temporary download links after customer or admin authorization. `send-email-notification` is owner/admin-only.

Rate limiting is enforced in PostgreSQL for application creation, tracking attempts, document operations, and admin notifications. It fails closed if the rate-limit secret or database function is unavailable.

## 5. Verify security before launch

Use the [security testing checklist](./SECURITY_TESTING_CHECKLIST.md) against the deployed project. In particular, verify anonymous RLS denial, non-admin denial, document isolation, rate limits, and that signed document links expire. Uploaded documents are not malware-scanned by this project; establish an appropriate review and retention process before production use.

Email provider acceptance is recorded as **accepted**, not delivered. The application is still saved if optional email confirmation fails.
