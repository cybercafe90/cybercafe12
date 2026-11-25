# Production Security and Release Readiness

This checklist is an operational control document for BABA'S CYBER CAFE. It deliberately distinguishes repository checks from settings that must be verified in GitHub, Cloudflare, Supabase, and payment/email providers.

## Required GitHub repository controls

- [ ] Keep production on `main`; deploy only from the approved production branch.
- [ ] Enable branch protection or a repository ruleset for `main`.
- [ ] Require pull requests; block force pushes and branch deletion.
- [ ] Require the relevant CI checks before merge. Do not make a check required until it has a stable name and is passing.
- [ ] Require an independent human review when another trusted maintainer is available. A solo-owner repository should not create an impossible self-review gate.
- [ ] Enable secret scanning and push protection where available for this repository/plan.
- [ ] Enable Dependabot security updates and review dependency PRs before merging.
- [ ] Limit GitHub Actions permissions to read-only by default; grant write scopes only to the exact job that needs them.
- [ ] Pin third-party Actions to reviewed full commit SHAs before treating the workflow supply chain as hardened.
- [ ] Review installed GitHub Apps, collaborators, deploy keys, personal access tokens, webhooks, and Actions secrets periodically.

## CI and release gates

A production candidate must pass:
1. Dependency installation from the committed lockfile.
2. Dependency vulnerability audit (including production dependencies).
3. ESLint and TypeScript/Vite production build.
4. Playwright desktop and mobile end-to-end suite.
5. Supabase Edge Function unit tests and Deno type checks.
6. Manual smoke tests against the staging project with synthetic data only.
7. A release review of the exact commit SHA and generated deployment artifact.

Cloudflare Pages is connected directly to this repository. Verify its production branch and preview-branch configuration in Cloudflare before merging any workflow or application changes. This repository workflow must not create a second, competing Wrangler deployment.

## Supabase controls to verify

- [ ] Confirm RLS is enabled on every table exposed through the Data API.
- [ ] Verify effective grants and policies for anon, authenticated, and service_role; inspect the final migration state, not only individual migration files.
- [ ] Test owner, authenticated non-owner, and anonymous access for every sensitive table and Storage bucket.
- [ ] Keep service-role and provider secrets exclusively in Supabase Edge Function secrets.
- [ ] Verify every privileged Edge Function validates the JWT/session and owner role server-side before performing owner operations.
- [ ] Add abuse controls to public submission, tracking, grievance, and payment endpoints; do not rely only on browser validation.
- [ ] Keep customer documents in private Storage and issue short-lived signed URLs only after authorization.
- [ ] Confirm database backups and point-in-time recovery/restore procedures, then test a restore to a non-production project.
- [ ] Confirm Auth email templates, redirect allowlists, password policy, and MFA posture. The repository documentation states owner TOTP/MFA is disabled; this is a material account-takeover risk and requires an explicit business decision before production sign-off.

## Payment and personal-data controls

- Treat UTR/SMS evidence as an untrusted payment claim. Mark payments paid only after independent verification or a cryptographically verified provider/bank event.
- Verify Razorpay webhook signatures server-side, enforce idempotency, and never trust browser-supplied payment status or amount.
- Minimize Aadhaar/PAN and other sensitive data collection. Do not store full identity numbers unless a documented lawful need and retention policy exist.
- Define retention/deletion periods, access logging, breach response, and customer privacy notices consistent with applicable Indian data-protection requirements.
- Do not place customer data, credentials, or payment details in logs, analytics events, test fixtures, screenshots, or CI artifacts.

## Known baseline observations (25 November 2026)

