# UPI Payment Portal — rollout notes

The UPI portal is designed for the existing BABA'S CYBER CAFE application records. It does not use a payment gateway or claim to receive bank callbacks directly.

## Customer URLs

- Customer payment lookup: `/pay`
- Owner payment dashboard: `/admin/payments` (requires an existing owner Supabase session)

The QR encodes a UPI intent with:
- Payee VPA: `mohammadzamanbaba@okicici`
- Payee name: `BABA CYBER CAFE`
- Amount: exact assigned INR amount
- Note: the application's `BABA-XXXXXXXXXX` tracking ID

The customer can submit a 12-digit UTR, but that submission is only a claim. It never changes the payment to paid.

## Database and Edge Functions

Apply `supabase/migrations/20261106170000_upi_payment_portal.sql` before deploying:
- `payment-customer` — public tracking/mobile lookup, 4-second polling and customer UTR claim
- `admin-payments` — owner-only amount assignment, payment application creation, audit log and manual reconciliation
- `bank-sms-webhook` — API-key protected ICICI credit-alert receiver

The payment tables have RLS enabled and no direct `anon` or `authenticated` grants. All access is through Edge Functions.

## SMS relay configuration

Set a strong, randomly generated secret named `BANK_SMS_WEBHOOK_API_KEY` in Supabase Edge Function secrets. Do not put it in frontend variables, GitHub source, Tasker exports or screenshots.

Webhook endpoint:
`https://dyzyfugxzsdvboxerbxv.supabase.co/functions/v1/bank-sms-webhook`

Send:
- Header: `x-api-key: <the same secret>`
- JSON body: `{"sender":"ICICI-BANK","message":"<bank credit SMS>","timestamp":<Unix seconds>}`

The sender must be `ICICI-BANK` (or `ICICI` / `ICICI BANK`), and the event timestamp must be within ten minutes of receipt. The SMS parser expects an incoming credit, a positive INR amount, a 12-digit UTR/RRN and (for automatic reconciliation) the tracking ID in the UPI note.

## Reconciliation rules

1. Automatic matching requires exact tracking ID, exact amount and a unique 12-digit UTR.
2. Duplicate webhook deliveries are ignored using a SHA-256 message fingerprint.
3. Missing tracking notes, unparseable messages and amount mismatches remain in the admin review queue.
4. Admin manual matching requires the selected application's assigned amount to equal the alert amount and a review note.
5. Customer-entered UTRs are not proof. Confirm manual payments against the bank account/statement.
6. The SMS relay is a trusted device integration, not a bank-signed webhook. Protect the phone, automation app and API key. For stronger proof, use a bank-provided statement feed or verified bank API when available.

## Deployment order

1. Review and merge this feature branch only after CI and code review.
2. Apply the SQL migration.
3. Deploy the three Edge Functions with JWT verification settings from `supabase/config.toml`.
4. Set `BANK_SMS_WEBHOOK_API_KEY` in Supabase secrets.
5. Configure Tasker/SMS relay on the bank-notification phone.
6. Test a small real payment and compare the bank statement, alert, UTR and tracking note before relying on auto reconciliation.

No migration or Edge Function deployment is performed by this feature branch alone.
