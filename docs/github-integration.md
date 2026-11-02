# GitHub Integration

1. Create a private repository under the business organization/account. Add this repository as `origin` and push the production branch.
2. In GitHub repository Settings → Secrets and variables → Actions, add secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_PAGES_PROJECT`.
3. Add Actions variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. They are public browser configuration; never put service-role or email credentials in GitHub variables.
4. Review `.github/workflows/cloudflare-pages.yml`. It runs on pushes to `main`, performs a clean install, production build and lint, then deploys the static `dist/` output to Cloudflare Pages.
5. Protect `main` with pull requests, required build checks and limited maintainers. Avoid committing customer data, `.env.local`, `supabase/.env`, generated ZIP archives or secrets.
6. Rotate the Cloudflare token and Supabase owner credentials during staff changes. Use separate preview/production Supabase projects if preview deployments will process real data.
