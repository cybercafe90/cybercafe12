# BABA'S SMART QR — Implementation Plan

Business: BABA'S CYBER CAFE, Srinagar, Jammu & Kashmir  
Model: One-time setup + optional subscription; digital QR + optional printed counter stand  
Rollout: Srinagar pilot, then all India  
Status: Preview-only branch. No live merchant data, payments or production changes.

## Product promise
One shop-specific QR opens a mobile-first digital shop page with merchant-approved contact links, catalogue, offers, directions, review link and the merchant's own payment destination.

## Customer experience
- Branded merchant page with shop name, logo, category and accurate verification status.
- Main actions: Pay Shop, WhatsApp, Catalogue, Directions, Review and Contact.
- Searchable catalogue, product categories, descriptions and optional prices.
- Offers, announcements, opening hours, map pin, social links, save/share options.
- “Powered by BABA'S CYBER CAFE” attribution.
- Stable URL pattern: https://babacybercafe.in/shop/{slug}. QR points to this URL, not changeable merchant details.

## Proposed packages (test-price hypotheses; approval required)
- Starter: ₹499 one-time.
- Professional: ₹999 one-time.
- VIP Business: ₹1,999 one-time.
- Optional support/maintenance: ₹99–₹199/month.
- Printed stand, stickers, delivery and replacement quoted separately.
These are proposed test prices, not validated market rates. Confirm production cost, GST treatment, support scope, terms and refunds before publishing.

## Delivery phases
1. Design preview: customer page, product landing page, registration flow, shopkeeper dashboard, owner dashboard and print-stand proof. No backend writes.
2. Core platform: Supabase schema, RLS, merchant approval lifecycle, unique slug, secure image storage, QR generation and public shop route.
3. Merchant controls: secure shopkeeper login, profile editor, catalogue, offers, payment/contact links, QR download and print-ready PDF.
4. Owner controls: owner-only approval, verification, suspension, plan assignment, support and audit trail.
5. Analytics/subscriptions: privacy-conscious scan counts, entitlements, renewal reminders and authorised payment-provider integration if approved.
6. Pilot: 10 Srinagar merchants; verify ownership, phone, UPI destination, map pin and review URL; test printed QR on Android/iOS.
7. Launch: policies, monitoring, backups, support workflow and explicit production release approval.

## Suggested data model
- smartqr_shops: id, owner_user_id, slug, shop_name, category, description, logo_path, public_status, approval_status, address_text, map_url, phone, whatsapp, review_url, social_links, opening_hours, created_at, updated_at.
- smartqr_products: id, shop_id, name, description, category, image_path, display_price (optional), is_available, sort_order.
- smartqr_offers: id, shop_id, title, description, start_at, end_at, is_active.
- smartqr_subscriptions: id, shop_id, plan_code, status, start_at, end_at, provider_reference.
- smartqr_scan_events: id, shop_id, scanned_at, coarse_device_class (optional); avoid precise location and unnecessary identifiers.
- smartqr_audit_log: id, actor_user_id, shop_id, action, created_at.

## Security and trust
- No public role assignment; privileges are granted only by trusted server-side owner processes.
- RLS on every merchant-owned table; shop owners edit only their own records.
- Public visitors read only approved, active shop profiles and public catalogue fields.
- Private documents and secrets never appear in public pages.
- Validate URLs; permit safe HTTPS destinations and supported UPI links.
- Never collect UPI PINs, bank passwords, card data or OTPs.
- Verify merchant ownership and payment destination before enabling payment actions.
- Payments should go directly to the merchant's own verified UPI/acquirer destination. The platform does not hold or settle merchant funds.
- Do not become a payment aggregator. Any future platform collection or split settlement requires an appropriately authorised payment partner and legal/regulatory advice.
- Distinguish demo, merchant-supplied and verified information. Obtain consent for publication, analytics and promotional messages.

## QR and print requirements
- QR encodes only the stable HTTPS shop URL.
- Generate high-resolution SVG/PNG with error correction, quiet zone and strong contrast.
- Include human-readable short URL, scan instruction, merchant name and platform attribution.
- Test physical size, glare, camera focus, scan distance and print quality before dispatch.

## Launch checklist
Merchant terms, privacy/refund policy, package limits, ownership/payment verification, RLS and role tests, stable QR routing, data minimisation, mobile accessibility, print tests, backups, monitoring, support and incident response. Obtain explicit approval before production release.

## Preview scope
This branch adds an isolated customer-page preview route. Buttons show local demo messages only. Payments, live contacts, maps, reviews, QR issuance, merchant registration, accounts, database writes and scan analytics are not connected. No Supabase migrations or production settings are changed.
