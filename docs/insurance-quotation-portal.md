# Motor Insurance Quotation Workflow

## Customer

- Open `/insurance` and submit vehicle/contact details with explicit consent.
- The `insurance-portal` Edge Function validates the request, rate-limits it and stores it in `insurance_quote_requests`.
- A unique `BABA-…` reference is returned. The customer uses that reference plus the registered mobile number to retrieve quotes.
- Quote results are returned only after the reference/mobile pair matches. Public service catalogue pages do not publish fixed insurance rates.

## Owner

- Open `/insurance/admin` after signing in with the existing owner account.
- The Edge Function verifies the Supabase session and owner role before listing requests or creating quotes.
- Add insurer, product, cover type, premium, IDV, cover summary, add-ons, exclusions and optional HTTPS insurer checkout URL.
- Quote creation updates the request to `quotes_ready` and attempts a customer email through Resend.

## Email

The Edge Function uses the existing Supabase secrets `RESEND_API_KEY`, `EMAIL_FROM` and `BUSINESS_NOTIFICATION_EMAIL`. It records customer confirmation, business alert and quote-ready messages in the private `insurance_email_notifications` table.

If email delivery is unavailable, the request/quote remains saved and the UI shows a warning. Check the notification log and Resend delivery status.

## Safety

A quotation enquiry is not a policy or binding premium. Final premium, eligibility, coverage, exclusions, insurer terms and issuance are subject to insurer confirmation. Customer access requires both reference and registered mobile; owner actions require server-side owner verification.
