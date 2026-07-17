# Sprint 2 - Launch operations

Implementation audit completed: 17 July 2026

## Status checklist

### Completed

- [x] Owner dashboard with lifecycle tabs and counts for draft, pending review, approved, published, changes requested, rejected and archived properties.
- [x] Owner property editing, private preview, duplication, controlled soft deletion and approval-history timeline.
- [x] Private media upload, removal, cover selection and image reordering with audit events.
- [x] Admin dashboard metrics, monthly property/enquiry charts, recent activity and operational shortcuts.
- [x] Searchable, paginated property administration with review, publish/archive and transactional bulk actions.
- [x] Verification, featured and pinned property controls; pinned published listings receive public ordering priority.
- [x] Dynamic master-data administration for categories, property types, locations, amenities, highlights, tags, facing, ownership, district, city, locality and advertisement type.
- [x] Enquiry CRM with status, priority, assignment, follow-up scheduling, notes and property/owner context.
- [x] SMTP templates and graceful delivery for welcome, password reset, enquiry notification, approval and rejection events.
- [x] Turnstile coverage on public authentication, enquiry and property submission flows, with a safe disabled state when keys are absent.
- [x] Redis REST rate limiting with a safe in-memory fallback for local development and unconfigured deployments.
- [x] CSV and XLSX exports for users, properties and enquiries, with spreadsheet-formula injection protection.
- [x] Protected audit viewer and expanded audit recording for auth, property, media, approval, CRM, export and role events.
- [x] Live Supabase master/property reads with an explicit demo fallback only when Supabase is not configured.
- [x] Sprint 2 schema migration and master-data seed additions.
- [x] ESLint, TypeScript, automated tests and production Next.js build.

### In progress / environment validation

- [ ] Apply all migrations to the production Supabase project and verify the complete workflow with real owner and admin accounts.
- [ ] Configure production SMTP, Turnstile and Redis REST credentials, then verify provider delivery and dashboards.
- [ ] Run responsive in-app browser verification when the browser's current localhost restriction is removed.

These items require production credentials and infrastructure state; their application code and safe fallbacks are complete.

### Not started - Sprint 3 scope

- [ ] Paying Guest operations.
- [ ] Memberships, subscriptions and payment gateways.
- [ ] Docker/VPS deployment automation.
- [ ] Native mobile applications.
- [ ] AI-assisted features.

## Database rollout

Apply SQL migrations in filename order, ending with:

`supabase/migrations/202607170004_sprint2_operations.sql`

Then apply `supabase/seed.sql`. The Sprint 2 migration is idempotent and adds operational master data, CRM notes, enquiry workflow fields, pinned listings, owner lifecycle functions, transactional bulk administration, usage counters, audit events and RLS policies.

## Required environment configuration

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
- Site: `NEXT_PUBLIC_SITE_URL`
- Turnstile: `NEXT_PUBLIC_CAPTCHA_SITE_KEY`, `CAPTCHA_SECRET_KEY`, `CAPTCHA_PROVIDER=turnstile`
- SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, `ADMIN_NOTIFICATION_EMAIL`
- Redis REST: `REDIS_URL` (HTTPS REST endpoint) and `REDIS_TOKEN`

## Manual production verification

- [ ] Register an owner, sign in and request a password reset.
- [ ] Create and edit a draft property; upload, reorder and remove images; choose a cover; preview and duplicate it.
- [ ] Submit the property and confirm owner editing/media controls lock while review is pending.
- [ ] Approve, request changes, reject, publish and archive test properties from an authorised admin account.
- [ ] Confirm approved/rejected SMTP messages and admin enquiry notifications arrive.
- [ ] Pin a published property and confirm it appears before unpinned results.
- [ ] Create and edit each master type; confirm active values appear in public and owner forms.
- [ ] Submit an enquiry, assign it, schedule follow-up, change priority/status and add an internal note.
- [ ] Export users, properties and enquiries as CSV and XLSX and open each file in a spreadsheet application.
- [ ] Confirm the audit log records auth, property, media, review, bulk, CRM and export operations.
- [ ] Verify Turnstile rejection and Redis rate limits with production credentials enabled.
- [ ] Test desktop and mobile layouts and confirm no private owner or storage data appears publicly.
