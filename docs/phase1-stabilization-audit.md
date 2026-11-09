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
