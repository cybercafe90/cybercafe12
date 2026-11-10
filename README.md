# BABA'S CYBER CAFE

Premium black, white and gold customer service portal for BABA'S CYBER CAFE, Srinagar, Jammu & Kashmir.

**Production website:** https://babacybercafe.in  
**Support:** support@babacybercafe.in · **WhatsApp:** +91 7006865909

## Technology

- React, TypeScript and Vite
- Supabase PostgreSQL, Auth, private Storage and Edge Functions
- Cloudflare Pages for static hosting
- Resend for outgoing transactional email
- Zoho Mail remains the incoming-mail provider

## Customer features

- Searchable public service directory and featured service listings
- Online service application and unique tracking reference
- Customer tracking and dashboard
- Public grievance submission and tracking
- Motor insurance quotation request and quote lookup at `/insurance`
- UPI payment lookup, QR/UPI intent and UTR claim submission
- WhatsApp and direct contact links

The customer application form does not accept file uploads. The owner portal can upload approved customer documents to private Storage; customer-visible files are shared only through short-lived signed links when the application status permits it.

## Owner portals

- `/admin/login` — owner application dashboard, status/remarks, service/category editing, CSV import, website settings and document sharing
- `/admin/payments` — payment amount assignment and manual bank-statement reconciliation
- `/insurance/admin` — owner-only insurance enquiry review and quote creation
- `/grievance/admin` — grievance review and status/remarks

Owner actions are checked server-side against the Supabase session and `user_roles`. There is no public registration or browser role assignment.

## Email and payment boundaries

- Application and grievance confirmation/business notifications have been tested with Resend delivery.
- Insurance quotation requests and quote-ready notifications use the same Resend secrets and write to the private `insurance_email_notifications` log.
- Resend handles outgoing mail. Preserve Zoho MX records for incoming mail.
- Customer UTR entry is a payment claim, not proof of payment. The owner must verify the credit against the bank statement before marking it paid.
- Android SMS forwarding is an untrusted matching signal. It does not automatically mark a payment paid. Unattended confirmation requires an official signed bank/payment-provider webhook or independently verifiable bank feed.

## Authentication

The website uses email-and-password sign-in for the owner. TOTP/MFA and code-entry verification have been disabled by business request. Password recovery is intended to use a single-use email link, not a numeric OTP code. The hosted Supabase Auth email templates and security settings must match the repository configuration before the link-only flow can be considered fully verified.

## Local development

Requirements: Node.js 22 or later and npm.

```sh
npm ci
cp .env.example .env.local
# Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.
npm run dev
```

Useful checks:

```sh
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run test:e2e
npm run test:edge
npm run check:edge
```

## Supabase setup and secrets

Follow [Supabase setup](docs/supabase-setup.md), [owner provisioning](docs/admin-provisioning.md), [email integration](docs/email-integration.md), and [password recovery](docs/ADMIN-PASSWORD-RECOVERY.md).

Frontend-only Cloudflare Pages variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Private Supabase Edge Function secrets:
- `RESEND_API_KEY`
- `EMAIL_FROM`
- `BUSINESS_NOTIFICATION_EMAIL`
- `TRACK_RATE_SECRET`
- `BANK_SMS_WEBHOOK_API_KEY` (only if the owner configures a trusted private relay)

Never put the Supabase service-role key, Resend API key, database password or bank webhook secret in browser code, GitHub files or Cloudflare frontend variables.

## Deployment and verification

Cloudflare Pages is connected to the GitHub repository and deploys the production `main` branch. Pull requests run lint, build and desktop/mobile Playwright checks.

The website is live, and application/grievance email paths have passed real delivery tests. The insurance quote UI/function, hosted Auth template synchronization, owner/non-owner access tests, mobile route audit and final security sign-off must pass before describing every feature as production-ready.

See [Cloudflare Pages](docs/cloudflare-pages.md), [insurance quotation workflow](docs/insurance-quotation-portal.md), [UPI payment portal](docs/upi-payment-portal.md), and [security checklist](docs/security-checklist.md).
