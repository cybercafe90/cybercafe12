# Supabase Setup

## Create and link a project

1. Create a Supabase project in the intended region. Keep its database password in a password manager; do not put it in this repository.
2. Copy the project URL and public anon/publishable key into `.env.local` using `.env.example` as the template. These two `VITE_` values are intentionally public.
3. Replace `project_id` in `supabase/config.toml` with the project reference.
4. Install/use the Supabase CLI, authenticate, link, and apply migrations:

```sh
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

Migrations create `profiles`, `user_roles`, `service_categories`, `services`, `applications`, `application_documents`, `application_status_history`, `application_remarks`, `email_notifications`, `website_settings`, `admin_audit_logs` and `request_rate_limits`. They also install indexes, owner helpers, status/audit triggers, RLS and the private `application-documents` bucket.

## Configure auth

- Keep email confirmation enabled. Set the site URL to `https://babacybercafe.in` and add the exact production and local dashboard redirect URLs in Supabase Auth URL Configuration.
- Customer email-link sign-up may remain enabled for the customer dashboard. This does not grant owner access: there is no public admin registration or role-assignment route, and owner roles are provisioned only out of band.
- Configure a verified email provider/SMTP for Supabase Auth OTP links. This is separate from application status email through Resend.
- Use strong password and session policies. Enable MFA for the owner account where available.
- Use the detailed out-of-band provisioning steps in [admin-provisioning.md](admin-provisioning.md).

## Edge Function secrets and deployment

Copy `supabase/.env.example` to an ignored local `supabase/.env`, replace the rate secret with at least 32 cryptographically random bytes, and add Resend values only after the sender domain is verified. Supabase injects the project URL and API keys into the Edge runtime; never expose the service-role key to the browser or Cloudflare Pages.

```sh
npx supabase secrets set --env-file supabase/.env
npx supabase functions deploy create-application
npx supabase functions deploy track-application
npx supabase functions deploy customer-dashboard
npx supabase functions deploy admin-overview
npx supabase functions deploy admin-update-application
npx supabase functions deploy admin-update-settings
npx supabase functions deploy import-services
npx supabase functions deploy notify-customer
```

Review `supabase/config.toml` before deploy; the two public endpoints deliberately disable gateway JWT checks because they perform their own request validation. All owner/customer endpoints require JWTs and perform additional server-side checks.

## Verification before launch

- Confirm RLS is enabled for every public table and no `anon`/`authenticated` policy permits inserting applications or reading another customer's rows.
- In a non-production test project, submit with consent, check the generated reference and verify tracking with both the correct and incorrect mobile numbers.
- Confirm customer remarks exclude `internal` notes and that a document link expires after five minutes.
- Confirm a non-owner JWT receives 403 from each owner function and direct owner-table access is denied.
- Confirm `application-documents` is private and no unauthenticated Storage read policy exists.
- Check the Supabase Auth email-confirmation and OTP links on the deployed hostname.

No live project credentials were supplied with this source package, so remote migrations, auth delivery and RLS behavior have not been exercised here.
