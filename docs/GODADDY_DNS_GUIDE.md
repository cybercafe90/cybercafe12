# GoDaddy DNS guide

Add the DNS records Cloudflare Pages displays for the custom domains. Cloudflare's assigned targets can change, so use the current dashboard values rather than copying static IPs from an old guide.

1. In Cloudflare Pages, add `babacybercafe.in` and `www.babacybercafe.in`.
2. At GoDaddy, open DNS management for the domain and add the exact verification and CNAME/A records Cloudflare requests.
3. Remove conflicting records for the same host only after confirming they are not used by email or another service.
4. Keep MX and email-related TXT records intact; changing them can interrupt business email.
5. Wait for DNS propagation and verify HTTPS, the root domain, and `www` before announcing the site.

Do not publish Supabase secrets in DNS, source control, or browser configuration.
