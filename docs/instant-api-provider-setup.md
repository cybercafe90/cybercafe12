# Instant API provider setup

This integration is intentionally split between the owner catalogue, Supabase Edge Function secrets and a server-side gateway.

## 1. Configure a service endpoint

After the Instant API admin portal has been merged and deployed, sign in with the existing owner account and open:

`https://babacybercafe.in/admin/instant-api`

Select a service and enter:
- Provider name
- HTTPS endpoint URL
- HTTP method (GET or POST)
- Provider cost in INR (leave blank when not confirmed)
- Customer selling price in INR

Save the service. Endpoint URLs are configuration data in the owner-protected `instant_api_services` table. Only the safe public catalogue projection is exposed to visitors.

## 2. Add the API key as a Supabase secret

In Supabase Dashboard, open the project, then **Edge Functions → Secrets**. Add the secret name shown in the owner portal and paste the provider-issued key as its value.

| Service | Supabase secret name |
|---|---|
| Voter Mobile Link | `INSTANT_API_VOTER_MOBILE_LINK_KEY` |
| Aadhaar to PAN | `INSTANT_API_AADHAAR_TO_PAN_KEY` |
| PAN Verification | `INSTANT_API_PAN_VERIFICATION_KEY` |
| Number Details | `INSTANT_API_NUMBER_DETAILS_KEY` |
| Vehicle RC PDF | `INSTANT_API_VEHICLE_RC_PDF_KEY` |
| Vahan to Mobile | `INSTANT_API_VAHAN_TO_MOBILE_KEY` |
| Driving Licence HD PDF | `INSTANT_API_DRIVING_LICENCE_HD_PDF_KEY` |
| Ration Card PDF | `INSTANT_API_RATION_CARD_PDF_KEY` |
| Voter Status | `INSTANT_API_VOTER_STATUS_KEY` |

Never put provider keys in GitHub source, SQL, browser code, `VITE_*` variables, website settings or customer-visible logs. Do not send keys in chat. Rotate any key that has been exposed.

## 3. Do not enable live lookups yet

The admin portal currently stores service configuration only. It does not call providers, create paid orders or fulfil customer requests. Before activation, implement and test the server-side gateway using each provider's actual API documentation, parameter mapping, authentication header/body format, response schema and error behaviour. The gateway must verify a captured Razorpay payment server-side before calling the provider, prevent duplicate fulfilment, rate-limit requests, validate the HTTPS host against an approved provider allowlist, and avoid logging Aadhaar, PAN, voter, phone, vehicle or licence identifiers.

For services involving personal information, verify the provider's authorization and the applicable consent/lawful-purpose workflow before setting the authorization flag or enabling the service.

## 4. Cloudflare

The website remains hosted on Cloudflare Pages. Do not put provider API keys in Cloudflare browser build variables. Provider API requests and provider secrets belong in Supabase Edge Functions. The public frontend should contain only the Supabase project URL and publishable/anon key.
