# Sprint 3 - Client audit and production readiness

Audit implementation date: 18 July 2026

## Client homepage audit

- [x] Reduced header, hero and section dimensions for denser above-the-fold communication.
- [x] Reduced desktop header spacing while retaining accessible navigation and actions.
- [x] Desktop dropdowns open on hover, close on leave/selection/Escape and support focus/keyboard operation.
- [x] Mobile navigation expands only one submenu and closes after navigation.
- [x] Hero typography reduced; rotation, previous/next, swipe, keyboard and interaction pause supported.
- [x] Location autocomplete uses dynamic location masters with Bhagya Nagar, Bhagyanagar, Gopal Nagar and Pernamitta seed records.
- [x] Budget presets replaced with blank numeric Budget From and Budget To inputs.
- [x] Hero, scrolling, flash and sidebar advertisements render only for active approved scheduled campaigns.
- [x] Scrolling advertisement moved above the hero and footer advertisement removed completely.
- [x] Property highlights use a deterministic business-priority order and aligned card regions.
- [x] Property details reorganised into gallery, overview, highlights, amenities, description, conversions, video, map, contact and similar properties.
- [x] Budget and area range fields start blank without implicit numeric defaults.
- [x] Local conversion uses `Gadi = square feet / 72`; 720 sq.ft displays as `720 sq.ft (10 Gadi)`.
- [x] Consent heading uses a professional message icon and clearer wording.
- [x] Named About leadership copy replaced with the client-supplied experience statement.
- [x] Responsive, focus, hover, overflow, motion and card-alignment polish applied.

## Production readiness

- [x] Optional Supabase, SMTP, Redis, Turnstile, Maps, Analytics and error-reporting configuration remains fail-safe.
- [x] Non-destructive Sprint 3 migration adds approved advertisements, localities and trigram search indexes.
- [x] Canonical URLs, OpenGraph, Twitter Cards, Organization, WebSite, listing and breadcrumb schema are present.
- [x] Search analytics endpoint, master-backed suggestions and public query indexes added.
- [x] Image loading, revalidation, layout sizing, reduced motion and content visibility optimized.
- [x] Keyboard navigation, focus visibility, landmarks, live carousel state and mobile controls audited.
- [x] CSP, security headers, origin checks, upload validation, RBAC and RLS protections retained/hardened.
- [x] Health status, request IDs, structured logs and graceful error boundaries added.
- [x] GA4, Google Search Console and Bing Webmaster configuration is conditional.
- [x] Backup, restore and disaster-recovery runbook documented.
- [ ] Validate production provider credentials and live Supabase records after deployment.
- [ ] Complete final Chrome, Edge, Firefox and Safari device-matrix checks against the deployed revision.

Live audit on 18 July 2026: `https://ongole.vercel.app/api/health` returned `503`/`degraded` with `database: not_configured`. Add the Supabase Vercel variables and apply all migrations before production acceptance.

## Migration

Apply `supabase/migrations/202607180001_sprint3_production_readiness.sql` after every earlier migration. It does not drop user or property data.

## Sprint 4

The Paying Guest module remains intentionally excluded and is the next planned product milestone.
