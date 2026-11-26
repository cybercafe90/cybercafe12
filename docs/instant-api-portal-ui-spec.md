# BABA'S CYBER CAFE — Instant API Portal UI Specification

Status: approved design specification; implementation plan only.
Target: draft PR #104, branch `feature/pan-assistance-safe-flow`.
Release boundary: do not merge, apply migrations, enable services, or deploy without explicit owner approval.

## 1. Approved visual direction

### Customer portal
- Theme: deep navy, cyan accents, white/light service surfaces.
- Primary shell: `#0B1329`; accent: `#00E5FF`; white cards; muted blue-grey supporting text.
- Layout: responsive service-card catalogue, grouped by service category.
- Guest-first: no customer account or registration required.
- Mobile-first, low-bandwidth, accessible, clear touch targets and keyboard navigation.

### Admin portal
- Theme: light workspace with white surfaces, pale blue-grey page background, royal/navy text and restrained cyan/blue accents.
- Layout: top navigation, full-width responsive workspace; mobile navigation collapses to an accessible menu.
- Owner-only access using existing Supabase Auth/RBAC. Never expose provider secrets or raw customer identity data in dashboard summaries.

## 2. Customer experience and page structure

1. Header: business identity, service search, order tracking, support/WhatsApp link.
2. Intro: concise explanation of the service journey and secure processing.
3. Search: instant client-side filter by service name/category/keywords; accessible empty state.
4. Catalogue: responsive cards for the eight approved services:
   - Voter Mobile Link
   - Aadhaar to PAN
   - PAN Verification
   - Vehicle RC PDF
   - Mobile Number Details
   - DL HD PDF
   - Vahan to Mobile
   - Voter Status
5. Each card: service name, short plain-language purpose, customer price, required-input summary, estimated processing wording only where verified, and a clear Continue action.
6. Service detail/checkout journey:
   - Explain eligibility, permitted purpose, required fields and document/input format.
   - Show exact customer price before payment.
   - Validate inputs client-side for usability and repeat validation server-side.
   - Show explicit consent and authorized-use declaration before creating an order.
   - Create a guest order with an unguessable retrieval token; do not require account creation.
   - Use the existing Razorpay checkout infrastructure; never trust a client-supplied amount or payment status.
   - Show order reference and status after checkout.
7. Tracking: guest order lookup using order reference plus high-entropy retrieval token; show only minimum necessary status/result information.
8. Result: securely retrieve eligible result, provide safe download for generated PDF, and explain expiry/retention. Do not expose provider URLs or base64 payloads.
9. Support: WhatsApp support link for general assistance; never send Aadhaar, PAN, voter, mobile, RC, DL or DOB data through prefilled WhatsApp messages.
10. Steps/help: concise “Choose service → Enter details → Review price and consent → Pay securely → Track result” guide, FAQs and error recovery guidance.

## 3. Admin portal structure

Top navigation: Overview, Orders, Services & Pricing, API Health, Reconciliation, Audit Logs, Refunds, Settings/Sign out.

### Overview
- Operational counters: orders by status, paid orders awaiting fulfillment, failed/unknown outcomes, refunds pending.
- Revenue and margin figures only from reconciled server-side records; label gross revenue, provider cost, payment fees and net estimates distinctly.
- Recent operational alerts and actions requiring owner attention.
- No fabricated/demo metrics; use honest empty/loading/error states.

### Orders
- Search/filter by internal order reference, service, status and date range.
- Show timestamps, customer amount, payment state, provider state, provider cost and safe error code.
- Detail view must mask personal identifiers by default and require an explicit privileged reveal only if a lawful operational need is established.
- State transitions are server-controlled; UI cannot mark an order paid or fulfilled.
- Unknown provider outcome is a separate state; do not blindly retry a potentially billable provider request.

### Services & Pricing
- Eight-service catalogue with enable/disable control, customer price, provider cost, method/endpoint metadata and authorization-verification status.
- Secret values are never displayed. Show configured/missing status only where safely available server-side.
- Require confirmation and audit entry for price changes, service enablement and authorization changes.
- Keep every service disabled until provider authorization, lawful use, tests and owner approval are complete.

### API Health
- Per-service last checked time, latency, success/failure counts, circuit-breaker/availability state and safe error categories.
- Health checks must not perform billable lookups or send real personal data.
- Never show API keys, authorization headers, full URLs containing query credentials, request/response bodies or PII.

