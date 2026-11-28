# BABA'S CYBER CAFE — Advanced Transformation Roadmap

## Purpose

Evolve the existing website into a reliable, mobile-first digital service centre. Work in small, reviewable releases. Preserve all working production journeys and deploy only after automated checks and staged verification.

## Existing baseline (8 November 2026)

- Production is served through Cloudflare Pages from the GitHub `main` branch.
- The latest recorded production deployment and main-branch CI workflow completed successfully.
- The repository already includes customer service catalogue, application, tracking, customer hub/chat assistant, owner admin, grievance, investigation, insurance and payment areas; Supabase Edge Functions and Playwright end-to-end tests are present.
- A PWA manifest, offline fallback and privacy-conscious service worker are present in the current main baseline.
- Supabase security advisor currently reports 13 public tables with RLS enabled but no policies, a leaked-password-protection warning, and an MFA-options warning. The MFA warning is not permission to enable MFA: the business requirement is no OTP/MFA. Review table access paths and server-side Edge Function authorization before changing any policies.
- Performance advisor reports unused indexes, multiple permissive policies and one duplicate-index warning. Do not drop indexes or merge policies without query/access-path evidence.
- Admin authentication and the complete real-customer application journey still require live functional verification. CI success is not equivalent to a successful real customer submission or owner login.

## Non-negotiable product and safety requirements

- Keep the black / white / gold BABA'S CYBER CAFE identity and responsive layouts.
- Do not display service prices publicly; direct pricing enquiries to WhatsApp.
- Do not add OTP or MFA flows. Use the agreed owner-only password-based access model.
- No public registration or customer role assignment.
- Do not require customers to upload documents in the public application flow. Admins may securely attach completed documents when needed.
- Preserve Zoho as incoming-mail provider; use Resend only for outgoing transactional email.
- Prefer free/low-cost services and existing integrations.
- Never expose Supabase service-role keys or secrets in frontend code, repository files, logs, or client-visible responses.
- Keep customer documents and private portal routes out of public/offline caches.
- Do not alter DNS, payment processing, or other production settings unless the change is in the approved scope and has been verified.

## Delivery method

For each stage:
1. Inspect the current implementation and data model first.
2. Make changes on a dedicated branch; do not work directly on `main`.
3. Add/update automated unit, Edge Function and Playwright tests.
4. Run dependency audit, lint, production build, browser tests and Edge Function tests/checks.
5. Test against a preview deployment using synthetic data only.
6. Review security and Supabase advisors after database changes.
7. Publish a concise Green / Orange / Red report with evidence, known gaps and rollback plan.
8. Merge and deploy only when the stage's acceptance criteria pass.

## Stages

### Stage 0 — Baseline audit and stabilization
- Inventory every route, form, Edge Function, database table, RLS policy, storage bucket, email path and scheduled workflow.
- Verify live home, catalogue, application, tracking, customer dashboard, grievance, insurance, payment and owner portal routes.
- Verify admin password login, owner-role enforcement and password recovery without adding OTP/MFA.
- Identify and fix confirmed defects before adding new features.
- Acceptance: route inventory complete; no unexplained build failures; baseline smoke tests repeatable; critical security gaps have documented mitigations.

### Stage 1 — Customer-first experience
- Simplify homepage navigation and add clear service-category entry points.
- Improve service search, filters and service detail pages.
- Simplify the application form, field validation and accessible error messages.
- Generate a clear application receipt/reference and show the next steps.
- Improve tracking timeline and customer dashboard with clear statuses and support actions.
- Add save-and-resume only if it can be implemented without unsafe local storage of sensitive data.
- Acceptance: mobile and desktop tests; synthetic application submission; tracking retrieves only the intended record; no customer document upload requirement; no horizontal overflow.

### Stage 2 — Notifications and communication
- Reliable application acknowledgement by email.
- Status-change email notifications through Resend.
- WhatsApp click-to-chat and prefilled enquiry context; do not promise automated WhatsApp delivery without an approved WhatsApp provider.
- Admin notification preferences, delivery logs and retry handling.
- Acceptance: verified test mailbox delivery; idempotent notification handling; no duplicate messages; Zoho incoming mail remains unchanged.

### Stage 3 — Owner admin and staff workflow
- Improve application search, filters, status queues and assignment.
- Add private remarks, status history, audit logs and safe document attachment for staff/admin use.
- Add CSV/Excel export with appropriate access checks and privacy warnings.
- Add service catalogue management and business announcements.
- Add operational summaries and workload reports.
- Acceptance: owner-only authorization tested server-side; no public registration; audit trail for sensitive changes; export and file access tested.

### Stage 4 — Grievance, investigation and insurance
- Improve grievance submission, acknowledgement, status tracking and admin handling.
- Improve investigator assignment and investigation event history.
- Improve insurance quote request intake, lead management and follow-up.
- Keep insurance pricing and quotations private; no public price list.
- Acceptance: each portal's access model verified; records isolated; emails tested; no accidental disclosure between customers.

### Stage 5 — Security, privacy and resilience
- Review all RLS policies against actual browser and Edge Function access patterns.
- Resolve RLS-without-policy findings safely; add least-privilege policies or keep sensitive access exclusively behind verified Edge Functions as appropriate.
- Review storage bucket privacy, signed URLs, rate limits, input validation, CORS and secret handling.
- Review leaked-password protection as a password-security setting separately from OTP/MFA; do not change authentication policy without testing owner access.
- Review duplicate/unused indexes using query evidence before any removal.
- Verify backups, restore procedure, data retention and privacy disclosures.
- Acceptance: no critical/high exploitable findings; least-privilege access tests pass; restore procedure documented; no private customer data in caches or public logs.

### Stage 6 — AI assistant and multilingual help
- Improve the existing assistant with a curated, approved service knowledge base.
- Provide English and Urdu first; add Kashmiri after content review.
- Restrict the assistant to service guidance and safe FAQs; it must not claim government approval, guarantee outcomes, invent fees or collect sensitive documents.
- Provide handoff to WhatsApp/support for uncertain cases.
- Acceptance: tested FAQs, safe fallback, no hallucinated prices or promises, keyboard/mobile accessibility.

### Stage 7 — Growth, analytics and PWA
- Add customer feedback and review collection with moderation.
- Add announcements, service availability and social links.
- Configure privacy-conscious analytics for funnel drop-off and site reliability.
- Improve install prompt, app icons and offline public information while excluding private portal data.
- Acceptance: consent/privacy review, mobile install checks on real devices, analytics verified without capturing sensitive form fields.

## Initial test matrix

- Public route smoke tests: home, services, service detail, apply, track, contact, privacy, terms.
- Restricted route checks: admin login, admin workspace, investigation, grievance admin, insurance admin.
- Responsive checks at narrow mobile, tablet and desktop widths.
- Application flow using synthetic customer data only.
- Tracking authorization and unknown-reference behavior.
- Owner authorization and non-owner rejection.
- Email delivery using an approved test address.
- Edge Function validation, CORS, rate limiting and error handling.
- PWA manifest, service worker update and offline behavior; verify private routes are never cached.

## Current release status

- Baseline CI and Cloudflare production build: passed in the latest recorded run.
- Real-world customer submission, owner login, mobile-device installation and end-to-end email/status lifecycle: not yet confirmed by this baseline audit.
- No schema or production access-policy changes are made by this roadmap commit.
