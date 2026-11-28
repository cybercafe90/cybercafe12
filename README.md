# BABA'S CYBER CAFE

Digital service assistance and insurance facilitation for Srinagar, Jammu & Kashmir.

- Website: <https://babacybercafe.in>
- Email: <support@babacybercafe.in>
- Phone / WhatsApp: [+91 7006865909](https://wa.me/917006865909)
- Facebook: <https://www.facebook.com/share/1cKyxm9dZ/>
- Google Business Profile: <https://share.google/0zqTy0GylWp6CnSYO>

## Platform

This repository contains a React/Vite customer website and a Supabase backend scaffold for service discovery, application submission, private tracking, and owner administration. Public pages never display monetary amounts; contact the team on WhatsApp for service arrangements.

The service catalogue schema is ready for a verified catalogue import. No catalogue file was present when this scaffold was created, so the seed migration intentionally does not invent or publish service records. Insurance categories are starter content and should be checked by the business before launch.

## Source layout

```text
src/
  components/  Shared navigation, footer, notices and page headings
  hooks/       Reusable Supabase-backed data hooks
  lib/         Supabase client and shared validation utilities
  pages/       Home, about, service directories, insurance, contact, legal, application and tracking pages
  design-system.css  Brand tokens, responsive visual system and motion styles
  App.tsx      Route table and application shell
  types.ts     Shared frontend data and status types
supabase/
  migrations/  PostgreSQL schema, RLS and initial categories
  functions/   Application, tracking, document and email Edge Functions
docs/          Setup, deployment and operational guides
```

The app uses React Router with Cloudflare Pages' `public/_redirects` SPA fallback. Tailwind CSS is configured alongside the project's custom responsive design tokens and styles. Route-level pages are lazy-loaded, and scroll reveals, ambient particles, and parallax honor reduced-motion preferences.

## Local development

1. Install Node.js 20 or later and run `npm install`.
2. Copy `.env.example` to `.env.local` and set the Supabase project URL and anon key.
3. Run `npm run dev`.

The public pages render without Supabase configuration. Application submission, tracking, and admin sign-in require a configured Supabase project.
Run `npm run build` to type-check and create the production bundle.

## Supabase setup

1. Apply `supabase/migrations` in timestamp order using the Supabase CLI or SQL editor.
2. Configure `SITE_ORIGIN` and a random `RATE_LIMIT_SECRET` as Edge Function secrets (Supabase provides project URL/API keys to Edge Functions). Never expose service-role keys or the rate-limit secret in the browser.
3. Disable public Auth sign-up, enable strong owner authentication, and provision owner roles in `public.user_roles` as described in [docs/ADMIN_PROVISIONING_GUIDE.md](./docs/ADMIN_PROVISIONING_GUIDE.md).
4. Deploy all four Edge Functions: `process-application`, `verify-tracking`, `application-documents`, and `send-email-notification`.
5. The migrations create the private document bucket, access policies, database-backed upload limits, audit records, and temporary-link workflow. Configure optional email using [docs/EMAIL_CONFIGURATION_GUIDE.md](./docs/EMAIL_CONFIGURATION_GUIDE.md).

Follow the [Supabase backend setup guide](./docs/SUPABASE_BACKEND_SETUP_GUIDE.md) and [deployment guides](./docs) before connecting the production domain.

## Catalogue import

Import only records that have been checked against the relevant department and approved for publication. The schema uses `service_categories` and `services`; keep fees and payment instructions out of public service descriptions. Add verified categories and services in the Supabase dashboard or through a reviewed import process.

## Security notes

- Anonymous clients cannot read or directly mutate applications, roles, audit records, or documents. Application creation and tracking use rate-limited Edge Functions.
- Admin reads are guarded by row-level security and server-verified `user_roles`; public admin registration and role changes are not available.
- The document bucket is private. Uploads are type/signature/size checked, limited per application, and downloads use short-lived signed links after customer or admin authorization.
- Customer document uploads should be limited to necessary supporting documents; do not request passwords, OTPs, or unnecessary sensitive identity information.
- Public service pages must not display prices or claim government affiliation/approval.

Review [docs/SECURITY_TESTING_CHECKLIST.md](./docs/SECURITY_TESTING_CHECKLIST.md) before launch.
