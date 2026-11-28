# BABA'S CYBER CAFE — Production Audit

**Audit date:** 28 November 2026  
**Scope:** GitHub main, Cloudflare Pages/DNS/TLS, Supabase schema/RLS/storage/Edge Functions, payment and provider gateways.  
**Change boundary:** All code changes in this review are on `audit/security-review-2026-11-28`. No production database, Supabase Auth setting, Cloudflare setting, DNS record, payment setting, or production deployment was changed.

## Executive status

- GitHub main and the audit branch started from the same commit: `f59541b1a4e75bdcdfdf89782092d82a56fa4097`.
- The production Pages deployment for that commit completed successfully.
- The audit branch already had a successful Pages preview deployment before this review's new commits.
- The Supabase project is `ACTIVE_HEALTHY`, PostgreSQL 17.
- All inspected public tables have RLS enabled.
- All three Storage buckets are private.
- No customer row contents or secrets were read as part of the database metadata review.
- The public-site HTML routes could not be fetched by the available browser retrieval service, so route-by-route live UI validation remains pending.

## Confirmed strengths

1. Sensitive application, grievance, payment, insurance, audit, and security tables with no RLS policies have no `anon` or `authenticated` table grants; they are restricted to backend roles. The Supabase advisor's 15 `rls_enabled_no_policy` findings are therefore not, by themselves, evidence of public exposure.
2. Owner data policies use `private.is_owner()`; the helper is SECURITY DEFINER with an empty search path. The rate-limit RPC is also SECURITY DEFINER with an empty search path and is executable only by `service_role`.
3. `instant_api_orders` has owner-only authenticated read access. Public users do not receive direct table grants.
4. Storage buckets `application-documents`, `instant-tp-policies`, and `print-jobs` are all private, with size and MIME restrictions. The application-documents bucket has owner-only object policies.
5. The inspected instant API gateway validates input, restricts the upstream host, blocks redirects, bounds response size, encrypts stored request/result data, rate-limits public actions, uses order/retrieval tokens, and checks Razorpay capture/amount/currency before fulfillment or refund.
6. The Razorpay webhook verifies the HMAC signature over the raw request body, deduplicates event IDs, and checks order amount/currency before marking payment records paid.
7. The API Express gateway is deployed with JWT verification enabled, verifies the authenticated user and role server-side, keeps the provider key in Edge Function secrets, and applies per-user and monthly usage checks.
8. Cloudflare has active custom domains for the apex and www hostnames. HTTPS redirect and automatic HTTPS rewrites are enabled; TLS minimum is 1.2. SPF, Zoho MX/DKIM, Resend DKIM, and a DMARC quarantine record are present in DNS.

## Findings requiring attention

### High priority — production configuration

- **Cloudflare SSL mode is `Full`, not `Full (strict)`.** Strict mode should be enabled after confirming the Pages origin certificate is valid for the configured origin. This is a live Cloudflare setting and was not changed.
- **HSTS is disabled and `nosniff` is false** in Cloudflare's security-header setting. Enable HSTS with a staged max-age after confirming HTTPS coverage for every included subdomain; enable `X-Content-Type-Options: nosniff`. This is a live Cloudflare setting and was not changed.
- **Supabase leaked-password protection is disabled.** Enable it in Supabase Auth password security settings.
- **Supabase TOTP MFA enrollment and verification are disabled.** This matches the repository's current configuration and earlier owner preference, but it weakens owner-account protection. The owner must explicitly decide whether to enable TOTP or another second factor; this audit did not override that preference.
- **The main branch is not protected and has no required status checks.** Require successful build, dependency, E2E, and Edge Function checks before merging to main.

### Medium priority — source and runtime consistency

