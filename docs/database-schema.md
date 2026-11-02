# Database Schema

The authoritative schema is the ordered SQL migrations in `supabase/migrations/`. This page summarizes the relationships for operators and reviewers.

## Identity and roles

- `auth.users` is Supabase Auth's identity store.
- `profiles.id` is a one-to-one profile keyed to `auth.users.id`; customers may update only their own profile.
- `user_roles` contains only the `owner` role and is keyed by `(user_id, role)`. There is no client-side role assignment policy.

## Service catalogue

- `service_categories.slug` is the stable category key. Category rows hold name, description, icon, activation and sort order.
- `services.category_slug` references the category. A unique constraint prevents duplicate service names inside a category.
- Each service stores description, required-document names, eligibility, application method, optional HTTPS official URL plus a verification flag, active/featured flags and timestamps. The database rejects an official URL unless the owner explicitly marks it verified.
- Category/service triggers prevent activating a service in an inactive category and prevent category deactivation while active services remain.
- B-tree and trigram indexes support category, featured, date and text searches. The application queries use bounded ranges instead of loading the whole catalogue.

## Customer requests

- `applications` owns the PII and service request. `tracking_id` is unique, opaque and server-generated. `user_id` is nullable so a customer can submit without an account; only requests linked to the verified signed-in customer appear in the account dashboard.
- `application_status_history` stores append-only status transitions created by a trigger.
- `application_remarks` separates `customer` updates from `internal` owner notes.
- `application_documents` stores metadata and a private Storage path, never a public URL. Owner uploads are shared to customers only after approval/completion and through short-lived signed URLs.
- `email_notifications` logs queued/sent/failed/not-configured attempts without storing provider credentials.

## Operations

- `website_settings` stores public JSON settings, with `is_public` controlling anonymous read access. Writes require owner authorization in the Edge Function and RLS.
- `admin_audit_logs` records application, catalogue, category and site-setting changes.
- `request_rate_limits` stores hashed request scopes and short-lived window counts; it contains no raw phone, reference or IP values.

All public tables have RLS enabled. Public clients can read only active service/category data and public settings. Application inserts, customer tracking lookups, signed document creation, imports and all owner actions use server-side Edge Functions with strict input validation. The service-role key bypasses RLS and exists only in Supabase's function runtime.
