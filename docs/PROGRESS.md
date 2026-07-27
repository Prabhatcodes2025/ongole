# OngoleProperty.com implementation progress

Last audited: 27 July 2026

## Completed

- [x] Core platform: Next.js 16, React 19, TypeScript, Supabase Auth/PostgreSQL/Storage, RLS, RBAC, private media, manual review and protected contact access.
- [x] Vercel deployment: standard `next build` and `next start`; no Vinext, Wrangler, Rolldown or Cloudflare Workers build dependencies.
- [x] Sprint 1 public experience: responsive homepage, live/demo catalogue, filters, sorting, pagination, property details, enquiry UX, privacy-safe public data and SEO architecture.
- [x] Sprint 2 owner operations: complete property lifecycle, editing, private preview, duplicate/soft delete, history and media management.
- [x] Sprint 2 admin operations: metrics/charts, dynamic masters, property administration, transactional bulk actions and permission-protected audit viewer.
- [x] Sprint 2 CRM and integrations: enquiry workflow, notes, SMTP templates, Turnstile coverage and Redis-backed rate limiting with safe fallbacks.
- [x] Sprint 2 reporting: CSV/XLSX exports for users, properties and enquiries.
- [x] Quality gates: ESLint, TypeScript, automated tests and production Next.js build.
- [x] Post-Sprint-3 code audit: schema/query comparison, idempotent seed completion, Gadi database correction, profile/RLS hardening, schema-aware health, thumbnail variants and advertisement administration.
- [x] Authentication/RBAC hotfix: confirmation callback, cookie refresh proxy, safe profile reconciliation, current-user permission diagnostics, permission-aware admin metrics, master-data RLS policies and production auth verifier.
- [x] Property draft hotfix: authenticated sequence privilege, owner-derived draft creation, atomic initial history, collision-safe slug, edit-page redirect and request-ID diagnostics.
- [x] Property trigger hotfix: row-targeted usage-count maintenance replaces safe-update-blocked statement-level table refreshes.
- [x] Sprint 4 PG module: owner lifecycle, room inventory, media reuse, public search/details/enquiries, admin moderation, SEO, RLS/RBAC and automated contract coverage.

## Production configuration required

- [ ] Apply migrations through `202607270002_sprint4_paying_guest_module.sql` and rerun the idempotent seed in production.
- [ ] Configure optional SMTP, Turnstile, Redis REST, Maps, analytics and Sentry integrations as required by launch policy.
- [ ] Supply temporary owner/admin acceptance accounts and complete the destructive live workflow, then remove test records.
- [ ] Complete exact-width and cross-browser visual QA; the available browser reported a mobile breakpoint but did not expose the requested physical viewport widths reliably.

## Sprint 3 completed in code

- [x] All 16 client homepage audit items, including layout density, dropdown behavior, hero controls, numeric budgets, local autocomplete, conditional ads and footer-ad removal.
- [x] Local 72-square-feet-per-Gadi conversion and consistent card highlight ordering.
- [x] Property detail information architecture and responsive/accessibility polish.
- [x] Production migration for advertisements, micro-market locations and trigram search indexes.
- [x] GA4/Search Console/Bing integration, search analytics, request IDs, health reporting, structured logs and error boundaries.
- [x] Backup, restore and disaster-recovery runbook.
- [ ] Deploy this revision, apply the corrective migration and complete authenticated live acceptance.

Current live state (18 July 2026): `https://ongole.vercel.app/api/health` returns HTTP 200 with `database: reachable`. The live public catalogue uses Supabase (no demo notice), but the deployed revision cannot report `schema_ready` until the corrective migration and application revision are deployed.

## Future / excluded work

- [ ] Memberships/payments, Docker/VPS automation, mobile applications and AI features.

See `docs/SPRINT-1.md`, `docs/SPRINT-2.md`, `docs/SPRINT-3.md` and `docs/SPRINT-4.md` for detailed completion and production verification checklists.
