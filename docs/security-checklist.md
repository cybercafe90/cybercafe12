# Launch Security Checklist

- [ ] Apply reviewed migrations to the intended Supabase project; inspect every RLS policy and trigger.
- [ ] Verify `user_roles` contains only the approved owner UUID. Public signup is disabled; no role is assignable in the browser.
- [ ] Confirm an unverified account and a verified non-owner receive no owner data or owner-function access.
- [ ] Confirm anonymous and customer sessions cannot list/search `applications`, remarks, documents, audit events or notification logs.
- [ ] Confirm customer records are linked to a verified user ID only when the submitted email matches that account.
- [ ] Confirm tracking returns a generic mismatch error, rate-limits attempts and never puts personal data in a URL or cache.
- [ ] Confirm all public application submission has explicit consent and server-side validation.
- [ ] Confirm `application-documents` is private, file limits/types are enforced in the function and storage policy, and signed URLs expire quickly.
- [ ] Set `TRACK_RATE_SECRET` and email provider secrets in Supabase only; rotate any credential accidentally exposed.
- [ ] Confirm email logs and UI distinguish sent, failed and not-configured outcomes.
- [ ] Set exact trusted CORS origins for production and remove localhost from production if not needed.
- [ ] Review Supabase Auth URL allowlists, confirmation redirects, password/MFA settings, session duration and abuse protections.
- [ ] Keep customer database backups and define retention/deletion procedures appropriate to the business.
- [ ] Review privacy policy/terms with the business and relevant legal advisor before collecting real customer data.
- [ ] Verify custom-domain HTTPS, redirects, robots/sitemap and preserve all business email DNS records.
- [ ] Test keyboard access, mobile layouts, service search/import, every public route, non-owner rejection, document permissions and email paths in a non-production project.
