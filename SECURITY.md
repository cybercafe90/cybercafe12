# Security Policy

## Supported deployment

The supported production line is the `main` branch. Feature and preview branches are not production releases.

## Reporting a vulnerability

Please do not publish exploitable details in a public issue or pull request. Send a concise report to **support@babacybercafe.in** with:
- affected URL, component, or file;
- impact and realistic attack scenario;
- safe reproduction steps and relevant timestamps;
- suggested mitigation, if known.

Do not include real customer records, passwords, access tokens, API keys, payment credentials, Aadhaar/PAN data, or other sensitive personal information in a report.

We will acknowledge reports as soon as reasonably possible, investigate, and coordinate a fix before public disclosure where practical.

## Secret handling

- Browser-exposed `VITE_*` values must contain public identifiers only (for example, a Supabase anon/publishable key protected by RLS).
- Supabase service-role keys, database passwords, Resend keys, Razorpay secrets, webhook signing secrets, and bank integration credentials must remain in their server-side secret stores.
- If a credential is suspected to have entered Git history, revoke/rotate it at its issuer immediately. Removing a file or rewriting Git history does not invalidate an exposed credential.
- Never attach production customer data to test reports or CI artifacts.

## Scope

This policy covers the BABA'S CYBER CAFE website source, its GitHub workflows, and security-relevant application code. A passing CI run is not a security certification; hosted Supabase, Cloudflare, payment-provider, email-provider, and account settings require separate verification.
