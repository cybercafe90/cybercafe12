# Instant API provider setup

The Instant API catalogue and provider credentials are separate. The customer-facing website must call a Supabase Edge Function; it must never call the provider directly.

## Eight services and separate Supabase secrets

The eight configured provider credentials are:

| Service | Supabase Edge Function secret | Provider endpoint | Method |
|---|---|---|---|
| Voter Mobile Link | `INSTANT_API_VOTER_MOBILE_LINK_KEY` | `/api/voter-mobile-link.php` | POST |
| Aadhaar to PAN | `INSTANT_API_AADHAAR_TO_PAN_KEY` | `/api/aadhaar-to-pan.php` | GET |
| PAN Verification | `INSTANT_API_PAN_VERIFICATION_KEY` | `/api/pan-verification.php` | GET |
| Mobile Number Details | `INSTANT_API_NUMBER_DETAILS_KEY` | `/api/number-details.php` | GET |
| Vehicle RC PDF | `INSTANT_API_VEHICLE_RC_PDF_KEY` | `/api/rc-pdf.php` | GET |
| Vahan to Mobile | `INSTANT_API_VAHAN_TO_MOBILE_KEY` | `/api/vahan-to-mobile.php` | GET |
| DL HD PDF | `INSTANT_API_DRIVING_LICENCE_HD_PDF_KEY` | `/api/dl-hd-pdf.php` | GET |
| Voter Status | `INSTANT_API_VOTER_STATUS_KEY` | `/api/voter-status.php` | GET |

Provider host: `https://api.smmtopserver.shop`.

All eight secrets are independent. The API key must be read with `Deno.env.get()` inside the server-side Edge Function only. For Voter Mobile Link, Aadhaar to PAN and Mobile Number Details, the provider specification uses an `api_key` form/query parameter. For PAN Verification, Vehicle RC PDF, Vahan to Mobile, DL HD PDF and Voter Status, the provider specification uses a Bearer Authorization header. Do not place a key in a URL that can be logged; construct and redact provider requests carefully.

Open [Supabase Edge Function Secrets](https://supabase.com/dashboard/project/dyzyfugxzsdvboxerbxv/functions/secrets) to manage values. Never paste secret values into GitHub, SQL, browser code, `VITE_*` variables, support messages or chat. Do not send secret values to anyone. Rotate any key that has been exposed.

## Current catalogue prices

| Service | Customer price | Provider cost reference |
|---|---:|---:|
| Voter Mobile Link | ₹80 | ₹13 |
| Aadhaar to PAN | ₹50 | ₹10 observed in sample response; earlier quote was ₹9 |
| PAN Verification | ₹60 | ₹10 |
| Mobile Number Details | ₹70 | ₹7 observed in sample response; earlier quote was ₹6 |
| Vehicle RC PDF | ₹90 | ₹10 |
| Vahan to Mobile | ₹150 | ₹10 |
| DL HD PDF | ₹50 | ₹7 |
| Voter Status | ₹40 | ₹5 |

The owner portal must retain editable provider costs and customer prices. Reconcile actual provider `cost_deducted` from successful responses; quoted cost is not proof of actual deduction. Gross margin excludes payment fees, taxes, refunds and operating costs.

## Payment and fulfilment safety requirements

The existing Razorpay integration is shared by other website services. Extend it carefully; do not create a second independent Razorpay credential or webhook flow. The server must verify captured payment status and amount with Razorpay before a provider request. A browser callback alone is not proof of payment.

Enforce one provider fulfilment per paid order using a database state transition / unique idempotency key. If a provider request times out after it may have charged, mark the order as `fulfillment_unknown` and reconcile it; do not blindly retry. If payment is captured but the service definitively fails, initiate an idempotent refund or create a visible owner refund task. Do not silently keep payment without delivering the service.

Validate all inputs server-side. Restrict requests to the fixed provider host and the eight documented paths. Apply rate limits and a 30-second upstream timeout. Return only necessary result fields. Proxy PDF results through the backend; never expose provider URLs or base64 documents in logs.

Never log raw Aadhaar, PAN, EPIC, mobile, vehicle registration, driving licence number, date of birth, address, full upstream payload, PDF data or API keys. Store only the minimum data required, encrypt retained lookup inputs/results, hash any retrieval token and expire result access. Do not put personal data in query strings, analytics or URLs.

## Authorization and consent

All services remain disabled by default. Before enabling a service, verify provider authorization, the intended lawful purpose, explicit user consent, and applicable DPDP Act obligations. Do not enable lookup of personal information merely because an API key exists.

## Deployment boundary

This PR is a draft. Its SQL migration is not applied to production, its Edge Function is not deployed, and customer lookups are not live. After code review, CI, sandbox payment tests, provider test calls and owner approval, the migration and function can be deployed as a separate controlled release. Provider secrets stay in Supabase Edge Function Secrets; they do not belong in Cloudflare Pages build variables.
