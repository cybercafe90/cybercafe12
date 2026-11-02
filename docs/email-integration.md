# Email Integration

Application confirmation, status-change, document-availability and business enquiry email are sent from Supabase Edge Functions through Resend. Supabase Auth email-link/OTP delivery is configured separately under Supabase Auth.

1. Create a Resend account and verify the sender domain through the DNS records Resend provides. Do not guess or reuse example SPF/DKIM records.
2. Add the provider's exact records at the active DNS host. Preserve existing MX, SPF, DKIM and DMARC records used by the business mailbox.
3. Create a restricted API key for this project and set the approved sender only after domain verification.
4. Copy `supabase/.env.example` to ignored `supabase/.env`; set `RESEND_API_KEY`, `EMAIL_FROM` and `BUSINESS_NOTIFICATION_EMAIL`. Keep the business notification inbox at `support@babacybercafe.in` unless the owner chooses another verified address.
5. Set Edge secrets and deploy functions as described in [supabase-setup.md](supabase-setup.md).
6. Submit a test enquiry with a mailbox you control, change its status as owner, upload an approved document, and confirm the corresponding customer and business emails. Check `email_notifications` for `sent`, `failed` or `not_configured` results.

No SMTP/API credential is included in this repository. When credentials are missing or a provider rejects a request, the application is still saved where possible and the customer sees that email was not confirmed. Do not claim delivery based on a UI success message alone.
