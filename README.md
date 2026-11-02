# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      # BABA'S CYBER CAFE Service Portal

      Premium, mobile-responsive website and customer service portal for BABA'S CYBER CAFE, Srinagar, Jammu & Kashmir. The frontend is React + TypeScript + Vite; Supabase provides PostgreSQL, Auth, private Storage and Edge Functions. Static assets deploy to Cloudflare Pages.

      ## Current state

      - Public routes: home, about, searchable department/service directory, insurance, enquiry form, tracking, customer dashboard, contact, privacy and terms.
      - Owner routes: secure sign-in, application overview/search/status and remarks, private document uploads, service/category management, CSV imports and website settings.
      - Supabase migrations define the schema, role checks, RLS policies, private Storage bucket, audit history and request throttling.
      - The seeded catalogue uses the service names supplied for this project. It does not claim government authorization, invent official procedures, publish prices, or add unverified official links.
      - Without environment credentials, the catalogue uses its local starter data. Submissions, tracking, customer sign-in and administration are explicitly disabled; the UI does not pretend to save data or send email.

      ## Local development

      Requirements: Node.js 22 LTS (Vite 8 requires a current supported Node release), npm, a Supabase project for backend workflows.

      ```sh
      npm ci
      cp .env.example .env.local
      # Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local.
      npm run dev
      ```

      `npm run build` makes the production bundle in `dist/`. `npm run lint` checks source. `npm run test:e2e` runs the desktop/mobile Playwright smoke tests (install Chromium with `npx playwright install --with-deps chromium` first). With Deno installed, `npm run test:edge` and `npm run check:edge` verify reference generation/mobile normalization and Edge Function types. See [Supabase setup](docs/supabase-setup.md) before enabling customer data collection.

      ## Production setup

      1. Create a Supabase project and complete the migrations and setup in [docs/supabase-setup.md](docs/supabase-setup.md).
      2. Provision the verified owner account using [docs/admin-provisioning.md](docs/admin-provisioning.md). There is no public registration or role selection.
      3. Configure Edge Function secrets and deploy functions. Follow [docs/email-integration.md](docs/email-integration.md) for email setup.
      4. Deploy the static frontend through [docs/cloudflare-pages.md](docs/cloudflare-pages.md), connect GitHub, and follow [docs/godaddy-dns.md](docs/godaddy-dns.md) for the custom domain.
      5. Review the [security checklist](docs/security-checklist.md) and have the privacy/terms copy reviewed for the operating business before launch.

      See [docs/github-integration.md](docs/github-integration.md) for the optional deployment workflow. The sample service CSV is at `public/service-catalogue-template.csv`.
      The relational model and security boundaries are summarized in [docs/database-schema.md](docs/database-schema.md); SQL migrations remain authoritative.

      ## Architecture and security boundaries

      - `VITE_SUPABASE_ANON_KEY` is a public browser key. RLS is the security boundary, not the obscurity of the key.
      - The Supabase service-role key and email credentials are only Edge Function secrets. They must never be copied into Cloudflare frontend variables.
      - Public application creation and tracking run in rate-limited Edge Functions. Tracking requires the reference plus the registered mobile number and returns only approved customer-visible remarks/documents.
      - Customer dashboard requests validate the signed-in, email-verified Supabase user server-side, then query only records linked to that user ID.
      - Owner operations validate the verified user and the server-side `user_roles` owner row. Owner accounts are provisioned out-of-band.
      - Documents use a non-public Storage bucket and five-minute signed links. The owner UI accepts PDF/JPEG/PNG files up to 10 MB.
      - Email delivery is attempted only when Resend secrets are configured; attempts are recorded in `email_notifications` and the customer sees a warning if delivery is unavailable.

      ## Important launch limitation

      No live Supabase project, Cloudflare account, DNS records, admin account or email-provider credentials were supplied here. The project source/build can be checked locally, but remote database policies, real OTP delivery, file permissions, email delivery, DNS and production-domain behavior must be verified after setup. Do not collect real customer data until the migrations are applied and the deployment checks are complete.
  },
