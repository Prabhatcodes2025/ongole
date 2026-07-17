# Sprint 1 — Public property experience

Audited and completed: 17 July 2026

## Progress checklist

### ✅ Completed

- Preserved the existing Next.js 16, TypeScript, Supabase, RBAC, private-media and manual-publication architecture.
- Restored the standard Vercel lifecycle: `next build` and `next start`; Vinext, Wrangler, Rolldown and Cloudflare Workers build tooling are absent.
- Added accessible desktop mega-menus and a full-height mobile drawer with Escape handling, route-close behavior, scroll locking and responsive tap targets.
- Rebuilt the homepage with five optimized category hero slides, dependent search fields, trust reasons, latest/featured listings, agent and PG introductions, controlled ad slots, clearly labelled testimonial placeholders and final CTA.
- Added a published-only Supabase public catalogue with a clearly labelled local demo fallback, normalized area filtering, URL filters, selected filters, sorting, pagination, grid/list persistence and loading/empty/error states.
- Added published-only property details with signed private media, lightbox/zoom/swipe gallery, conditional facts, conversions, validated YouTube embeds, premium-only exact maps, protected contact lookup, enquiry UX, similar properties and mobile actions.
- Added native share/copy, canonical WhatsApp/email links, print styles and authentication-aware save behavior.
- Added Organization, WebSite, RealEstateListing and BreadcrumbList structured data, dynamic metadata, canonicals, robots and a failure-safe published-only sitemap.
- Restricted anonymous property columns and coordinates through grants/RPCs; retained RLS, honeypot, rate limiting and optional Turnstile verification.
- Added normalized master data and area migrations, regression tests, responsive browser checks and production documentation.
- Optimized generated hero images from PNG to WebP (under 0.9 MB total).
- Verified clean install, ESLint, TypeScript, 11 tests and a standard Next.js production build.

### 🟡 Blocked by configuration

- Live approved listings, signed property media, protected contact data and exact premium maps activate after the Supabase variables and migrations are applied.
- The Turnstile widget activates only when both public and secret CAPTCHA keys are configured.
- Social links, analytics and search-engine verification remain hidden/inactive until their environment values are supplied.

### ❌ Not started (Sprint 2 or later)

- Full PG operations and booking workflows.
- Payment-provider integration, membership reconciliation and invoices.
- Complete CRM/admin modules, exports, outbox workers and advanced analytics.
- Docker/Nginx/VPS automation, backup drills and rollback automation.

## Manual verification checklist

- Configure Supabase, apply all migrations in filename order, then apply `supabase/seed.sql`.
- Publish one listing with ready media and confirm it appears on `/`, `/properties`, `/property/[slug]` and `/sitemap.xml`.
- Verify anonymous API access cannot read `owner_id`, coordinates or private storage paths.
- Check sale/rent/lease, category/type dependency, location, budget, area, bedroom, bathroom, facing, furnishing and amenity filters.
- Test desktop mega-menus and mobile drawer, filter panel, gallery keyboard/swipe/zoom, share/copy/print and enquiry success/error states.
- Validate metadata and JSON-LD with production URLs, then run a Lighthouse pass on home, listing and details pages.

## Sprint 2 recommendations

1. Owner draft editing and complete media reorder/delete/cover/alt-text controls.
2. Admin enquiry assignment, agent verification and content/SEO management screens.
3. Redis-backed distributed rate limits and email outbox processing with retries.
4. RLS integration tests against a seeded Supabase test project and Playwright end-to-end coverage.