- The repository is public. Public source visibility is not itself a secret leak, but all committed source and history are readable.
- The inspected `main` branch was unprotected and had no repository rulesets at the time of inspection.
- The latest inspected `main` workflow run built and linted successfully, but Playwright failed 4 assertions across desktop/mobile. The Edge test and type-check stages were skipped after that failure.
- The failing assertions expected old headings on `/apply` and `/dashboard`. Update tests to reflect the intended current UX only after confirming the rendered page content; do not weaken tests to make CI green.
- The Smart QR preview workflow passed in the inspected run. This does not validate production deployment, live payment processing, merchant isolation, or subscription enforcement.
- The migration history includes multiple changes to owner MFA requirements. Verify the final effective policies and hosted Auth configuration together.
- One existing dependency-audit workflow had `contents: write` and self-modified a dependency lockfile. That is unnecessary for an audit job and should be replaced with a read-only audit; dependency updates should arrive as reviewed PRs.

## Approval and rollback

- No branch merge, production deployment, production database migration, secret rotation, or account-setting change is authorized by this document.
- Before release, present the branch/PR, changed-file summary, CI results, unresolved risks, exact target commit, and rollback plan to the owner.
- Obtain explicit owner approval before merging or deploying.


## Live Supabase diagnostic baseline — 26 November 2026

Read-only checks were run against project `dyzyfugxzsdvboxerbxv`. No live database, Auth, Storage, or Edge Function settings were changed during this review.

### Confirmed controls

- All inspected public application tables have RLS enabled.
- Tables with RLS but no policies are not directly granted to `anon` or `authenticated`; the service-role-only access pattern is intentional for application, grievance, payment, webhook, rate-limit, and security records.
- Owner-facing table policies consistently check the owner role through `private.is_owner()` or an explicit owner-role lookup. UPDATE policies include matching `USING` and `WITH CHECK` predicates.
- Storage buckets `application-documents`, `instant-tp-policies`, and `print-jobs` are private. The document buckets have strict PDF/JPEG/PNG allowlists and file-size limits.
- Public SECURITY DEFINER functions inspected have execution revoked from `anon` and `authenticated`; service-only functions are executable by `service_role`. The private owner helper is executable by authenticated users only.
- Public submission/tracking functions use server-side validation and rate limiting. Razorpay webhook validates the HMAC signature and checks amount/currency before marking payments paid. Bank SMS matching is explicitly a review suggestion and does not auto-confirm payment.

### Findings and remediation

- **High — public instant-TP response minimization:** customer lookup responses previously echoed the registered mobile number and UTR. The security branch now returns neither field; the UI retains the mobile locally and shows a generic payment-reference status. Added a Deno unit test.
- **High — Razorpay webhook retry reliability:** a duplicate event ID was previously acknowledged even if the first attempt had inserted the event row but failed before completing payment processing. The branch now checks the stored `processed` state and retries incomplete events; added a unit test.
- **Medium — print agent request size:** the live print-agent function was not present in repository source control. Its deployed source is now tracked in `supabase/functions/print-agent/index.ts`, and request payloads are capped at 16 KB.
- **Medium — missing FK indexes:** the live advisor identified three uncovered foreign keys on instant-TP payment verification, policy issuance, and audit actor columns. A migration is prepared in `supabase/migrations/20261126100000_add_instant_tp_foreign_key_indexes.sql`; it has not been applied to production.
- **Medium — leaked-password protection:** Supabase Auth reports this setting disabled. Enable it in the Auth security settings after confirming owner sign-in/recovery access.
- **Medium — MFA posture:** Supabase reports insufficient MFA options. Enable an MFA factor and verify owner recovery before enforcing AAL2; do not enable a hard owner-MFA requirement without testing the owner account first.
- **Low / monitor — unused indexes:** the advisor reports 33 unused indexes. The project is new and low-traffic; do not remove indexes based on this snapshot alone. Reassess after meaningful production query volume.
- **CI correction:** the customer portal browser test was asserting an obsolete link label. It now targets the current `Track request` action.

### Not changed in this branch

- Production Supabase Auth settings, secrets, Storage policies, live Edge Function deployments, and production database schema.
- GitHub repository visibility, branch protection/rulesets, secret-scanning settings, and main-branch release state.
- Cloudflare production configuration or production DNS.

These settings require a separate, explicit owner decision or an approved production-change window. The prepared SQL migration must be reviewed and tested on a disposable Supabase branch before production application.
