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

The preview database has the reconciliation schema and `razorpay_plan_id` column. The production database currently contains only the baseline Smart QR tables; do not release until the two additive migrations are reviewed and applied to production.

## Cloudflare Pages secrets

Add these under **Workers & Pages → babacybercafe → Settings → Variables and Secrets**. Add secrets separately for Preview and Production. Never commit them or paste them into chat.

| Name | Type | Purpose |
| --- | --- | --- |
| `RESEND_API_KEY` | Secret | Merchant setup, password reset and notification emails |
| `RAZORPAY_KEY_ID` | Secret | Server-side Razorpay API authentication |
| `RAZORPAY_KEY_SECRET` | Secret | Order and subscription signature verification |
| `SMART_QR_RAZORPAY_WEBHOOK_SECRET` | Secret | Dedicated Smart QR webhook signature verification |
| `SMART_QR_OWNER_BOOTSTRAP_SECRET` | Secret | One-time allowlisted platform-owner bootstrap |
| `SMART_QR_ALLOW_LIVE_PAYMENTS` | Plain text | Set to `true` only in Production after final approval; leave unset/false in Preview |

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

## Owner bootstrap

The only permitted owner email is `support@babacybercafe.in`. Public merchant registration reserves this address. No owner account is created automatically. Once Production secrets, email delivery, payment/webhook configuration and security checks are confirmed, invoke the one-time `POST /api/smart-qr/admin/bootstrap` endpoint with the `x-owner-bootstrap-secret` header and the allowlisted email. The owner then receives a single-use, 30-minute password setup link. Do not invoke bootstrap before release approval.

## QR image delivery

The permanent QR destination is `/s/{slug}`. PNG generation is served through the Smart QR API and currently uses QRServer's image endpoint. Only the approved shop's public destination URL is sent to that provider; no customer profile or private merchant data is sent.

## Current release constraints

- Preview deployment is for review only; the custom production domain is unchanged.
- Preview environment has no Resend or Razorpay secrets configured.
- Live payments are gated off unless `SMART_QR_ALLOW_LIVE_PAYMENTS=true`.
- The production D1 binding and full reconciliation schema must be confirmed before release.
- Recurring subscription authorization, cancellation and lifecycle events are implemented, but live end-to-end billing has not been tested because production credentials/webhook configuration are not yet enabled.
