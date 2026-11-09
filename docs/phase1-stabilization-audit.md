# Phase 1 — Stabilization audit and remediation

**Branch:** `phase1/stabilization-20261109`  
**Base:** `main` at `73b0644d748fa8ef6a7fd44466a275fdd030f771`  
**Scope:** inspection and branch-only preparation. No production deployment, database migration, data mutation, DNS change, or Supabase configuration change is authorized.

## Confirmed repository and platform observations

### GitHub and CI
- The repository has a working Node/TypeScript/Vite build and Playwright, Deno edge-function test/check scripts.
- Existing `.github/workflows/cloudflare-pages.yml` is a CI workflow despite its name; it does not invoke Wrangler deployment. Its push trigger covers only `main` and `feature/upi-dynamic-payment-portal`; PRs targeting `main` are tested.
- A separate dependency audit workflow only pushes on the legacy branch `dependency-audit-review-20261107`, and PRs targeting `main` run it.
- `package.json` already pins `minimatch` to `11.0.1`; do not repeat the override change without a fresh audit.

### Supabase migration history — BLOCKER
- Remote migration history reports 21 applied versions.
- The checked-in `supabase/migrations` directory contains 16 files.
- Several remote versions/names do not exactly match the checked-in migration filenames (for example, the remote has `20261106072346_grievance_management`, `20261106072445_grievance_email_notifications`, `20261106093417_add_missing_foreign_key_indexes`, while these files are not in the current repository listing).
- The repository contains differently timestamped owner-MFA, UPI, insurance, investigation and grants migrations compared with the remote history.
- Do not run `supabase db push`, `apply_migration`, reset, repair, or any migration command against the linked production project until a complete migration-by-migration reconciliation and backup/restore plan are reviewed and separately approved.

### Supabase security
- Supabase security advisor reported RLS-enabled public tables without policies, disabled leaked-password protection, and missing MFA configuration.
- RLS enabled with no policies generally denies API access; this is not proof of public exposure. Confirm actual grants, policies, function execution paths, and intended public/admin access before changing anything.
- Do not add blanket policies. Do not enable MFA or alter password/auth settings without owner workflow compatibility review and separate approval.
- Storage bucket inspection found a private bucket with a 10 MB file-size limit and PDF/JPEG/PNG allowed types. Validate object-level policies and signed URL behavior before changing storage.

### Cloudflare
- Cloudflare Pages project and custom domains were inspected.
- The Pages Git integration and existing workflow are separate mechanisms. Verify production branch, latest production deployment commit, deployment status and preview behavior before any production action.
- This Phase 1 branch workflow intentionally performs checks only and does not deploy.

### Application and notification observations
- Existing service catalogue and notification rows were inspected using aggregate counts only; no customer content or personal records were exported.
- Email delivery status rows are historical indicators, not proof of current provider delivery. Verify with a separately approved controlled test using a dedicated test recipient and non-customer test submission.

## Branch-only changes prepared
1. Add a dedicated CI workflow for this remediation branch and PRs to main. It runs dependency audit, lint, build, Playwright, and Deno tests/type checks; it contains no deploy or database steps.
2. Preserve the detailed findings and gate conditions in this document.

## Phase 1 remediation plan — pending implementation/review
1. Reconcile all 21 remote migration history entries against the 16 repository files and their SQL effects. Produce a signed-off mapping (same, renamed, missing, remote-only, local-only) without changing either side.
2. Inspect every RLS table, policy, role grant, SECURITY DEFINER function, and Edge Function authorization path. Classify each table as public read, public insert, customer-owned, staff-only, owner-only, or internal.
3. Review admin MFA/password posture. Propose a compatible MFA plan; do not enable it until account recovery and owner access are tested.
4. Inspect Cloudflare Pages production branch and deployment commit history; explain any lag between main and production. Do not trigger production deploy.
5. Inspect Resend notification code and delivery event/logging path; propose an isolated test plan. Do not send test mail or customer notifications in this phase.
6. Run branch CI. Fix only low-risk repository/workflow issues that do not require schema, secrets, auth, production settings, or customer data changes.

