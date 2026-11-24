# BABA'S SMART QR — Implementation Plan

Business: BABA'S CYBER CAFE, Srinagar, Jammu & Kashmir  
Model: One-time setup + optional subscription; digital QR + optional printed counter stand  
Rollout: Srinagar pilot, then all India  
Status: Preview-only branch. No live merchant data, payments or production changes.

## Product promise
One permanent shop QR opens a simple mobile-first business card. Customers can view the shop's basic details and choose WhatsApp, call, directions or a merchant-provided payment link. There is no product catalogue, cart or ordering system in this product scope.

## Shop-owner experience
- A simple three-part owner workspace: My shop, My QR code and My plan.
- No technical setup or separate scanner app; customers scan with their phone camera.
- Shop details are entered once and the QR continues to point to the same permanent URL.
- Download a digital QR or print a sample counter stand; physical fulfilment is a separate confirmed order.
- Clear plan limits are shown before choosing a plan.

## Proposed packages (draft prices; approval required)
| Plan | One-time setup | Optional monthly | Limits |
|---|---:|---:|---|
| Starter | ₹499 | None | 1 QR, 1 location, basic contact links, basic scan count |
| Growth | ₹999 | ₹99 | 1 QR, 1 location, detailed analytics history up to 12 months, branded QR |
| VIP Business | ₹1,999 | ₹199 | Up to 3 QR codes and 3 locations, advanced analytics history up to 24 months, premium artwork and priority support |

These are draft examples, not approved public prices or final commercial terms. Confirm production cost, GST treatment, support scope, taxes, print/delivery charges, renewal, grace period, expiry behaviour and refunds before publishing.

## Subscription enforcement requirements
- Entitlements must be enforced server-side, not merely hidden in the interface.
- Starter has no recurring subscription. Its one-time QR remains active subject to platform terms; analytics remain basic.
- Growth and VIP monthly features remain available only while subscription status is active or within a defined grace period.
- On failed renewal/expiry, never silently delete the merchant's shop or change its permanent URL. Downgrade gated features after clear notice and grace period; preserve basic profile and QR continuity subject to policy.
- VIP location/QR caps must be validated by server-side functions and database constraints.
- Razorpay order creation, webhook signature verification, idempotency and subscription reconciliation are pending. No client-side secret keys or direct client subscription writes.

## Customer page
- No catalogue, product listing, offer tab, cart or order flow.
- Simple shop identity, address/hours, verification label, WhatsApp, call, directions, payment link and social/share links.
- Clearly label merchant-provided details and verified status.

## Delivery phases
1. Design preview: customer page and simple shop-owner workspace. No backend writes.
2. Core platform: Supabase schema, RLS, merchant approval lifecycle, unique slug, secure image storage and public shop route.
3. Owner controls: secure shopkeeper login, basic profile editor, QR download and print-ready artwork.
4. Owner admin: owner-only approval, verification, suspension, plan assignment, support and audit trail.
5. Subscription and analytics: enforce entitlements server-side, scan aggregation, renewal reminders and authorised Razorpay integration if approved.
6. Pilot: 10 Srinagar merchants; verify ownership, phone, payment destination and map pin; test printed QR on Android/iOS.
7. Launch: policies, monitoring, backups, support workflow and explicit production release approval.

## Security and trust
- No public role assignment; privileges are granted only by trusted server-side owner processes.
- RLS on every merchant-owned table; shop owners edit only their own records.
- Public visitors read only approved, active shop profiles.
- Validate URLs; permit safe HTTPS destinations and supported UPI links.
- Never collect UPI PINs, bank passwords, card data or OTPs.
- Verify merchant ownership and payment destination before enabling payment actions.
- Payments should go directly to the merchant's own verified payment destination. The platform does not hold or settle merchant funds.
- Obtain consent for publication, analytics and promotional messages.

## QR and print requirements
- QR encodes only the stable HTTPS shop URL.
- Generate high-resolution SVG/PNG with error correction and quiet zone.
- Include merchant name, scan instruction and platform attribution.
- Test physical size, glare, camera focus, scan distance and print quality before dispatch.

## Preview scope
All changes remain isolated to `preview/babas-smart-qr`. Customer and owner pages are illustrative. Payments, live contacts, maps, merchant accounts, subscriptions, plan enforcement and real analytics are not connected. No Supabase migration is applied and no production branch/settings are changed.
