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