### Reconciliation
- Compare Razorpay order/payment amount and state against internal order state.
- Show provider cost actually deducted from successful provider responses, expected cost separately, refunds and discrepancies.
- Flag duplicate, missing and mismatched payment/provider records for manual review.

### Audit Logs
- Record actor, action, target order/service, timestamp, outcome and correlation ID.
- Never record secrets, payment credentials, raw identity numbers, DOB, full provider payloads or decrypted results.

### Refunds
- Queue and track refund eligibility, request, provider/payment reference, amount, outcome and reconciliation.
- Do not imply automatic refunds unless the server-side Razorpay refund implementation is actually built and verified.
- Prevent duplicate refund attempts through idempotency and server-side state checks.

## 4. Accessibility, responsiveness and performance
- WCAG 2.2 AA target: semantic landmarks, labelled inputs, visible focus, sufficient contrast, keyboard-operable menus/dialogs, non-colour status cues and accessible validation.
- Mobile-first breakpoints; avoid wide tables on phones by using stacked order cards or controlled horizontal overflow.
- Minimize dependencies and images; lazy-load non-critical assets; skeletons must not block interaction.
- Use explicit loading, empty, success, partial, failure and retry states.
- Print-friendly A4 order receipt with business identity, order reference, service, amount, payment reference (masked), timestamps and status. Never print full sensitive lookup values.

## 5. Security and privacy requirements
- All provider calls and Razorpay order creation happen server-side in Supabase Edge Functions.
- Validate service allowlist, input schema, amount, consent, idempotency and authorization server-side.
- Keep all eight provider keys and `INSTANT_API_DATA_ENCRYPTION_KEY` in Supabase Function Secrets only.
- AES-GCM encryption via Web Crypto; versioned key metadata and a documented rotation/recovery procedure are required before retaining production data.
- Hash retrieval tokens for lookup; return raw token only once to the guest client over TLS.
- RLS: owner-only administrative reads; no direct public writes to orders, payments, provider logs or service configuration.
- Rate limit order creation and retrieval; apply abuse controls and generic public errors.
- Do not log PII, secrets, authorization headers, query-string API keys, PDFs or raw provider payloads.
- Define retention/deletion windows and privacy notice before enabling sensitive lookups.
- Verify provider authorization and permitted purpose for each service. The UI must not imply government affiliation or guaranteed correctness.

## 6. Implementation plan for draft PR #104

Phase A — UI foundation
- Inspect current routes, shared components, theme tokens and existing admin portal.
- Add reusable accessible shell, top navigation, cards, status badges, form fields, empty/error states and responsive styles.
- Preserve existing application routes and owner authorization.

Phase B — Customer catalogue and guest journey
- Add customer-facing Instant API landing/catalogue and service detail forms for the eight services.
- Bind displayed catalogue and prices to the server-controlled service catalogue, not duplicated hardcoded frontend pricing.
- Add search, price transparency, steps/help, WhatsApp support and guest tracking UI.
- Keep checkout/result actions unavailable until gateway endpoints are implemented and verified.

Phase C — Admin workspace
- Refactor/extend owner portal into light theme with top navigation.
- Add Overview, Orders, Services & Pricing, API Health, Reconciliation, Audit Logs and Refunds views.
- Wire only to authorized server-side endpoints; never query protected tables directly from public clients.

Phase D — Integration and quality
- Integrate with the existing Razorpay checkout/webhook path; do not create a parallel payment system.
- Implement safe status state machine, idempotency, encrypted storage, retrieval-token flow and provider adapters.
- Add tests for unauthorized access, invalid inputs, price tampering, duplicate requests, webhook signature/amount mismatch, provider timeout/unknown outcome, PII redaction and token expiry.
- Run lint, typecheck, build and security checks; report actual results and remaining blockers.

## 7. Explicit release gates
- Confirm provider authorization and permitted use for each of the eight APIs.
- Confirm the encryption secret is configured (owner has reported it added); verify function runtime can access it without exposing its value.
- Review and apply database migrations only after explicit approval.
- Keep services disabled pending end-to-end tests and owner approval.
- PR #104 remains draft and unmerged. No production deployment is authorized by this specification.
