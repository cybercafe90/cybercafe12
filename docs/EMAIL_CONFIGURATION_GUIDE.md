# Email configuration

Customer application submission and tracking work without email. Application confirmations and optional owner-triggered status notifications use Resend.

1. Verify a sender domain with Resend and create a restricted API key.
2. Set `RESEND_API_KEY` and `NOTIFICATION_FROM_EMAIL` as Supabase Edge Function secrets. The sender must be verified by the provider.
3. Configure `SITE_ORIGIN` and `RATE_LIMIT_SECRET` as function secrets. Supabase supplies project URL/API keys to Edge Functions. Never expose the service-role key or rate-limit secret to the browser. `SITE_ORIGIN` must match the site origin (for local development, set it to the local Vite origin).
4. Deploy `process-application` and `send-email-notification`.
5. Application confirmation is attempted after a valid submission when an email address is provided and the email secrets are configured. Status updates can be invoked from an authorized owner session with `{ "tracking_id": "BBC-YYYY-XXXXX" }`.

Email provider acceptance is recorded separately from delivery; an accepted request does not confirm delivery. Provider failures are logged and application creation still succeeds. Customers can use the tracking portal or WhatsApp. Avoid including internal notes or sensitive personal information in notifications.
