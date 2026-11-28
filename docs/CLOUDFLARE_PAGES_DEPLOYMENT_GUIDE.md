# Cloudflare Pages deployment

1. Connect the GitHub repository to Cloudflare Pages.
2. Select **Vite**; set the build command to `npm run build` and output directory to `dist`.
   The `public/_redirects` file configures SPA fallback for React Router routes.
3. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as production environment variables. These are browser-visible values; never add a service-role key here.
4. Deploy a preview and verify home, insurance, application, tracking, and owner sign-in pages.
5. Add `babacybercafe.in` and `www.babacybercafe.in` as custom domains, then follow Cloudflare's DNS instructions.
6. Configure `SITE_ORIGIN=https://babacybercafe.in` as a Supabase Edge Function secret after the production domain is active.

Keep the Supabase anon key's access controlled by the database RLS policies; an anon key is not a secret.
