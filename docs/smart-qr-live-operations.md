# BABA'S SMART QR — Live Operations

This feature is isolated on `feature/smart-qr-live`. Do not merge the older `preview/smart-qr-merchant-platform` branch.

## Cloudflare bindings and database

- Preview Pages environment: `SMART_QR_DB` → `babas-smart-qr-preview`
- Production D1: `babas-smart-qr-production` (not yet bound to the currently deployed production Pages environment)
- Keep the existing `DB` binding unchanged.

Migration order for a fresh D1 database:

1. `migrations/smartqr-live-d1.sql`
2. `migrations/smartqr-reconcile-live.sql`
3. `migrations/smartqr-subscription-plan.sql`
4. `migrations/smartqr-location-analytics.sql`

The preview database has the reconciliation schema, `razorpay_plan_id` column, and location-aware event attribution (`smartqr_events.location_id`). The production database currently contains only the baseline Smart QR tables; do not release until the two additive migrations are reviewed and applied to production.

## Cloudflare Pages secrets

Add these under **Workers & Pages → babacybercafe → Settings → Variables and Secrets**. Add secrets separately for Preview and Production. Never commit them or paste them into chat.

| Name | Type | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | Merchant setup, password reset and notification emails |
| `RAZORPAY_KEY_ID` | Secret | Server-side Razorpay API authentication |
| `RAZORPAY_KEY_SECRET` | Secret | Order and subscription signature verification |
| `SMART_QR_RAZORPAY_WEBHOOK_SECRET` | Secret | Dedicated Smart QR webhook signature verification |
| `SMART_QR_OWNER_BOOTSTRAP_SECRET` | Secret | One-time allowlisted platform-owner bootstrap |
| `SMART_QR_ALLOW_LIVE_PAYMENTS` | Plain text | Keep unset/false by default. For an approved Preview payment test only, set `true` while using Razorpay TEST keys and a TEST webhook secret exclusively. Never put live Razorpay credentials in Preview. Production remains unset/false until a separate release approval. |

The existing live Razorpay functions in Supabase are not modified. Smart QR uses its own Cloudflare Pages API routes and D1 records. Preview billing is intentionally disabled so a live key cannot accidentally charge a test merchant.

## Razorpay webhook

After the Production deployment is approved, create a separate Razorpay webhook pointing to:

`https://babacybercafe.in/api/smart-qr/payments/webhook`

Use the dedicated `SMART_QR_RAZORPAY_WEBHOOK_SECRET`. Subscribe to:

- `payment.authorized`
- `payment.captured`
- `payment.failed`
- `payment.refunded`
- `subscription.authenticated`
- `subscription.activated`
- `subscription.charged`
- `subscription.cancelled`
- `subscription.completed`
- `subscription.halted`
- `subscription.paused`
- `subscription.resumed`

Do not replace or edit the existing BABA'S CYBER CAFE Razorpay webhook.

## Readiness check and owner bootstrap

- Open `/smart-qr/system-check` on the preview deployment to see whether the D1 schema, email secret, Razorpay credentials/webhook secret and owner bootstrap secret are available. The page reports readiness only; it never reveals secret values.
- The only permitted owner email is `support@babacybercafe.in`. Public merchant registration reserves this address. No owner account is created automatically.
- After Preview email delivery is configured and verified, open `/smart-qr/owner-bootstrap`, enter the `SMART_QR_OWNER_BOOTSTRAP_SECRET` value from the Preview environment and request the one-time owner setup email. The endpoint is rate-limited and permits only the allowlisted email. The owner receives a single-use, 30-minute password setup link.
- Do not bootstrap the Production owner or create production accounts until the separate production release is approved.

## QR image delivery

The permanent QR destination is `/s/{slug}`. PNG generation is served through the Smart QR API and currently uses QRServer's image endpoint. Only the approved shop's public destination URL is sent to that provider; no customer profile or private merchant data is sent.

## Preview test and release checklist

1. Add `RESEND_API_KEY` and a dedicated Razorpay TEST key ID, TEST key secret and TEST webhook secret to the Preview environment. Never copy Production secrets into Preview.
2. Confirm `/smart-qr/system-check` reports email, payment and owner-bootstrap configuration as ready. D1 readiness should already pass.
3. Set `SMART_QR_ALLOW_LIVE_PAYMENTS=true` in Preview only while all Razorpay credentials are TEST credentials; this existing gate enables checkout and recurring authorization regardless of credential mode.
4. Configure a separate Razorpay TEST webhook to the current Preview host at `/api/smart-qr/payments/webhook`, using the matching TEST webhook secret and the events listed above.
5. Test merchant registration and setup email, password creation, login, test setup payment, webhook confirmation, owner review, QR download, public scan and analytics. For VIP, create two additional locations and QR codes, verify each QR opens the correct branch details, and confirm events appear against the matching location. Also test a monthly mandate only if the merchant explicitly opted in.
6. Return `SMART_QR_ALLOW_LIVE_PAYMENTS` to unset/false after testing. Production remains untouched.

Preview deployment is for review only; the custom production domain is unchanged. The production D1 binding and full reconciliation schema must be confirmed before any release. Live end-to-end billing and email have not been certified until these tests pass.
