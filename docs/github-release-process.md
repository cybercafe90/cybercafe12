# GitHub Release Process

1. Create a focused feature or fix branch from the latest `main`.
2. Keep each change scoped; do not commit secrets, customer data, generated build output, or local environment files.
3. Open a pull request into `main`. Keep it unmerged until owner approval.
4. Review the diff, dependency changes, workflow permissions, and any Supabase migration/Edge Function impact.
5. Wait for required checks: dependency audit, lint, production build, desktop/mobile Playwright, Edge Function tests, Deno checks, and CodeQL.
6. Test the candidate on a non-production Cloudflare preview and non-production Supabase project using synthetic data.
7. Record the exact commit SHA, deployment target, migration plan, and rollback plan.
8. Obtain explicit owner approval before merging or deploying.
9. After approval, merge using the repository's protected-branch policy. Verify the Cloudflare production deployment and smoke-test public and owner-only flows.
10. If verification fails, stop further releases and execute the documented rollback. Never run a destructive production migration as an unreviewed hotfix.

Cloudflare Pages is connected to GitHub. Do not add a second deployment mechanism unless the owner explicitly approves a change to the deployment architecture.