## Approval gates
Separate explicit approval is required before:
- any Supabase migration, SQL DDL/DML, policy/grant, auth/MFA, storage, or project setting change;
- any Cloudflare production deployment, DNS, environment-variable, or Pages project setting change;
- any Resend email to a real customer or any bulk notification;
- merging this branch into main.

## Rollback
- Branch-only workflow/documentation changes can be reverted by reverting the branch commits or closing the PR.
- No production state has been changed by this phase.


## Latest verification — 9 November 2026

### Confirmed green checks
- GitHub Actions run [42583900046](https://github.com/cybercafe90/cybercafe12/actions/runs/42583900046) completed successfully. All 13 job steps passed: locked install, dependency audits, lint, production build, Playwright browser regression tests, Edge Function unit tests, and Edge Function type checks.
- Cloudflare Pages preview deployment [2cb5f14f](https://2cb5f14f.babacybercafe.pages.dev) completed build and deploy successfully from this branch at commit `c95ac005c4d8ea984bb0500de739ade4584773f2`.
- Cloudflare production's latest observed deployment is still from `main`, commit `30ea0be0f899560bc40364e1bb53dd25ebf8aeef`, deployed 8 November 2026. No production deployment was triggered by Phase 1.
- The latest Supabase health advisor returned no health lint findings.

### Current Supabase security evidence (read-only)
- Security advisor currently reports 13 RLS-enabled tables without policies: `bank_sms_alerts`, `grievance_email_notifications`, `grievance_history`, `grievances`, `insurance_email_notifications`, `insurance_quote_requests`, `insurance_quotes`, `payment_audit_events`, `payment_orders`, `request_rate_limits`, `security_actions`, `security_events`, and `security_investigators`.
- A catalog/grant check found no direct `anon` or `authenticated` table grants on those 13 tables. The separate `application_documents` table does have an authenticated grant and an owner-manage policy; that path still needs end-to-end authorization review.
- The 8 observed SECURITY DEFINER functions in `public` had no EXECUTE privilege for `anon`, `authenticated`, or `PUBLIC` in the privilege check. The private `is_owner` helper was executable by authenticated users only. This reduces direct callable surface but does not replace source review of function bodies and all indirect call paths.
- Security advisor still reports leaked-password protection disabled and insufficient MFA options. Project config shows TOTP enrollment and verification disabled. Do not enable MFA until owner login, recovery, and privileged workflows are tested and approved.
- Performance advisor still reports 4 multiple-permissive-policy warnings, 1 duplicate-index warning, and 28 unused-index notices. Do not drop indexes based only on current usage counters; review workload and query plans first.
- Health advisor currently returned no lint findings.

### Cloudflare preview isolation — release blocker
- The Phase 1 preview build configuration currently points to the production Supabase project. Therefore, preview is suitable for static/build review only. Do not submit applications, grievances, payments, upload documents, change settings, or perform any write-capable journey on this preview.
- A separate non-production Supabase project and isolated test credentials are required before safe end-to-end write testing. No project or production environment settings were changed.

### Supabase platform compatibility note
- Supabase announced removal of four legacy CBC-mode TLS 1.2 cipher suites from project HTTP APIs beginning 10 November 2026 at the earliest. Current browsers and supported OS versions should use TLS 1.2 AEAD suites or TLS 1.3; no code/config change is indicated by the available evidence. See [Supabase notice](https://supabase.com/changelog/cbc-tls-ciphers-deprecated).
- Supabase CLI v3 changed hosted-vs-local command defaults and requires explicit remote targeting for hosted operations. Any future CLI-based reconciliation must pin/check CLI version and follow the v3 migration guidance; no CLI migration command was run in this audit. See [Supabase CLI v3 notice](https://supabase.com/changelog?tags=supabase-server).

### Updated disposition
- **GREEN:** branch CI; branch preview build/deploy; health advisor; no production deployment or database mutation.
- **ORANGE:** code changes are preview-only; current preview is connected to production Supabase and must not be used for write tests; RLS/SECURITY DEFINER paths require source-level review; performance notices require workload review.
- **RED / release blockers:** remote/local migration history is not reconciled; leaked-password protection and MFA posture remain unresolved; no isolated test Supabase project is configured; customer application, tracking, grievance, document, admin and insurance write journeys have not been safely re-tested against an isolated backend; production rollout remains unapproved.

### Next safe actions
1. Complete source-level review of the RLS/SECURITY DEFINER and Edge Function paths without changing production.
2. Produce a full remote-to-local migration mapping and backup/restore checklist; no migration commands until separate approval.
3. Set up a dedicated test Supabase project and separate preview environment before any write-capable tests.
4. Prepare the MFA/password-protection rollout and owner recovery test plan.
5. Verify all WhatsApp references are removed from the branch source and customer-facing copy, then rerun CI after any additional code edits.
6. Expand the service catalogue only with independently verified official source URLs; keep unverified URLs blank and never fabricate government links.
7. Add multilingual support only with complete reviewed English/Urdu/Kashmiri strings, not partial machine-translated UI.


## Expanded release-readiness investigation — 9 November 2026

### Migration drift — exact version inventory
The production database currently reports 21 migration versions. The development branch contains 16 SQL migration files. Only four versions match exactly:
- 202611020001
- 202611020002
- 202611020003
- 20261106113057

Remote versions with no same-version local file:
- 20261106072346 — grievance_management
- 20261106072445 — grievance_email_notifications
- 20261106093417 — add_missing_foreign_key_indexes
- 20261106103208 — create_security_investigation_foundation
- 20261106150825 — require_aal2_for_owner_rls
- 20261106182555 — bank_sms_vault_secret
- 20261106182648 — require_aal2_for_owner_rls
- 20261106182916 — upi_payment_portal
- 20261107031517 — remove_owner_mfa_requirement
- 20261107035806 — add_upi_qr_expiry
- 20261107063158 — motor_insurance_quote_requests
- 20261107063824 — motor_insurance_comparison_quotes
- 20261107083909 — investigation_ip_controls
- 20261107145249 — least_privilege_public_api_grants
- 20261107145337 — insurance_email_notifications
- 20261107145941 — move_owner_helper_to_private_schema
- 20261108143104 — add_missing_payment_foreign_key_indexes

Local-only versions:
- 20261106130000 — require_aal2_for_owner_rls
- 20261106140000 — remove_aal2_owner_rls_requirement
- 20261106170000 — upi_payment_portal
- 20261106230000 — bank_sms_vault_secret
- 20261106231500 — require_aal2_for_owner_rls
- 20261107000100 — public_read_policies_without_owner_helper
- 20261107000200 — remove_owner_mfa_requirement
- 20261107000300 — upi_qr_expiry
- 20261107000400 — investigation_ip_controls
- 20261107150000 — least_privilege_public_api_grants
- 20261107151000 — insurance_email_notifications
- 20261107152000 — move_owner_helper_to_private_schema

Some filenames are clearly semantically related but have different timestamps. Similar names do not prove identical SQL or ordering. The remote list and local directory are not safely reconciled by timestamp-only repair. No repair, push, reset, or migration was run. A remote schema dump and statement-by-statement comparison are still required before any history repair.

### MFA and password controls
- The repository contains multiple migrations that alternately require and remove AAL2 for owner authorization. The final local migration moves the owner helper to the private schema, but the live `private.is_owner()` function currently checks owner role and does not require JWT AAL2.
- The live Security Advisor reports leaked-password protection disabled and insufficient MFA options.
- The Supabase organization is on the Free plan. Supabase documentation says leaked-password protection is available on Pro and above, so that specific control cannot be marked green on the current plan without a plan change.
- No available connected action exposes the project's Auth configuration or enrolls the account owner in TOTP. Enabling an owner-only AAL2 policy before the owner has enrolled and verified a second factor risks locking the owner out. Keep the current production auth configuration unchanged until owner enrollment, recovery, and sign-in are tested on an isolated project.
- The current migration history includes a deliberate removal of owner MFA enforcement. This needs an explicit, tested security decision rather than another blind migration.

### RLS / privileged-function review
- The 13 tables with RLS enabled and no policies have no direct `anon` or `authenticated` table grants in the inspected catalog. They appear intended for service-role Edge Function access. This is not a blanket proof of safety; every function using service-role credentials must continue to perform authorization and input validation.
- The 8 inspected SECURITY DEFINER functions use an empty or restricted search_path. The privilege query found no EXECUTE for `anon`, `authenticated`, or `PUBLIC` on the public helper/RPC functions; the private owner helper is executable by authenticated users only.
- Owner Edge Functions inspected use `auth.getUser(token)` and query the explicit owner role before service-role operations. The application update path passes the verified actor ID into a service-role-only RPC.
- **Code issue found:** `admin-grievances` updates a grievance row and then inserts its history row in a separate request. If the history insert fails, the grievance status may change without a matching history event while the API reports failure. Fix this with one transactional database RPC, then test it on an isolated database before any production migration.
- Public tracking, application, grievance, and payment lookup functions are intentionally JWT-optional and rely on reference/mobile verification and rate limits. Their privacy and abuse controls require adversarial tests on the isolated project before release.

### Test isolation and release
- Supabase organization plan is Free. The only visible organization is the current project organization. Creating a dedicated Supabase branch can incur hourly compute charges; the owner must select the organization and approve any quoted non-zero cost before it is created.
- The existing branch listing contains no healthy isolated development branch; its listed branch status is `MIGRATIONS_FAILED`. Do not use it for write testing.
- Cloudflare preview is configured with the production Supabase URL and publishable key. No write-capable test should be run against it.
- The latest audit-report commit preview build and deploy completed successfully at https://e24373c2.babacybercafe.pages.dev. This is a code/documentation preview only and still points at production Supabase.
- The GitHub CI run previously recorded as 42583900046 passed the full workflow. It predates the latest documentation-only commits; the latest Cloudflare preview independently confirms the new branch commit builds and deploys.

### Service catalogue evidence
- A source-backed shortlist of 23 revenue services and 6 SMC/urban-development service entries has been added to `docs/verified-jk-service-catalogue-research.md`.
- Sources include official District Budgam, District Srinagar, J&K ServicePlus, Srinagar Municipal Corporation, and J&K Housing & Urban Development pages.
- This is research only. It has not been imported into Supabase. Srinagar jurisdiction and each service-to-portal relationship still need final verification before setting `official_url_verified=true`.
- The existing live catalogue has 55 active services and zero active records with a verified official URL. No service records were changed.

### Multilingual UI
- The current application has no shared i18n framework or language dictionaries; most user-facing text is hard-coded in English across the main app and feature pages.
- No complete English/Urdu/Kashmiri translations have been committed. A language selector alone would not constitute a complete translation. This remains pending a full string inventory, translation review, RTL layout testing, and accessibility checks.

### Current release decision
- **GREEN:** code-only branch CI previously passed; latest Cloudflare preview build/deploy succeeded; production database has not been modified; catalogue source research document added.
- **ORANGE:** privileged-function review is partially complete; most direct RLS exposure is constrained by grants, but public lookup flows need isolated adversarial testing; auth MFA setup requires account-owner enrollment and project Auth settings; catalogue shortlist needs Srinagar verification.
- **RED:** production deployment is blocked by unresolved migration drift, missing isolated test backend, incomplete end-to-end customer/admin tests, unfinished translations, the grievance status/history atomicity bug, and unresolved password/MFA controls.
- No production deployment, migration repair, schema change, auth-setting change, customer test submission, or real customer email was performed.
