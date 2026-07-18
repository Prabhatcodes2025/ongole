# Sprint 3 production acceptance

Audit date: 18 July 2026  
Deployment audited: `https://ongole.vercel.app`

## Status

The codebase is ready for the corrective migration and redeployment. Production acceptance is **conditionally blocked** until the migration is applied and authenticated owner/admin tests are performed with disposable production acceptance accounts. Sprint 4 has not started.

## Progress checklist

- ✅ Completed — all expected tables, application query columns, foreign keys, lifecycle enums, timestamps, soft-delete fields and primary indexes were compared against migrations.
- ✅ Completed — seed now includes RBAC mappings, categories/types, required micro-market locations, master values, settings and feature flags using conflict-safe inserts.
- ✅ Completed — live public pages use Supabase and do not mix demo records; the live catalogue showed no preview notice or Demo badge.
- ✅ Completed — signup metadata is restricted to non-privileged account types and self-profile updates cannot alter role/status/verification fields.
- ✅ Completed — direct authenticated role-table writes are revoked; permission-checked `assign_user_role` and `remove_user_role` functions are provided.
- ✅ Completed — anonymous public-property reads use safe column grants; authenticated full-row reads are limited to owner/admin records.
- ✅ Completed — private WebP upload, watermark, display image, thumbnail, ordering, cover selection, signed URLs and variant deletion are implemented.
- ✅ Completed — only approved, scheduled advertisements render; authenticated administration now supports create/update/approve/archive/delete.
- ✅ Completed — Gadi is consistently 72 sq ft in TypeScript and the corrective database function; generated Gadi rows are refreshed.
- ✅ Completed — approved/published records stay owner-locked; an administrator can return them to changes requested with a reason, removing them from public results until reapproval and republication.
- ✅ Completed — health distinguishes `not_configured`, `reachable`, `schema_ready`, `degraded` and `unavailable` using a content-free schema probe.
- ✅ Completed — standard Next.js/Vercel scripts and dependencies contain no Vinext, Wrangler, Rolldown or Cloudflare Workers tooling.
- 🟡 In progress — the live deployment is reachable, uses live Supabase data and passes public search/URL/no-overflow smoke tests; it still runs the pre-correction health implementation.
- 🟡 In progress — exact-width responsive QA is manually pending because the available browser exposed the mobile breakpoint but did not report requested viewport widths accurately.
- ❌ Not started in production — authenticated registration/login/reset, owner draft/media/submission, admin approval, CRM mutation, report download and cleanup using designated test accounts.
- ❌ Not started in production — Chrome/Edge/Firefox/Safari device matrix.

## Automated verification

`pnpm install`, `pnpm lint`, `pnpm typecheck`, `pnpm test` (26 tests), `pnpm build`, `pnpm start` and a local HTTP smoke test pass. `git diff --check` passes. The read-only `pnpm verify:supabase` command checks `schema_ready`, a safe anonymous public-property read and denial of private property columns, audit logs, private media rows and role mappings. Run it after the corrective migration with production Supabase public variables available; it is intentionally not reported as passed without those credentials.

## Corrective migration

Apply `supabase/migrations/202607180002_post_sprint3_acceptance.sql` after every earlier migration. It is forward-only and does not delete user, property, enquiry or media records. Then rerun `supabase/seed.sql`; the seed is idempotent and contains no fake properties.

## Administrator bootstrap

1. Register the intended administrator normally and confirm the email address.
2. Copy that user's UUID from Supabase Authentication > Users.
3. Run this once in the Supabase SQL editor while authenticated as the database administrator:

```sql
insert into public.user_roles(user_id, role_id, assigned_by)
select '<AUTH_USER_UUID>'::uuid, id, '<AUTH_USER_UUID>'::uuid
from public.roles where code = 'super_admin'
on conflict (user_id, role_id) do nothing;
```

There is no public bootstrap endpoint. After bootstrap, a super administrator assigns or removes application roles through `assign_user_role(uuid,text)` and `remove_user_role(uuid,text)`. Account types are selected at registration: `owner` for owners, `agent` for agents, and `buyer` for ordinary users. Account type never grants administrative permissions.

## Environment and optional integrations

Required in Vercel: `NEXT_PUBLIC_SITE_URL=https://ongole.vercel.app`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY`. The live endpoint proves the two public Supabase values are present; secret-value presence cannot be inferred safely from the response.

Currently disabled/fallback according to the live health response: SMTP, Redis REST, CAPTCHA, Maps, analytics and Sentry. These do not roll back database writes. New enquiries are queued by the database trigger in `notification_outbox`; disabled SMTP is recorded as a structured, secret-free event.

Changing to `https://www.ongoleproperty.com` or `https://ongoleproperty.com` requires updating `NEXT_PUBLIC_SITE_URL`, Supabase Auth URL settings and then redeploying.

## Live evidence and blockers

- HTTP 200 health response: overall `ok`, database `reachable`; optional services match the stated disabled/fallback states.
- Homepage and filtered `/properties` requests loaded without browser console errors, demo markers, broken sampled images or horizontal overflow at the browser's effective viewport.
- Database-backed catalog returned categories, types, facings, amenities and accepted the Bhagya Nagar/area/sort/view URL state. No published record matched that exact test query.
- `/admin` redirected an anonymous browser to `/login?returnTo=/admin`.
- No production owner/admin credentials were supplied. Creating untracked production identities or records without a cleanup-capable admin session would leave test data, so authenticated mutation acceptance remains blocked.
- The corrective migration and this build are not yet deployed; live `database: reachable` therefore cannot be treated as schema acceptance.

## Manual production acceptance after deployment

1. Confirm health returns HTTP 200, overall `ok`, database `schema_ready`.
2. Register/confirm a disposable owner, log in/out, reset the password and verify session persistence.
3. Create/edit a draft, upload multiple images, verify thumbnail/display objects, reorder/set cover, submit for review and confirm owner cannot approve.
4. With the bootstrapped administrator, add a review note, request changes, resubmit, approve and publish. Verify search, details and sitemap.
5. Confirm approved/published listings are locked from owner edits; use request-changes/duplicate workflow for revisions. Archive the test listing and verify public removal.
6. Submit an anonymous enquiry. Verify honeypot/rate-limit validation, property relation, outbox entry, CRM assignment/status/note/follow-up and audit rows.
7. Create draft, scheduled, expired and approved advertisements. Verify only the active approved campaign appears and empty slots collapse.
8. Run anonymous/owner/admin RLS probes against private coordinates, owner IDs, other owners' rows, audit logs, role writes and advertisement writes.
9. Test 1920, 1440, 1366, 1280, 1024, 768, 430, 390, 375 and 360 px in Chrome, then repeat critical flows in Edge, Firefox and Safari. Check overflow, clipping, menus, drawers, layout shift, images, console/network errors and hydration warnings.
10. Remove test properties, media, enquiries, campaigns and disposable users through audited administrative procedures.
