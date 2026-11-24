# BABA'S SMART QR — Preview implementation notes

## Confirmed product decisions
- QR scanner is optional; customers can scan with their normal phone camera.
- QR generation uses the qrcode npm library, high error correction and PNG output.
- Razorpay is the selected subscription provider; test mode only after secure server setup.
- Physical product is a printed QR stand with counter-card and folded-tent proof options.
- Advanced analytics preview includes weekly scans, unique-visitor estimate, action breakdown and payment-button taps.
- Business model is one-time setup plus optional monthly subscription.
- Launch sequence: Srinagar pilot, then all India.

## Preview routes
- /smart-qr/demo — sample customer shop page.
- /smart-qr/merchant-demo — merchant workspace, QR Studio, print proof, plans and analytics.

## Implemented in the preview UI
- Real QR generated in-browser for a stable sample shop URL using qrcode.
- PNG QR download and copyable permanent shop URL.
- Printed stand proof with two styles and browser Print / Save as PDF.
- Interactive sample analytics and plan selector.
- No production database writes, payment requests, real merchant orders or actual scan tracking.

## Razorpay integration design — not activated
1. Browser requests an order from a trusted Supabase Edge Function.
2. Edge Function authenticates the merchant, validates the plan and amount against server-side pricing, and creates a Razorpay order using test credentials held only as server secrets.
3. Browser opens Razorpay Checkout with the returned order details.
4. Server verifies the payment signature; webhook independently verifies the webhook signature against the raw request body and processes event IDs idempotently.
5. Only a verified webhook activates subscription entitlements. Never trust browser success callbacks alone.
6. Never expose Razorpay Key Secret, webhook secret, Supabase service-role key or secret API keys in browser code or Vite environment variables.
7. Live launch requires test transactions, cancellation/refund rules, terms, tax invoice treatment and explicit release approval.

## Analytics privacy
Record event type, shop ID and timestamp initially. Avoid IP addresses, precise location, device fingerprints and unnecessary personal identifiers. A payment-button tap is engagement, not a completed sale. Label unique visitor numbers as estimates unless a privacy-reviewed method is adopted. Set retention and aggregation policies before launch.

## Supabase schema proposal
See supabase/migrations/20261124000000_smart_qr_platform.sql. It is source-only in this branch and has not been applied to any Supabase project. Review policies and Data API exposure before use. Supabase's current platform defaults require explicit review of Data API exposure for new public-schema tables.

## Remaining before production
- Regenerate and commit package-lock after installing qrcode and @types/qrcode with the repo's npm version.
- Run build and lint in CI.
- Implement and test merchant onboarding, owner approval, RLS, Storage buckets and server-side role checks.
- Implement Edge Functions for Razorpay orders, webhook verification, refunds and subscription lifecycle.
- Add real analytics ingestion, retention, aggregation and export.
- Finalise print dimensions, bleed, quiet zone and physical print testing.
- Confirm package prices, delivery charges and customer policies.
- Test QR on Android and iOS devices.
- Obtain explicit approval before any production deployment or Supabase migration.