- **API Express source drift:** `api-express-gateway` was active in Supabase but absent from the repository's `supabase/functions` tree and local function config. The deployed source has now been copied into the audit branch and `verify_jwt = true` has been recorded in `supabase/config.toml`. This is a source-control repair only; it does not redeploy the function.
- **Investigation endpoints remain active in Supabase:** `investigation-manage-investigator`, `investigation-update-event`, `investigation-ip-control`, and `investigation-overview` were still ACTIVE, although the current repository no longer contains these functions and the portal is retired. Confirm they have no remaining callers, then disable/delete them through a separately approved production cleanup.
- **API Express monthly quota is count-then-call rather than an atomic reservation.** Concurrent requests may race past the configured free-call cap. Use a database-side atomic quota reservation before upstream requests if the 1,000-call ceiling must be a hard limit.
- **API Express advertises admin/agent-only branches, but `user_roles.role` currently has a database check constraint permitting only `owner`.** Those extra role paths cannot be assigned through the current schema. Keep the system owner-only unless multi-role access is intentionally approved; if it is, add constrained roles and matching RLS/authorization tests as a separate change.
- **Instant TP audit events previously duplicated the complete UTR.** The audit branch now stores only the final four digits in audit metadata. The primary application record continues to hold the UTR for owner verification; the customer-facing matched lookup continues to show the submitted UTR to that customer.

### Low priority — performance and operational hygiene

- Supabase reported three unindexed foreign keys in the Instant TP application/audit tables. Add indexes after reviewing query plans and expected write volume.
- Supabase reported 36 currently unused indexes. Do not bulk-delete them: several may be intended for future or infrequent owner workflows. Review usage over a representative operating period first.
- Cloudflare's security level is currently Medium. Review WAF/bot settings against real customer traffic before increasing challenge friction.
- Two proxied wildcard A records for `*.babacybercafe.in` point to Vercel IP addresses while the apex and www domains use Cloudflare Pages. Confirm whether any wildcard subdomains are intentionally hosted on Vercel before changing them; do not remove them blindly.
- The site uses React 19, TypeScript, Vite, and React Router (not Next.js). The Pages project is GitHub-connected to `main`, with preview deployments enabled for all branches.

## Changes made on the audit branch

1. Added the currently deployed `api-express-gateway` source to `supabase/functions/api-express-gateway/index.ts`.
2. Recorded the function's `verify_jwt = true` setting in `supabase/config.toml`.
3. Redacted full UTR values from Instant TP audit event metadata (last four digits only).
4. Updated the security verification workflow to run on this audit branch, support manual dispatch, install Chromium, and run lint, build, browser E2E, Edge Function tests, and Edge Function type checks.
5. Updated the dependency audit workflow to run on this audit branch as well.

## Validation still required

- Wait for the new audit-branch GitHub Actions runs and confirm every check passes.
- Confirm the updated audit branch receives a successful Cloudflare Pages preview deployment.
- Run interactive desktop/mobile checks against the preview URL for home, service search, Instant API, RC PDF, tracking, payment, grievance, print, insurance, and owner login.
- Perform non-production test transactions for successful payment, failed provider request, timeout/reconciliation, refund pending, and duplicate webhook delivery.
- Verify API Express secrets and provider credentials exist in Supabase without exposing their values; test one sandbox request and confirm cache/quota behavior.
- Confirm no remaining callers before retiring the four stale Investigation Edge Functions.
- Apply approved production configuration changes only after owner confirmation and a rollback plan.

## Production safety

No production changes were made by this audit. The report and code fixes are staged only on the audit branch. Do not merge or deploy this branch until its checks pass and the owner approves the production-only security settings and cleanup.


### API Express database dependency verification

A read-only inspection of project `dyzyfugxzsdvboxerbxv` on 2026-11-28 found that neither `public.api_express_logs` nor `public.api_express_cache` resolves in the connected production database, although the deployed `api-express-gateway` source reads/writes both tables. This is a deployment/schema drift risk: the gateway's logging/cache path can fail before returning a normal result. The audit branch now includes an idempotent migration to provision both backend-only tables and an atomic quota-counter table/RPC. This migration has NOT been applied to production.

The gateway source now reserves quota through the database RPC before making an upstream call. The reservation transaction locks the monthly global counter and per-user minute counter, preventing concurrent requests from passing the same remaining quota. Reservations are intentionally conservative: a request that times out after reservation still consumes one reserved provider attempt because the provider may have received it.
