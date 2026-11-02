# GoDaddy DNS and babacybercafe.in

The domain is registered at GoDaddy; Cloudflare Pages hosting and DNS are separate services. Do not change nameservers until the existing DNS zone has been recorded and mail records can be preserved.

1. In GoDaddy DNS management, export or take a complete record inventory. Record all MX, SPF, DKIM, DMARC, verification and subdomain records used by the business email and other services.
2. Add the custom domain in Cloudflare Pages first. Cloudflare shows the domain-specific DNS instructions and the Pages target for this project. Use those exact values; do not copy a target from another project.
3. If migrating DNS hosting to Cloudflare, add the domain to Cloudflare, import/recreate and verify every existing record (especially mail), then replace the GoDaddy nameservers with the two nameservers Cloudflare assigns to this zone. Keep the GoDaddy domain registration active.
4. If keeping GoDaddy DNS, create the exact records Cloudflare Pages requests for the apex and `www`. If the registrar cannot provide the required apex flattening/ALIAS behavior, use Cloudflare DNS or follow the alternate setup Cloudflare offers. Do not guess static IP addresses.
5. In Cloudflare Pages, verify both hostnames, pick a canonical domain, and enable the redirect for the other hostname. Wait for DNS/HTTPS provisioning and check the certificate before launch.
6. Test `https://babacybercafe.in`, `https://www.babacybercafe.in` (if enabled), `/robots.txt`, `/sitemap.xml`, and direct page refreshes such as `/services/insurance`.
7. Verify inbound/outbound email after DNS changes. Preserve MX, SPF, DKIM and DMARC exactly as required by the existing mailbox and email provider.

DNS propagation timing depends on record TTL and resolver caches. Never remove mail records as a cleanup step. Google Maps embed/directions coordinates are intentionally not configured until the owner provides a verified map URL or coordinates.
