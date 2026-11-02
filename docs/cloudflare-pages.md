# Cloudflare Pages Deployment

## Connect the repository

1. Push this project to a private GitHub repository owned by the business.
2. In Cloudflare, create a Pages project and connect the repository/production branch.
3. Set Node.js to 22 LTS, build command to `npm ci && npm run build`, and build output directory to `dist`. The `public/_redirects` file routes direct SPA paths to `index.html`.
4. Add these production and preview build variables in Pages settings:
   - `VITE_SUPABASE_URL`: the Supabase project URL.
   - `VITE_SUPABASE_ANON_KEY`: the public anon/publishable key.
5. Do not set `SUPABASE_SERVICE_ROLE_KEY`, database passwords, Resend keys or other private credentials in Pages. Backend secrets belong only in Supabase Edge Function secrets.
6. Deploy once and test the home page and direct navigation to `/services/insurance`, `/track`, `/dashboard` and `/admin/login`.

## Custom domain

Add `babacybercafe.in` and, if desired, `www.babacybercafe.in` under the Cloudflare Pages project's Custom Domains. Follow the records Cloudflare displays for the specific Pages project. Configure one canonical hostname and redirect the alternate hostname to it. Verify HTTPS and renewal before promoting the domain.

For GoDaddy-registered domains, see [godaddy-dns.md](godaddy-dns.md). Preserve all business email DNS records during any DNS migration.

## GitHub Actions option

An optional workflow is in `.github/workflows/cloudflare-pages.yml`. Add `CLOUDFLARE_API_TOKEN` (Pages edit permission), `CLOUDFLARE_ACCOUNT_ID`, and `CLOUDFLARE_PAGES_PROJECT` as GitHub Actions secrets. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Actions variables. The workflow deploys only the `main` branch after build/lint checks. Rotate the deploy token if a maintainer leaves.
